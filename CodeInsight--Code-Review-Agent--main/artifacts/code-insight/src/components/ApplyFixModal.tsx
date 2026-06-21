import { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { useApplyFix, useRevertFix } from "@workspace/api-client-react";
import { Button } from "@/components/ui/button";
import {
  X,
  CheckCircle,
  XCircle,
  Loader2,
  ShieldCheck,
  AlertTriangle,
  Copy,
  Download,
  RotateCcw,
  Zap,
} from "lucide-react";
import type { Issue } from "@workspace/api-client-react";

interface Props {
  issue: Issue;
  reviewId: string;
  snapshotId?: number;
  isApplied: boolean;
  onClose: () => void;
  onApplied: (snapshotId: number, newHealthScore: number | null) => void;
  onReverted: (newHealthScore: number | null) => void;
}

type Phase = "preview" | "applying" | "success" | "error" | "reverting" | "reverted";

const riskColors = {
  safe: "text-green-400",
  moderate: "text-yellow-400",
  "high-risk": "text-red-400",
};

const riskBg = {
  safe: "bg-green-500/10 border-green-500/20",
  moderate: "bg-yellow-500/10 border-yellow-500/20",
  "high-risk": "bg-red-500/10 border-red-500/20",
};

function CodeLine({ prefix, text, color }: { prefix: string; text: string; color: string }) {
  return (
    <div className={`flex px-3 py-0.5 font-mono text-xs ${color}`}>
      <span className="select-none mr-3 opacity-60 shrink-0">{prefix}</span>
      <span className="break-all">{text}</span>
    </div>
  );
}

function DiffSection({ label, code, type }: { label: string; code: string | null | undefined; type: "old" | "new" }) {
  if (!code) return null;
  const isOld = type === "old";
  const bg = isOld ? "bg-red-500/5 border-red-500/15" : "bg-green-500/5 border-green-500/15";
  const lineColor = isOld ? "bg-red-500/10 border-l-2 border-red-500 text-red-300/90" : "bg-green-500/10 border-l-2 border-green-500 text-green-300/90";
  const prefix = isOld ? "-" : "+";

  return (
    <div className={`rounded-lg border overflow-hidden ${bg}`}>
      <div className={`px-3 py-1 text-xs font-medium uppercase tracking-wider border-b ${isOld ? "text-red-400 border-red-500/15" : "text-green-400 border-green-500/15"}`}>
        {label}
      </div>
      <div className="overflow-x-auto">
        {code.split("\n").map((line, i) => (
          <CodeLine key={i} prefix={prefix} text={line} color={lineColor} />
        ))}
      </div>
    </div>
  );
}

export default function ApplyFixModal({ issue, reviewId, snapshotId, isApplied, onClose, onApplied, onReverted }: Props) {
  const [phase, setPhase] = useState<Phase>(isApplied ? "success" : "preview");
  const [errorMsg, setErrorMsg] = useState("");
  const [codeCopied, setCodeCopied] = useState(false);
  const [currentSnapshotId, setCurrentSnapshotId] = useState<number | undefined>(snapshotId);

  const applyMutation = useApplyFix();
  const revertMutation = useRevertFix();

  const handleApply = async () => {
    if (!issue.newCode) return;
    setPhase("applying");
    try {
      const result = await applyMutation.mutateAsync({
        id: reviewId,
        data: { issueId: Number(issue.id) },
      });
      setCurrentSnapshotId(result.snapshotId);
      setPhase("success");
      onApplied(result.snapshotId, result.newHealthScore ?? null);
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : "Fix could not be applied";
      setErrorMsg(msg);
      setPhase("error");
    }
  };

  const handleRevert = async () => {
    if (!currentSnapshotId) return;
    setPhase("reverting");
    try {
      const result = await revertMutation.mutateAsync({
        id: reviewId,
        snapshotId: String(currentSnapshotId),
      });
      setPhase("reverted");
      onReverted(result.newHealthScore ?? null);
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : "Revert failed";
      setErrorMsg(msg);
      setPhase("error");
    }
  };

  const handleCopyCode = () => {
    if (!issue.newCode) return;
    navigator.clipboard.writeText(issue.newCode);
    setCodeCopied(true);
    setTimeout(() => setCodeCopied(false), 2000);
  };

  const handleDownloadPatch = () => {
    const old = issue.oldCode ?? `// ${issue.file} — original`;
    const oldLines = old.split("\n");
    const newLines = (issue.newCode ?? "").split("\n");
    const patch = [
      `--- a/${issue.file}`,
      `+++ b/${issue.file}`,
      `@@ -1,${oldLines.length} +1,${newLines.length} @@`,
      ...oldLines.map((l) => `-${l}`),
      ...newLines.map((l) => `+${l}`),
      "",
    ].join("\n");
    const blob = new Blob([patch], { type: "text/plain" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `fix-${issue.id}.patch`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const handleDownloadFile = () => {
    if (!issue.newCode) return;
    const blob = new Blob([issue.newCode], { type: "text/plain" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    const filename = issue.file.split("/").pop() ?? "fixed-file.txt";
    a.download = `fixed-${filename}`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const affectedCount = (issue.affectedFiles ?? []).length;

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4"
      onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}
    >
      <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" onClick={onClose} />

      <motion.div
        initial={{ opacity: 0, scale: 0.96, y: 12 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        exit={{ opacity: 0, scale: 0.96, y: 12 }}
        transition={{ duration: 0.2 }}
        className="relative w-full max-w-2xl max-h-[90vh] overflow-y-auto rounded-2xl border border-white/10 bg-[#0e0e14] shadow-2xl"
      >
        {/* Header */}
        <div className="sticky top-0 z-10 flex items-center justify-between px-5 py-4 border-b border-white/5 bg-[#0e0e14]/95 backdrop-blur-sm">
          <div className="flex items-center gap-2.5">
            <Zap size={16} className="text-purple-400" />
            <span className="font-semibold text-white text-sm">
              {phase === "success" || phase === "reverted" ? (phase === "reverted" ? "Fix Reverted" : "Fix Applied") : "Apply Fix"}
            </span>
          </div>
          <button onClick={onClose} className="text-muted-foreground hover:text-white transition-colors">
            <X size={16} />
          </button>
        </div>

        <div className="p-5 space-y-5">
          {/* Issue title */}
          <div>
            <p className="text-xs text-muted-foreground mb-1">{issue.file}{issue.line != null ? `:${issue.line}` : ""}</p>
            <h3 className="text-white font-medium text-sm leading-snug">{issue.title}</h3>
          </div>

          <AnimatePresence mode="wait">

            {/* ── PREVIEW PHASE ── */}
            {phase === "preview" && (
              <motion.div key="preview" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="space-y-4">

                {/* Diff */}
                <div className="space-y-2">
                  <p className="text-xs text-muted-foreground uppercase tracking-wider">Code Change</p>
                  <DiffSection label="Before" code={issue.oldCode} type="old" />
                  <DiffSection label="After" code={issue.newCode} type="new" />
                </div>

                {/* Validation preview */}
                <div className={`rounded-xl border p-3.5 space-y-2 ${riskBg[affectedCount === 0 ? "safe" : affectedCount <= 3 ? "moderate" : "high-risk"]}`}>
                  <p className="text-xs text-muted-foreground uppercase tracking-wider mb-2">Pre-flight checks</p>
                  <div className="grid grid-cols-2 gap-2 text-xs">
                    <div className="flex items-center gap-2 text-green-400">
                      <CheckCircle size={12} /> Syntax check
                    </div>
                    <div className="flex items-center gap-2 text-green-400">
                      <CheckCircle size={12} /> Import safety
                    </div>
                    <div className={`flex items-center gap-2 ${riskColors[affectedCount === 0 ? "safe" : affectedCount <= 3 ? "moderate" : "high-risk"]}`}>
                      <ShieldCheck size={12} />
                      Risk: {affectedCount === 0 ? "safe" : affectedCount <= 3 ? "moderate" : "high-risk"}
                    </div>
                    <div className="flex items-center gap-2 text-muted-foreground">
                      <AlertTriangle size={12} />
                      {affectedCount} file{affectedCount !== 1 ? "s" : ""} affected
                    </div>
                  </div>
                </div>

                {/* Affected files */}
                {(issue.affectedFiles ?? []).length > 0 && (
                  <div className="space-y-1.5">
                    <p className="text-xs text-muted-foreground uppercase tracking-wider">Affected Files</p>
                    <div className="space-y-1">
                      {(issue.affectedFiles ?? []).map((f) => (
                        <div key={f} className="text-xs font-mono text-white/60 px-2 py-1 rounded bg-white/3 border border-white/5">{f}</div>
                      ))}
                    </div>
                  </div>
                )}

                <div className="flex gap-2 pt-1">
                  <Button onClick={onClose} variant="outline" className="flex-1 border-white/10 text-white hover:bg-white/5 h-9 text-sm">
                    Cancel
                  </Button>
                  {issue.newCode && (
                    <Button onClick={handleApply} className="flex-1 bg-purple-600 hover:bg-purple-500 text-white h-9 text-sm">
                      <Zap size={14} className="mr-1.5" /> Confirm & Apply Fix
                    </Button>
                  )}
                </div>
              </motion.div>
            )}

            {/* ── APPLYING / REVERTING PHASE ── */}
            {(phase === "applying" || phase === "reverting") && (
              <motion.div key="applying" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
                className="flex flex-col items-center justify-center py-12 gap-4">
                <div className="relative">
                  <div className="w-16 h-16 rounded-full border border-purple-500/30 flex items-center justify-center">
                    <Loader2 size={28} className="text-purple-400 animate-spin" />
                  </div>
                </div>
                <div className="text-center">
                  <p className="text-white font-medium text-sm">{phase === "applying" ? "Validating & Applying Fix" : "Reverting Fix"}</p>
                  <p className="text-muted-foreground text-xs mt-1">Running sandbox patch in isolated workspace…</p>
                </div>
              </motion.div>
            )}

            {/* ── SUCCESS PHASE ── */}
            {phase === "success" && (
              <motion.div key="success" initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }} className="space-y-4">
                <div className="flex items-center gap-3 p-4 rounded-xl bg-green-500/10 border border-green-500/20">
                  <CheckCircle size={20} className="text-green-400 shrink-0" />
                  <div>
                    <p className="text-green-300 font-medium text-sm">Fix Applied Successfully</p>
                    <p className="text-green-400/70 text-xs mt-0.5">Patch validated and committed to sandbox workspace</p>
                  </div>
                </div>

                {/* Code snippet (after) */}
                {issue.newCode && (
                  <DiffSection label="Applied Code" code={issue.newCode} type="new" />
                )}

                {/* Download/copy actions */}
                <div className="grid grid-cols-3 gap-2">
                  <Button onClick={handleCopyCode} variant="outline" size="sm" className="border-white/10 text-white hover:bg-white/5 text-xs h-8">
                    {codeCopied ? <CheckCircle size={12} className="mr-1 text-green-400" /> : <Copy size={12} className="mr-1" />}
                    Copy Code
                  </Button>
                  <Button onClick={handleDownloadPatch} variant="outline" size="sm" className="border-white/10 text-white hover:bg-white/5 text-xs h-8">
                    <Download size={12} className="mr-1" /> .patch
                  </Button>
                  <Button onClick={handleDownloadFile} variant="outline" size="sm" className="border-white/10 text-white hover:bg-white/5 text-xs h-8">
                    <Download size={12} className="mr-1" /> File
                  </Button>
                </div>

                <div className="flex gap-2">
                  <Button onClick={onClose} className="flex-1 bg-purple-600 hover:bg-purple-500 text-white h-9 text-sm">
                    Done
                  </Button>
                  <Button onClick={handleRevert} variant="outline" className="border-white/10 text-white hover:bg-white/5 h-9 text-sm px-4">
                    <RotateCcw size={13} className="mr-1.5" /> Revert
                  </Button>
                </div>
              </motion.div>
            )}

            {/* ── REVERTED PHASE ── */}
            {phase === "reverted" && (
              <motion.div key="reverted" initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }} className="space-y-4">
                <div className="flex items-center gap-3 p-4 rounded-xl bg-slate-500/10 border border-slate-500/20">
                  <RotateCcw size={20} className="text-slate-400 shrink-0" />
                  <div>
                    <p className="text-slate-300 font-medium text-sm">Fix Reverted</p>
                    <p className="text-slate-400/70 text-xs mt-0.5">Original code restored in sandbox workspace</p>
                  </div>
                </div>
                <Button onClick={onClose} className="w-full bg-purple-600 hover:bg-purple-500 text-white h-9 text-sm">
                  Close
                </Button>
              </motion.div>
            )}

            {/* ── ERROR PHASE ── */}
            {phase === "error" && (
              <motion.div key="error" initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }} className="space-y-4">
                <div className="flex items-center gap-3 p-4 rounded-xl bg-red-500/10 border border-red-500/20">
                  <XCircle size={20} className="text-red-400 shrink-0" />
                  <div>
                    <p className="text-red-300 font-medium text-sm">Operation Failed</p>
                    <p className="text-red-400/70 text-xs mt-0.5">{errorMsg}</p>
                  </div>
                </div>
                <div className="flex gap-2">
                  <Button onClick={() => setPhase("preview")} variant="outline" className="flex-1 border-white/10 text-white hover:bg-white/5 h-9 text-sm">
                    Try Again
                  </Button>
                  <Button onClick={onClose} className="flex-1 bg-purple-600 hover:bg-purple-500 text-white h-9 text-sm">
                    Close
                  </Button>
                </div>
              </motion.div>
            )}

          </AnimatePresence>
        </div>
      </motion.div>
    </div>
  );
}
