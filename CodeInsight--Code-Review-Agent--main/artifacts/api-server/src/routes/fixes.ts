import { Router } from "express";
import { clerkMiddleware, getAuth } from "@clerk/express";
import { db } from "@workspace/db";
import { issuesTable, reviewsTable, fixSnapshotsTable } from "@workspace/db";
import { eq, and } from "drizzle-orm";
import { applyFix, revertFix, getReviewSnapshots } from "../lib/fixEngine";

const fixesRouter = Router({ mergeParams: true });
fixesRouter.use(clerkMiddleware());

/** GET /api/reviews/:id/fixes — list snapshots */
fixesRouter.get("/", async (req, res) => {
  const { userId } = getAuth(req);
  if (!userId) return res.status(401).json({ error: "Unauthorized" });

  const reviewId = Number(req.params.id);
  if (isNaN(reviewId)) return res.status(400).json({ error: "Invalid review ID" });

  const [review] = await db.select({ userId: reviewsTable.userId }).from(reviewsTable).where(eq(reviewsTable.id, reviewId));
  if (!review || review.userId !== userId) return res.status(404).json({ error: "Review not found" });

  const snapshots = await getReviewSnapshots(reviewId);
  return res.json(snapshots);
});

/** POST /api/reviews/:id/fixes — apply a fix */
fixesRouter.post("/", async (req, res) => {
  const { userId } = getAuth(req);
  if (!userId) return res.status(401).json({ error: "Unauthorized" });

  const reviewId = Number(req.params.id);
  if (isNaN(reviewId)) return res.status(400).json({ error: "Invalid review ID" });

  const { issueId } = req.body as { issueId: number };
  if (!issueId) return res.status(400).json({ error: "issueId required" });

  const [review] = await db.select({ userId: reviewsTable.userId }).from(reviewsTable).where(eq(reviewsTable.id, reviewId));
  if (!review || review.userId !== userId) return res.status(404).json({ error: "Review not found" });

  const [issue] = await db.select().from(issuesTable).where(and(eq(issuesTable.id, issueId), eq(issuesTable.reviewId, reviewId)));
  if (!issue) return res.status(404).json({ error: "Issue not found" });
  if (issue.fixApplied) return res.status(409).json({ error: "Fix already applied" });
  if (!issue.newCode) return res.status(422).json({ error: "No fix available for this issue" });

  const originalCode = issue.oldCode ?? `// ${issue.file} — original`;
  const affectedCount = (issue.affectedFiles ?? []).length;

  const result = await applyFix(issueId, reviewId, issue.file, originalCode, issue.newCode, issue.severity, affectedCount);

  if (!result.valid) {
    return res.status(422).json({ error: "Validation failed", detail: result.message, validation: result.validation });
  }

  return res.status(201).json({
    snapshotId: result.snapshotId,
    message: result.message,
    validation: result.validation,
    newHealthScore: result.newHealthScore ?? null,
  });
});

/** DELETE /api/reviews/:id/fixes/:snapshotId — revert a fix */
fixesRouter.delete("/:snapshotId", async (req, res) => {
  const { userId } = getAuth(req);
  if (!userId) return res.status(401).json({ error: "Unauthorized" });

  const reviewId = Number(req.params.id);
  const snapshotId = Number(req.params.snapshotId);
  if (isNaN(reviewId) || isNaN(snapshotId)) return res.status(400).json({ error: "Invalid IDs" });

  const [review] = await db.select({ userId: reviewsTable.userId }).from(reviewsTable).where(eq(reviewsTable.id, reviewId));
  if (!review || review.userId !== userId) return res.status(404).json({ error: "Review not found" });

  const [snapshot] = await db.select().from(fixSnapshotsTable).where(eq(fixSnapshotsTable.id, snapshotId));
  if (!snapshot) return res.status(404).json({ error: "Snapshot not found" });

  const result = await revertFix(snapshotId, snapshot.issueId);
  if (!result.success) return res.status(409).json({ error: result.message });

  return res.json({
    message: result.message,
    originalCode: result.originalCode ?? null,
    newHealthScore: result.newHealthScore ?? null,
  });
});

export default fixesRouter;
