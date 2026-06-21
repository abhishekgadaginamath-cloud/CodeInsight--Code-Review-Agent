import { useState } from "react";
import { useLocation } from "wouter";
import { motion, AnimatePresence } from "framer-motion";
import { UserButton } from "@clerk/react";
import {
  useGetReview,
  useGetReviewPatch,
  getGetReviewQueryKey,
  getGetReviewPatchQueryKey,
} from "@workspace/api-client-react";
import { useQueryClient } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import ApplyFixModal from "@/components/ApplyFixModal";
import {
  Code2,
  ArrowLeft,
  Shield,
  AlertTriangle,
  Zap,
  FileCode,
  ChevronRight,
  Copy,
  Download,
  CheckCircle,
  X,
  Filter,
  RotateCcw,
} from "lucide-react";

interface Props { id: string }

const severityColors: Record<string, string> = {
  critical: "bg-red-500/15 text-red-400 border-red-500/30",
  high: "bg-orange-500/15 text-orange-400 border-orange-500/30",
  medium: "bg-yellow-500/15 text-yellow-400 border-yellow-500/30",
  low: "bg-blue-500/15 text-blue-400 border-blue-500/30",
  info: "bg-slate-500/15 text-slate-400 border-slate-500/30",
};

const categoryIcons: Record<string, React.ReactNode> = {
  security: <Shield size={14} />,
  code_smell: <AlertTriangle size={14} />,
  architecture: <Zap size={14} />,
  performance: <Zap size={14} />,
  other: <FileCode size={14} />,
};

function DiffViewer({ oldCode, newCode }: { oldCode: string | null; newCode: string | null }) {
  if (!oldCode && !newCode) return null;
  return (
    <div className="rounded-lg overflow-hidden border border-white/5 font-mono text-xs">
      {oldCode && oldCode.split("\n").map((line, i) => (
        <div key={`old-${i}`} className="flex bg-red-500/10 px-3 py-0.5 border-l-2 border-red-500">
          <span className="text-red-400 select-none mr-3">-</span>
          <span className="text-red-300/90">{line}</span>
        </div>
      ))}
      {newCode && newCode.split("\n").map((line, i) => (
        <div key={`new-${i}`} className="flex bg-green-500/10 px-3 py-0.5 border-l-2 border-green-500">
          <span className="text-green-400 select-none mr-3">+</span>
          <span className="text-green-300/90">{line}</span>
        </div>
      ))}
    </div>
  );
}

function HealthGauge({ score }: { score: number | null | undefined }) {
  if (score == null) return null;
  const color = score >= 80 ? "#22c55e" : score >= 50 ? "#eab308" : "#ef4444";
  const label = score >= 80 ? "Good" : score >= 50 ? "Fair" : "Poor";
  return (
    <div className="flex items-center gap-3">
      <div className="relative w-14 h-14">
        <svg viewBox="0 0 36 36" className="w-14 h-14 -rotate-90">
          <circle cx="18" cy="18" r="15.9" fill="none" stroke="rgba(255,255,255,0.08)" strokeWidth="3" />
          <circle
            cx="18" cy="18" r="15.9"
            fill="none" stroke={color} strokeWidth="3"
            strokeDasharray={`${score} 100`}
            strokeLinecap="round"
          />
        </svg>
        <div className="absolute inset-0 flex items-center justify-center">
          <span className="text-xs font-bold text-white">{Math.round(score)}</span>
        </div>
      </div>
      <div>
        <div className="text-sm font-semibold" style={{ color }}>{label}</div>
        <div className="text-xs text-muted-foreground">Health Score</div>
      </div>
    </div>
  );
}

export default function ReviewPage({ id }: Props) {
  const [, setLocation] = useLocation();
  const [selectedIssueId, setSelectedIssueId] = useState<string | null>(null);
  const [filterSeverity, setFilterSeverity] = useState<string | null>(null);
  const [filterCategory, setFilterCategory] = useState<string | null>(null);
  const [selectedFile, setSelectedFile] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);
  const [showFixModal, setShowFixModal] = useState(false);

  // Local state tracking applied fixes this session: issueId → snapshotId
  const [appliedFixes, setAppliedFixes] = useState<Record<string, number>>({});
  // Local state tracking reverted fixes this session
  const [revertedFixes, setRevertedFixes] = useState<Set<string>>(new Set());
  // Optimistic health score override
  const [healthScoreOverride, setHealthScoreOverride] = useState<number | null>(null);

  const queryClient = useQueryClient();
  const review = useGetReview(id, { query: { queryKey: getGetReviewQueryKey(id) } });
  const patch = useGetReviewPatch(id, {
    query: { queryKey: getGetReviewPatchQueryKey(id), enabled: !!review.data },
  });

  const issues = review.data?.issues ?? [];

  // Merge DB fixApplied state with local session state
  const isIssueFixed = (issueId: string): boolean => {
    if (revertedFixes.has(issueId)) return false;
    if (appliedFixes[issueId] != null) return true;
    return !!(issues.find((i) => i.id === issueId)?.fixApplied);
  };

  const files = Array.from(new Set(issues.map((i) => i.file))).sort();

  const filtered = issues.filter((issue) => {
    if (filterSeverity && issue.severity !== filterSeverity) return false;
    if (filterCategory && issue.category !== filterCategory) return false;
    if (selectedFile && issue.file !== selectedFile) return false;
    return true;
  });

  const selectedIssue = issues.find((i) => i.id === selectedIssueId);

  const handleCopyFix = () => {
    if (!selectedIssue?.newCode) return;
    navigator.clipboard.writeText(selectedIssue.newCode);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const handleDownloadPatch = () => {
    if (!patch.data) return;
    const blob = new Blob([patch.data.patch], { type: "text/plain" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = patch.data.filename;
    a.click();
    URL.revokeObjectURL(url);
  };

  const handleFixApplied = (snapshotId: number, newHealthScore: number | null) => {
    if (!selectedIssueId) return;
    setAppliedFixes((prev) => ({ ...prev, [selectedIssueId]: snapshotId }));
    setRevertedFixes((prev) => { const s = new Set(prev); s.delete(selectedIssueId); return s; });
    if (newHealthScore != null) setHealthScoreOverride(newHealthScore);
    // Refetch review in background to sync server state
    queryClient.invalidateQueries({ queryKey: getGetReviewQueryKey(id) });
  };

  const handleFixReverted = (newHealthScore: number | null) => {
    if (!selectedIssueId) return;
    setRevertedFixes((prev) => new Set([...prev, selectedIssueId]));
    setAppliedFixes((prev) => { const copy = { ...prev }; delete copy[selectedIssueId]; return copy; });
    if (newHealthScore != null) setHealthScoreOverride(newHealthScore);
    setShowFixModal(false);
    queryClient.invalidateQueries({ queryKey: getGetReviewQueryKey(id) });
  };

  const displayedHealthScore = healthScoreOverride ?? review.data?.healthScore ?? null;

  const severities = ["critical", "high", "medium", "low", "info"];

  const fixedInSession = selectedIssueId != null && isIssueFixed(selectedIssueId);
  const currentSnapshotId = selectedIssueId != null ? (appliedFixes[selectedIssueId] ?? undefined) : undefined;

  return (
    <div className="min-h-screen bg-background flex flex-col">
      <header className="border-b border-white/5 sticky top-0 z-10 bg-background/80 backdrop-blur-md">
        <div className="max-w-full px-6 h-14 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <button
              onClick={() => setLocation("/dashboard")}
              data-testid="button-back-from-review"
              className="text-muted-foreground hover:text-white transition-colors"
            >
              <ArrowLeft size={18} />
            </button>
            <Code2 size={20} className="text-purple-400" />
            <span className="font-semibold text-white truncate max-w-[200px]">
              {review.data?.repoName ?? "Review"}
            </span>
          </div>
          <div className="flex items-center gap-4">
            {review.data && (
              <motion.div
                key={Math.round(displayedHealthScore ?? 0)}
                initial={{ scale: 1 }}
                animate={{ scale: [1, 1.08, 1] }}
                transition={{ duration: 0.4 }}
              >
                <HealthGauge score={displayedHealthScore} />
              </motion.div>
            )}
            {patch.data && (
              <Button
                onClick={handleDownloadPatch}
                data-testid="button-download-patch"
                variant="outline"
                className="border-white/10 text-white hover:bg-white/5 text-sm h-8"
              >
                <Download size={14} className="mr-1.5" /> Download Patch
              </Button>
            )}
            <UserButton afterSignOutUrl="/" />
          </div>
        </div>
      </header>

      {review.isLoading && (
        <div className="flex-1 grid grid-cols-3 gap-0">
          <div className="border-r border-white/5 p-4 space-y-2">
            {[1, 2, 3, 4].map((i) => <Skeleton key={i} className="h-8 w-full" />)}
          </div>
          <div className="col-span-2 p-4 space-y-4">
            {[1, 2, 3].map((i) => <Skeleton key={i} className="h-20 w-full" />)}
          </div>
        </div>
      )}

      {!review.isLoading && review.data && (
        <div className="flex-1 grid grid-cols-[220px_1fr_380px] min-h-0 overflow-hidden" style={{ height: "calc(100vh - 56px)" }}>
          {/* File tree */}
          <div className="border-r border-white/5 overflow-y-auto p-3">
            <div className="text-xs text-muted-foreground uppercase tracking-wider mb-3 px-2">Files</div>
            <button
              onClick={() => setSelectedFile(null)}
              data-testid="file-all"
              className={`w-full flex items-center gap-2 px-2 py-1.5 rounded text-sm text-left transition-colors mb-1 ${
                !selectedFile ? "bg-purple-500/15 text-purple-300" : "text-muted-foreground hover:bg-white/5 hover:text-white"
              }`}
            >
              <Code2 size={13} />
              All files
            </button>
            {files.map((file) => {
              const count = issues.filter((i) => i.file === file).length;
              const parts = file.split("/");
              const name = parts[parts.length - 1];
              return (
                <button
                  key={file}
                  onClick={() => setSelectedFile(file === selectedFile ? null : file)}
                  data-testid={`file-${name}`}
                  className={`w-full flex items-center justify-between gap-2 px-2 py-1.5 rounded text-sm text-left transition-colors ${
                    selectedFile === file
                      ? "bg-purple-500/15 text-purple-300"
                      : "text-muted-foreground hover:bg-white/5 hover:text-white"
                  }`}
                >
                  <span className="truncate flex items-center gap-1.5">
                    <FileCode size={12} className="shrink-0" />
                    <span className="truncate">{name}</span>
                  </span>
                  <span className="shrink-0 text-xs bg-white/10 px-1.5 py-0.5 rounded">{count}</span>
                </button>
              );
            })}
          </div>

          {/* Issues list */}
          <div className="border-r border-white/5 overflow-y-auto">
            {/* Filters */}
            <div className="sticky top-0 bg-background/95 backdrop-blur-sm border-b border-white/5 p-3">
              <div className="flex items-center gap-2 flex-wrap">
                <Filter size={14} className="text-muted-foreground" />
                {severities.map((s) => (
                  <button
                    key={s}
                    onClick={() => setFilterSeverity(filterSeverity === s ? null : s)}
                    className={`text-xs px-2 py-0.5 rounded border transition-all ${
                      filterSeverity === s
                        ? severityColors[s]
                        : "border-white/5 text-muted-foreground hover:border-white/15"
                    }`}
                  >
                    {s}
                  </button>
                ))}
              </div>
            </div>

            <div className="p-3 space-y-2">
              {filtered.length === 0 && (
                <div className="text-center py-12 text-muted-foreground text-sm">
                  No issues match the current filter
                </div>
              )}
              {filtered.map((issue, i) => {
                const fixed = isIssueFixed(issue.id);
                return (
                  <motion.button
                    key={issue.id}
                    initial={{ opacity: 0, y: 8 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: i * 0.03 }}
                    onClick={() => setSelectedIssueId(issue.id === selectedIssueId ? null : issue.id)}
                    data-testid={`issue-${issue.id}`}
                    className={`w-full text-left p-3 rounded-xl border transition-all duration-200 ${
                      selectedIssueId === issue.id
                        ? "border-purple-500/40 bg-purple-500/10"
                        : fixed
                        ? "border-green-500/20 bg-green-500/5"
                        : "border-white/5 bg-white/2 hover:border-white/10 hover:bg-white/4"
                    }`}
                  >
                    <div className="flex items-start justify-between gap-2 mb-1.5">
                      <span className="text-sm text-white font-medium leading-snug">{issue.title}</span>
                      <div className="flex items-center gap-1.5 shrink-0">
                        {fixed && (
                          <span className="text-xs px-1.5 py-0.5 rounded border bg-green-500/15 text-green-400 border-green-500/30 flex items-center gap-1">
                            <CheckCircle size={10} /> Fixed
                          </span>
                        )}
                        <span className={`text-xs px-1.5 py-0.5 rounded border ${severityColors[issue.severity]}`}>
                          {issue.severity}
                        </span>
                      </div>
                    </div>
                    <div className="flex items-center gap-2 text-xs text-muted-foreground">
                      <span className="flex items-center gap-1">
                        {categoryIcons[issue.category]}
                        {issue.category.replace("_", " ")}
                      </span>
                      <span className="text-white/20">·</span>
                      <span className="font-mono truncate">
                        {issue.file.split("/").pop()}
                        {issue.line != null ? `:${issue.line}` : ""}
                      </span>
                    </div>
                  </motion.button>
                );
              })}
            </div>
          </div>

          {/* Issue detail */}
          <div className="overflow-y-auto">
            <AnimatePresence mode="wait">
              {selectedIssue ? (
                <motion.div
                  key={selectedIssue.id}
                  initial={{ opacity: 0, x: 20 }}
                  animate={{ opacity: 1, x: 0 }}
                  exit={{ opacity: 0, x: 20 }}
                  className="p-5"
                >
                  <div className="flex items-start justify-between gap-4 mb-4">
                    <div>
                      <span className={`text-xs px-2 py-0.5 rounded border ${severityColors[selectedIssue.severity]} inline-flex items-center gap-1 mb-2`}>
                        {categoryIcons[selectedIssue.category]}
                        {selectedIssue.severity} · {selectedIssue.category.replace("_", " ")}
                      </span>
                      <h2 className="text-base font-semibold text-white leading-tight">
                        {selectedIssue.title}
                      </h2>
                    </div>
                    <button
                      onClick={() => setSelectedIssueId(null)}
                      className="text-muted-foreground hover:text-white transition-colors shrink-0 mt-1"
                    >
                      <X size={16} />
                    </button>
                  </div>

                  {/* Fixed badge */}
                  <AnimatePresence>
                    {fixedInSession && (
                      <motion.div
                        initial={{ opacity: 0, height: 0 }}
                        animate={{ opacity: 1, height: "auto" }}
                        exit={{ opacity: 0, height: 0 }}
                        className="mb-4 overflow-hidden"
                      >
                        <div className="flex items-center gap-2 p-2.5 rounded-lg bg-green-500/10 border border-green-500/20">
                          <CheckCircle size={14} className="text-green-400 shrink-0" />
                          <span className="text-xs text-green-300 font-medium">Fix applied — patch committed to sandbox workspace</span>
                        </div>
                      </motion.div>
                    )}
                  </AnimatePresence>

                  {/* Location */}
                  <div className="flex items-center gap-2 text-xs text-muted-foreground font-mono mb-4 p-2 rounded bg-white/3 border border-white/5">
                    <FileCode size={12} />
                    {selectedIssue.file}
                    {selectedIssue.line != null && <span className="text-purple-400">:{selectedIssue.line}</span>}
                  </div>

                  {/* Description */}
                  <div className="mb-4">
                    <h3 className="text-xs text-muted-foreground uppercase tracking-wider mb-2">Problem</h3>
                    <p className="text-sm text-white/80 leading-relaxed">{selectedIssue.description}</p>
                  </div>

                  {/* Explanation */}
                  <div className="mb-4">
                    <h3 className="text-xs text-muted-foreground uppercase tracking-wider mb-2">Explanation</h3>
                    <p className="text-sm text-white/70 leading-relaxed">{selectedIssue.explanation}</p>
                  </div>

                  {/* Code diff */}
                  {(selectedIssue.oldCode || selectedIssue.newCode) && (
                    <div className="mb-4">
                      <h3 className="text-xs text-muted-foreground uppercase tracking-wider mb-2">Code Change</h3>
                      <DiffViewer oldCode={selectedIssue.oldCode ?? null} newCode={selectedIssue.newCode ?? null} />
                    </div>
                  )}

                  {/* Fix suggestion */}
                  {selectedIssue.fixSuggestion && (
                    <div className="mb-5">
                      <h3 className="text-xs text-muted-foreground uppercase tracking-wider mb-2">Fix Suggestion</h3>
                      <p className="text-sm text-white/70 leading-relaxed">{selectedIssue.fixSuggestion}</p>
                    </div>
                  )}

                  {/* Action buttons */}
                  <div className="space-y-2">
                    {/* Apply Fix button — only if fix code exists */}
                    {selectedIssue.newCode && !fixedInSession && (
                      <Button
                        onClick={() => setShowFixModal(true)}
                        data-testid="button-apply-fix"
                        className="w-full bg-purple-600 hover:bg-purple-500 text-white text-sm h-9"
                      >
                        <Zap size={14} className="mr-1.5" /> Apply Fix
                      </Button>
                    )}

                    {/* Revert Fix button — only when fixed */}
                    {fixedInSession && currentSnapshotId != null && (
                      <Button
                        onClick={() => setShowFixModal(true)}
                        data-testid="button-revert-fix"
                        variant="outline"
                        className="w-full border-white/10 text-white hover:bg-white/5 text-sm h-9"
                      >
                        <RotateCcw size={14} className="mr-1.5" /> Revert Fix
                      </Button>
                    )}

                    <div className="flex gap-2">
                      {selectedIssue.newCode && (
                        <Button
                          onClick={handleCopyFix}
                          data-testid="button-copy-fix"
                          variant="outline"
                          className="flex-1 border-white/10 text-white hover:bg-white/5 text-sm h-9"
                        >
                          {copied ? (
                            <><CheckCircle size={14} className="mr-1.5 text-green-400" /> Copied</>
                          ) : (
                            <><Copy size={14} className="mr-1.5" /> Copy Fix</>
                          )}
                        </Button>
                      )}
                      {patch.data && (
                        <Button
                          onClick={handleDownloadPatch}
                          data-testid="button-download-fix"
                          variant="outline"
                          className="flex-1 border-white/10 text-white hover:bg-white/5 text-sm h-9"
                        >
                          <Download size={14} className="mr-1.5" /> Download Patch
                        </Button>
                      )}
                    </div>
                  </div>
                </motion.div>
              ) : (
                <motion.div
                  key="empty"
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  className="flex flex-col items-center justify-center h-full py-24 px-6 text-center"
                >
                  <ChevronRight size={32} className="text-purple-400/30 mb-3" />
                  <p className="text-muted-foreground text-sm">Select an issue to see details and fix suggestions</p>
                </motion.div>
              )}
            </AnimatePresence>
          </div>
        </div>
      )}

      {/* Apply Fix Modal */}
      <AnimatePresence>
        {showFixModal && selectedIssue && (
          <ApplyFixModal
            issue={selectedIssue}
            reviewId={id}
            snapshotId={currentSnapshotId}
            isApplied={fixedInSession}
            onClose={() => setShowFixModal(false)}
            onApplied={handleFixApplied}
            onReverted={handleFixReverted}
          />
        )}
      </AnimatePresence>
    </div>
  );
}
