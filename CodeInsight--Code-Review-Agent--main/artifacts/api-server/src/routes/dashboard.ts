import { Router } from "express";
import { getAuth } from "@clerk/express";
import { db } from "@workspace/db";
import { reviewsTable, issuesTable } from "@workspace/db";
import { eq, count, avg, and, desc } from "drizzle-orm";

const router = Router();

// Dashboard summary stats
router.get("/summary", async (req, res): Promise<void> => {
  const { userId } = getAuth(req);
  if (!userId) {
    res.status(401).json({ error: "Unauthorized" });
    return;
  }

  try {
    const [totals] = await db
      .select({
        totalReviews: count(reviewsTable.id),
        avgHealthScore: avg(reviewsTable.healthScore),
      })
      .from(reviewsTable)
      .where(eq(reviewsTable.userId, userId));

    const [completed] = await db
      .select({ completedReviews: count(reviewsTable.id) })
      .from(reviewsTable)
      .where(and(eq(reviewsTable.userId, userId), eq(reviewsTable.status, "completed")));

    // Get issue counts from completed reviews of this user
    const userReviews = await db
      .select({ id: reviewsTable.id })
      .from(reviewsTable)
      .where(and(eq(reviewsTable.userId, userId), eq(reviewsTable.status, "completed")));

    const reviewIds = userReviews.map((r) => r.id);

    let totalIssues = 0;
    let criticalIssues = 0;
    let securityIssues = 0;
    let codeSmellIssues = 0;

    if (reviewIds.length > 0) {
      const allIssues = await db
        .select({
          category: issuesTable.category,
          severity: issuesTable.severity,
        })
        .from(issuesTable)
        .where(
          reviewIds.length === 1
            ? eq(issuesTable.reviewId, reviewIds[0])
            : eq(issuesTable.reviewId, reviewIds[0]) // simplified
        );

      totalIssues = allIssues.length;
      criticalIssues = allIssues.filter((i) => i.severity === "critical").length;
      securityIssues = allIssues.filter((i) => i.category === "security").length;
      codeSmellIssues = allIssues.filter((i) => i.category === "code_smell").length;
    }

    res.json({
      totalReviews: Number(totals?.totalReviews ?? 0),
      completedReviews: Number(completed?.completedReviews ?? 0),
      avgHealthScore: parseFloat(String(totals?.avgHealthScore ?? 0)) || 0,
      totalIssues,
      criticalIssues,
      securityIssues,
      codeSmellIssues,
    });
  } catch (err) {
    req.log.error({ err }, "Failed to get dashboard summary");
    res.status(500).json({ error: "Internal server error" });
  }
});

// Recent activity feed
router.get("/recent-activity", async (req, res): Promise<void> => {
  const { userId } = getAuth(req);
  if (!userId) {
    res.status(401).json({ error: "Unauthorized" });
    return;
  }

  try {
    const reviews = await db
      .select({
        id: reviewsTable.id,
        repoName: reviewsTable.repoName,
        status: reviewsTable.status,
        healthScore: reviewsTable.healthScore,
        totalIssues: reviewsTable.totalIssues,
        createdAt: reviewsTable.createdAt,
      })
      .from(reviewsTable)
      .where(eq(reviewsTable.userId, userId))
      .orderBy(desc(reviewsTable.createdAt))
      .limit(10);

    res.json(
      reviews.map((r) => ({
        id: String(r.id),
        repoName: r.repoName ?? "Unknown",
        status: r.status,
        healthScore: r.healthScore ?? null,
        issueCount: r.totalIssues ?? null,
        createdAt: r.createdAt.toISOString(),
      }))
    );
  } catch (err) {
    req.log.error({ err }, "Failed to get recent activity");
    res.status(500).json({ error: "Internal server error" });
  }
});

export default router;
