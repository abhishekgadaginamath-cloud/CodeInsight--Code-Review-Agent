import { pgTable, text, serial, integer, timestamp, real, boolean } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";

export const issuesTable = pgTable("issues", {
  id: serial("id").primaryKey(),
  reviewId: integer("review_id").notNull(),
  category: text("category").notNull().default("other"),
  severity: text("severity").notNull().default("medium"),
  file: text("file").notNull(),
  line: integer("line"),
  title: text("title").notNull(),
  description: text("description").notNull(),
  explanation: text("explanation").notNull(),
  oldCode: text("old_code"),
  newCode: text("new_code"),
  fixSuggestion: text("fix_suggestion"),
  confidenceScore: real("confidence_score"),
  impactLevel: text("impact_level").default("safe"),
  affectedFiles: text("affected_files").array(),
  dependencyChain: text("dependency_chain").array(),
  fixApplied: boolean("fix_applied").default(false),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

export const insertIssueSchema = createInsertSchema(issuesTable).omit({ id: true, createdAt: true });
export type InsertIssue = z.infer<typeof insertIssueSchema>;
export type Issue = typeof issuesTable.$inferSelect;
