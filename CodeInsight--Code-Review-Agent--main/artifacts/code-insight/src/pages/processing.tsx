import { useEffect, useState, useRef } from "react";
import { useLocation } from "wouter";
import { motion, AnimatePresence } from "framer-motion";
import { useGetReview, getGetReviewQueryKey } from "@workspace/api-client-react";
import { useQueryClient } from "@tanstack/react-query";
import { Code2, CheckCircle, Loader2, XCircle, AlertTriangle } from "lucide-react";
import { Button } from "@/components/ui/button";

const STEPS = [
  "Cloning repository",
  "Parsing files",
  "Detecting languages",
  "Analyzing diff",
  "Running security analysis",
  "Detecting code smells",
  "Analyzing architecture",
  "Generating fix patches",
  "Finalizing review",
];

function stepIndex(step: string | null | undefined): number {
  if (!step) return -1;
  const idx = STEPS.findIndex((s) => s.toLowerCase() === step.toLowerCase());
  return idx;
}

interface Props { id: string }

export default function ProcessingPage({ id }: Props) {
  const [, setLocation] = useLocation();
  const queryClient = useQueryClient();
  const [wsConnected, setWsConnected] = useState(false);
  const [liveStep, setLiveStep] = useState<string | null>(null);
  const [liveProgress, setLiveProgress] = useState(0);
  const [liveFileCount, setLiveFileCount] = useState<number | null>(null);
  const wsRef = useRef<WebSocket | null>(null);

  const review = useGetReview(id, {
    query: {
      queryKey: getGetReviewQueryKey(id),
      refetchInterval: (data) => {
        const status = data?.state?.data?.status;
        if (status === "completed" || status === "failed" || status === "cancelled") return false;
        return wsConnected ? false : 2000;
      },
    },
  });

  // Connect WebSocket
  useEffect(() => {
    const proto = window.location.protocol === "https:" ? "wss:" : "ws:";
    const url = `${proto}//${window.location.host}/ws/reviews/${id}`;
    const ws = new WebSocket(url);
    wsRef.current = ws;

    ws.onopen = () => setWsConnected(true);
    ws.onclose = () => setWsConnected(false);
    ws.onerror = () => setWsConnected(false);
    ws.onmessage = (e) => {
      try {
        const data = JSON.parse(e.data as string) as {
          type: string;
          step?: string;
          progress?: number;
          fileCount?: number;
          healthScore?: number;
          totalIssues?: number;
        };
        if (data.type === "progress") {
          setLiveStep(data.step ?? null);
          setLiveProgress(data.progress ?? 0);
          if (data.fileCount != null) setLiveFileCount(data.fileCount);
        }
        if (data.type === "completed" || data.type === "error") {
          queryClient.invalidateQueries({ queryKey: getGetReviewQueryKey(id) });
        }
      } catch {}
    };

    return () => ws.close();
  }, [id, queryClient]);

  // Auto-navigate when done
  useEffect(() => {
    const status = review.data?.status;
    if (status === "completed") {
      setTimeout(() => setLocation(`/reviews/${id}`), 800);
    }
  }, [review.data?.status, id, setLocation]);

  const currentStep = liveStep ?? review.data?.currentStep;
  const progress = liveProgress > 0 ? liveProgress : 0;
  const fileCount = liveFileCount ?? review.data?.fileCount;
  const status = review.data?.status;
  const currentIdx = stepIndex(currentStep);

  return (
    <div className="min-h-screen bg-background flex flex-col">
      <header className="border-b border-white/5">
        <div className="max-w-7xl mx-auto px-6 h-14 flex items-center gap-2">
          <Code2 size={20} className="text-purple-400" />
          <span className="font-semibold text-white">Code Insight</span>
          <span className="text-muted-foreground mx-2">—</span>
          <span className="text-muted-foreground text-sm">Analysis in Progress</span>
        </div>
      </header>

      <main className="flex-1 flex items-center justify-center px-6 py-12">
        <div className="max-w-xl w-full">
          <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }}>
            {/* Header */}
            <div className="text-center mb-10">
              <h1 className="text-2xl font-bold text-white mb-2">
                {status === "completed" ? "Analysis Complete" :
                 status === "failed" ? "Analysis Failed" :
                 "Analyzing your code..."}
              </h1>
              <p className="text-muted-foreground text-sm">
                {review.data?.repoName ?? "Repository"}
                {fileCount != null && ` · ${fileCount} files`}
              </p>
            </div>

            {/* Progress bar */}
            {status !== "failed" && status !== "completed" && (
              <div className="mb-8">
                <div className="flex justify-between text-xs text-muted-foreground mb-2">
                  <span>{currentStep ?? "Queued..."}</span>
                  <span>{progress}%</span>
                </div>
                <div className="h-1.5 bg-muted rounded-full overflow-hidden">
                  <motion.div
                    className="h-full bg-gradient-to-r from-purple-500 to-blue-500 rounded-full"
                    animate={{ width: `${progress}%` }}
                    transition={{ duration: 0.5 }}
                  />
                </div>
              </div>
            )}

            {/* Steps */}
            <div className="glass rounded-xl overflow-hidden">
              <div className="border-b border-white/5 px-4 py-3 flex items-center gap-2">
                <div className="w-2 h-2 rounded-full bg-purple-400 animate-pulse" />
                <span className="text-xs text-muted-foreground font-mono">Analysis pipeline</span>
              </div>
              <div className="p-4 space-y-1">
                {STEPS.map((step, i) => {
                  const isCompleted = currentIdx > i || status === "completed";
                  const isCurrent = currentIdx === i && status !== "completed" && status !== "failed";
                  const isPending = currentIdx < i && status !== "completed";

                  return (
                    <motion.div
                      key={step}
                      initial={{ opacity: 0, x: -10 }}
                      animate={{ opacity: 1, x: 0 }}
                      transition={{ delay: i * 0.05 }}
                      className="flex items-center gap-3 py-2"
                    >
                      <div className="w-5 h-5 flex items-center justify-center shrink-0">
                        {isCompleted ? (
                          <CheckCircle size={16} className="text-green-400" />
                        ) : isCurrent ? (
                          <Loader2 size={16} className="text-purple-400 animate-spin" />
                        ) : (
                          <div className="w-2 h-2 rounded-full bg-white/10" />
                        )}
                      </div>
                      <span
                        className={`text-sm transition-colors ${
                          isCompleted
                            ? "text-white/70"
                            : isCurrent
                            ? "text-white font-medium"
                            : "text-muted-foreground/50"
                        }`}
                      >
                        {step}
                      </span>
                    </motion.div>
                  );
                })}
              </div>
            </div>

            {/* Status messages */}
            <AnimatePresence>
              {status === "completed" && (
                <motion.div
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  className="mt-6 text-center"
                >
                  <CheckCircle size={40} className="text-green-400 mx-auto mb-3" />
                  <p className="text-white font-medium">Review complete! Redirecting...</p>
                </motion.div>
              )}
              {status === "failed" && (
                <motion.div
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  className="mt-6"
                >
                  <div className="glass rounded-xl p-6 text-center border border-red-500/20">
                    <XCircle size={36} className="text-red-400 mx-auto mb-3" />
                    <h3 className="font-medium text-white mb-2">Analysis failed</h3>
                    <p className="text-muted-foreground text-sm mb-4">
                      {review.data?.errorMessage ?? "An unexpected error occurred"}
                    </p>
                    <Button
                      onClick={() => setLocation("/analyze")}
                      className="bg-purple-600 hover:bg-purple-500 text-white"
                    >
                      Try again
                    </Button>
                  </div>
                </motion.div>
              )}
            </AnimatePresence>

            {/* Cancel */}
            {(status === "processing" || status === "queued") && (
              <div className="mt-6 text-center">
                <button
                  onClick={() => setLocation("/dashboard")}
                  className="text-muted-foreground text-sm hover:text-white transition-colors"
                  data-testid="button-cancel-back"
                >
                  Cancel and go back
                </button>
              </div>
            )}
          </motion.div>
        </div>
      </main>
    </div>
  );
}
