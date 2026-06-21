import { Router } from "express";
import { getAuth } from "@clerk/express";
import { db } from "@workspace/db";
import { reviewsTable, issuesTable } from "@workspace/db";
import {
  CreateReviewBody,
  GetReviewParams,
  CancelReviewParams,
  GetReviewPatchParams,
} from "@workspace/api-zod";
import { eq, and, desc } from "drizzle-orm";
import { logger } from "../lib/logger";
import { runReviewPipeline } from "../lib/reviewPipeline";

const router = Router();

// List reviews for current user
router.get("/", async (req, res): Promise<void> => {
  const { userId } = getAuth(req);
  if (!userId) {
    res.status(401).json({ error: "Unauthorized" });
    return;
  }

  try {
    const reviews = await db
      .select()
      .from(reviewsTable)
      .where(eq(reviewsTable.userId, userId))
      .orderBy(desc(reviewsTable.createdAt))
      .limit(50);

    res.json(
      reviews.map((r) => ({
        ...r,
        id: String(r.id),
        healthScore: r.healthScore ?? null,
        totalIssues: r.totalIssues ?? null,
        criticalIssues: r.criticalIssues ?? null,
        fileCount: r.fileCount ?? null,
        linesAnalyzed: r.linesAnalyzed ?? null,
        errorMessage: null,
      }))
    );
  } catch (err) {
    req.log.error({ err }, "Failed to list reviews");
    res.status(500).json({ error: "Internal server error" });
  }
});

// Create a new review
router.post("/", async (req, res): Promise<void> => {
  const { userId } = getAuth(req);
  if (!userId) {
    res.status(401).json({ error: "Unauthorized" });
    return;
  }

  const parsed = CreateReviewBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.message });
    return;
  }

  const { repoUrl, repoName, repoType, prUrl } = parsed.data;

  try {
    const [review] = await db
      .insert(reviewsTable)
      .values({
        userId,
        repoUrl: repoUrl ?? null,
        repoName: repoName ?? (repoUrl ? extractRepoName(repoUrl) : "Unknown"),
        repoType,
        prUrl: prUrl ?? null,
        status: "queued",
        currentStep: "Queued for analysis",
      })
      .returning();

    // Start pipeline asynchronously (don't await)
    runReviewPipeline(review.id, userId).catch((err) => {
      logger.error({ err, reviewId: review.id }, "Pipeline failed");
    });

    res.status(201).json({
      ...review,
      id: String(review.id),
    });
  } catch (err) {
    req.log.error({ err }, "Failed to create review");
    res.status(500).json({ error: "Internal server error" });
  }
});

// Get specific review with issues
router.get("/:id", async (req, res): Promise<void> => {
  const { userId } = getAuth(req);
  if (!userId) {
    res.status(401).json({ error: "Unauthorized" });
    return;
  }

  const parsed = GetReviewParams.safeParse({ id: req.params.id });
  if (!parsed.success) {
    res.status(400).json({ error: "Invalid review ID" });
    return;
  }

  const reviewId = parseInt(parsed.data.id, 10);
  if (isNaN(reviewId)) {
    res.status(400).json({ error: "Invalid review ID" });
    return;
  }

  try {
    const [review] = await db
      .select()
      .from(reviewsTable)
      .where(and(eq(reviewsTable.id, reviewId), eq(reviewsTable.userId, userId)));

    if (!review) {
      res.status(404).json({ error: "Review not found" });
      return;
    }

    const issues = await db
      .select()
      .from(issuesTable)
      .where(eq(issuesTable.reviewId, reviewId))
      .orderBy(issuesTable.severity);

    res.json({
      ...review,
      id: String(review.id),
      errorMessage: null,
      issues: issues.map((i) => ({
        ...i,
        id: String(i.id),
        reviewId: String(i.reviewId),
        line: i.line ?? null,
        oldCode: i.oldCode ?? null,
        newCode: i.newCode ?? null,
        fixSuggestion: i.fixSuggestion ?? null,
      })),
    });
  } catch (err) {
    req.log.error({ err }, "Failed to get review");
    res.status(500).json({ error: "Internal server error" });
  }
});

// Cancel review
router.post("/:id/cancel", async (req, res): Promise<void> => {
  const { userId } = getAuth(req);
  if (!userId) {
    res.status(401).json({ error: "Unauthorized" });
    return;
  }

  const parsed = CancelReviewParams.safeParse({ id: req.params.id });
  if (!parsed.success) {
    res.status(400).json({ error: "Invalid review ID" });
    return;
  }

  const reviewId = parseInt(parsed.data.id, 10);

  try {
    const [review] = await db
      .update(reviewsTable)
      .set({ status: "cancelled" })
      .where(and(eq(reviewsTable.id, reviewId), eq(reviewsTable.userId, userId)))
      .returning();

    if (!review) {
      res.status(404).json({ error: "Review not found" });
      return;
    }

    res.json({ ...review, id: String(review.id) });
  } catch (err) {
    req.log.error({ err }, "Failed to cancel review");
    res.status(500).json({ error: "Internal server error" });
  }
});

// Get patch file
router.get("/:id/patch", async (req, res): Promise<void> => {
  const { userId } = getAuth(req);
  if (!userId) {
    res.status(401).json({ error: "Unauthorized" });
    return;
  }

  const parsed = GetReviewPatchParams.safeParse({ id: req.params.id });
  if (!parsed.success) {
    res.status(400).json({ error: "Invalid review ID" });
    return;
  }

  const reviewId = parseInt(parsed.data.id, 10);

  try {
    const [review] = await db
      .select()
      .from(reviewsTable)
      .where(and(eq(reviewsTable.id, reviewId), eq(reviewsTable.userId, userId)));

    if (!review) {
      res.status(404).json({ error: "Review not found" });
      return;
    }

    const issues = await db
      .select()
      .from(issuesTable)
      .where(and(eq(issuesTable.reviewId, reviewId)));

    const patchLines: string[] = [];
    for (const issue of issues) {
      if (issue.oldCode && issue.newCode) {
        patchLines.push(`--- a/${issue.file}`);
        patchLines.push(`+++ b/${issue.file}`);
        patchLines.push(`@@ -${issue.line ?? 1},1 +${issue.line ?? 1},1 @@`);
        for (const line of issue.oldCode.split("\n")) {
          patchLines.push(`-${line}`);
        }
        for (const line of issue.newCode.split("\n")) {
          patchLines.push(`+${line}`);
        }
        patchLines.push("");
      }
    }

    const patch = patchLines.join("\n");
    const filename = `code-insight-${review.repoName ?? "review"}-${review.id}.patch`;

    res.json({ patch, filename });
  } catch (err) {
    req.log.error({ err }, "Failed to generate patch");
    res.status(500).json({ error: "Internal server error" });
  }
});

function extractRepoName(url: string): string {
  const parts = url.replace(/\.git$/, "").split("/");
  return parts[parts.length - 1] ?? "Unknown";
}

export default router;
