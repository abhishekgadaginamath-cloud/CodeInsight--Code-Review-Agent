/**
 * Fix Engine — validate, apply, and rollback code patches.
 * Every fix is stored as a snapshot before being applied.
 * Health score updates only when a validated fix is committed.
 */
import { db } from "@workspace/db";
import { fixSnapshotsTable, issuesTable, reviewsTable } from "@workspace/db";
import { eq, and, sql } from "drizzle-orm";
import { logger } from "./logger";

export interface ValidationResult {
  syntax: "passed" | "failed";
  imports: "safe" | "warning";
  riskLevel: "safe" | "moderate" | "high-risk";
  affectedFilesCount: number;
  message: string;
}

export interface ApplyFixResult {
  snapshotId: number;
  valid: boolean;
  validation: ValidationResult;
  message: string;
  newHealthScore?: number;
}

const SEVERITY_DELTA: Record<string, number> = {
  critical: 20,
  high: 10,
  medium: 3,
  low: 1,
  info: 0,
};

export function validatePatch(
  filePath: string,
  newCode: string,
  affectedFilesCount: number
): ValidationResult {
  const ext = filePath.split(".").pop()?.toLowerCase() ?? "";
  const isTS = ["ts", "tsx", "js", "jsx"].includes(ext);

  let syntax: ValidationResult["syntax"] = "passed";
  let syntaxMsg = "All checks passed";

  if (isTS) {
    let depth = 0;
    for (const ch of newCode) {
      if (ch === "{") depth++;
      else if (ch === "}") depth--;
      if (depth < 0) { syntax = "failed"; syntaxMsg = "Unbalanced braces: unexpected }"; break; }
    }
    if (syntax === "passed" && depth !== 0) {
      syntax = "failed";
      syntaxMsg = `Unbalanced braces: ${depth} unclosed {`;
    }
    if (syntax === "passed" && newCode.trim().length === 0) {
      syntax = "failed";
      syntaxMsg = "Fix produces empty code";
    }
  }

  const imports: ValidationResult["imports"] =
    /\bimport\s+from\s*[^'"]/.test(newCode) ? "warning" : "safe";

  const riskLevel: ValidationResult["riskLevel"] =
    affectedFilesCount === 0 ? "safe"
    : affectedFilesCount <= 3 ? "moderate"
    : "high-risk";

  const message =
    syntax === "failed" ? syntaxMsg
    : riskLevel === "high-risk" ? `${affectedFilesCount} dependent files may be impacted`
    : "All checks passed";

  return { syntax, imports, riskLevel, affectedFilesCount, message };
}

function generateDiff(filePath: string, oldCode: string, newCode: string): string {
  const oldLines = oldCode.split("\n");
  const newLines = newCode.split("\n");
  return [
    `--- a/${filePath}`,
    `+++ b/${filePath}`,
    `@@ -1,${oldLines.length} +1,${newLines.length} @@`,
    ...oldLines.map((l) => `-${l}`),
    ...newLines.map((l) => `+${l}`),
    "",
  ].join("\n");
}

export async function applyFix(
  issueId: number,
  reviewId: number,
  filePath: string,
  originalCode: string,
  newCode: string,
  severity: string,
  affectedFilesCount: number
): Promise<ApplyFixResult> {
  const validation = validatePatch(filePath, newCode, affectedFilesCount);

  if (validation.syntax === "failed") {
    logger.warn({ issueId, filePath, msg: validation.message }, "Fix validation failed");
    return { snapshotId: -1, valid: false, validation, message: `Validation failed: ${validation.message}` };
  }

  const patchContent = generateDiff(filePath, originalCode, newCode);

  const [snapshot] = await db
    .insert(fixSnapshotsTable)
    .values({ issueId, reviewId, filePath, originalCode, patchContent, status: "applied" })
    .returning();

  await db.update(issuesTable).set({ fixApplied: true }).where(eq(issuesTable.id, issueId));

  const delta = SEVERITY_DELTA[severity] ?? 0;
  const [updated] = await db
    .update(reviewsTable)
    .set({ healthScore: sql`LEAST(100, COALESCE(health_score, 0) + ${delta})` })
    .where(eq(reviewsTable.id, reviewId))
    .returning({ healthScore: reviewsTable.healthScore });

  logger.info({ issueId, snapshotId: snapshot.id, delta }, "Fix applied");
  return {
    snapshotId: snapshot.id,
    valid: true,
    validation,
    message: "Fix applied successfully",
    newHealthScore: updated?.healthScore ?? undefined,
  };
}

export async function revertFix(
  snapshotId: number,
  issueId: number
): Promise<{ success: boolean; message: string; originalCode?: string; newHealthScore?: number }> {
  const [snapshot] = await db
    .select()
    .from(fixSnapshotsTable)
    .where(and(eq(fixSnapshotsTable.id, snapshotId), eq(fixSnapshotsTable.issueId, issueId)));

  if (!snapshot) return { success: false, message: "Snapshot not found" };
  if (snapshot.status === "reverted") return { success: false, message: "Fix already reverted" };

  await db.update(fixSnapshotsTable)
    .set({ status: "reverted", revertedAt: new Date() })
    .where(eq(fixSnapshotsTable.id, snapshotId));

  await db.update(issuesTable).set({ fixApplied: false }).where(eq(issuesTable.id, issueId));

  const [issue] = await db.select({ severity: issuesTable.severity }).from(issuesTable).where(eq(issuesTable.id, issueId));
  const delta = SEVERITY_DELTA[issue?.severity ?? ""] ?? 0;

  const [updated] = await db
    .update(reviewsTable)
    .set({ healthScore: sql`GREATEST(0, COALESCE(health_score, 0) - ${delta})` })
    .where(eq(reviewsTable.id, snapshot.reviewId))
    .returning({ healthScore: reviewsTable.healthScore });

  logger.info({ snapshotId, issueId, delta }, "Fix reverted");
  return {
    success: true,
    message: "Fix reverted successfully",
    originalCode: snapshot.originalCode,
    newHealthScore: updated?.healthScore ?? undefined,
  };
}

export async function getReviewSnapshots(reviewId: number) {
  return db.select().from(fixSnapshotsTable).where(eq(fixSnapshotsTable.reviewId, reviewId));
}
