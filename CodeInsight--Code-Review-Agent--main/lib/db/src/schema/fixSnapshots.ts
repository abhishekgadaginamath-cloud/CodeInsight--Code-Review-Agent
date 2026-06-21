import { pgTable, text, serial, integer, timestamp } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";

export const fixSnapshotsTable = pgTable("fix_snapshots", {
  id: serial("id").primaryKey(),
  issueId: integer("issue_id").notNull(),
  reviewId: integer("review_id").notNull(),
  filePath: text("file_path").notNull(),
  originalCode: text("original_code").notNull(),
  patchContent: text("patch_content").notNull(),
  status: text("status").notNull().default("applied"),
  appliedAt: timestamp("applied_at", { withTimezone: true }).notNull().defaultNow(),
  revertedAt: timestamp("reverted_at", { withTimezone: true }),
});

export const insertFixSnapshotSchema = createInsertSchema(fixSnapshotsTable).omit({
  id: true,
  appliedAt: true,
});
export type InsertFixSnapshot = z.infer<typeof insertFixSnapshotSchema>;
export type FixSnapshot = typeof fixSnapshotsTable.$inferSelect;
