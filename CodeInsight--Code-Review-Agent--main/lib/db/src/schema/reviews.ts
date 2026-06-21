import { pgTable, text, serial, integer, real, timestamp } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";

export const reviewsTable = pgTable("reviews", {
  id: serial("id").primaryKey(),
  userId: text("user_id").notNull(),
  repoUrl: text("repo_url"),
  repoName: text("repo_name"),
  repoType: text("repo_type").notNull().default("github"),
  prUrl: text("pr_url"),
  status: text("status").notNull().default("queued"),
  healthScore: real("health_score"),
  totalIssues: integer("total_issues"),
  criticalIssues: integer("critical_issues"),
  fileCount: integer("file_count"),
  linesAnalyzed: integer("lines_analyzed"),
  currentStep: text("current_step"),
  errorMessage: text("error_message"),
  scoresSecurity: real("scores_security"),
  scoresMaintainability: real("scores_maintainability"),
  scoresComplexity: real("scores_complexity"),
  scoresDuplication: real("scores_duplication"),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow().$onUpdate(() => new Date()),
});

export const insertReviewSchema = createInsertSchema(reviewsTable).omit({ id: true, createdAt: true, updatedAt: true });
export type InsertReview = z.infer<typeof insertReviewSchema>;
export type Review = typeof reviewsTable.$inferSelect;
