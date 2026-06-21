import { useLocation } from "wouter";
import { motion } from "framer-motion";
import { UserButton, useUser } from "@clerk/react";
import {
  useListReviews,
  useGetDashboardSummary,
  useGetRecentActivity,
  getGetDashboardSummaryQueryKey,
  getGetRecentActivityQueryKey,
  getListReviewsQueryKey,
} from "@workspace/api-client-react";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { Code2, Plus, Shield, AlertTriangle, CheckCircle, Clock, XCircle, Loader2, Activity } from "lucide-react";

function StatusBadge({ status }: { status: string }) {
  const map: Record<string, { label: string; classes: string; icon: React.ReactNode }> = {
    queued: { label: "Queued", classes: "bg-slate-500/15 text-slate-400 border-slate-500/30", icon: <Clock size={12} /> },
    processing: { label: "Processing", classes: "bg-blue-500/15 text-blue-400 border-blue-500/30", icon: <Loader2 size={12} className="animate-spin" /> },
    completed: { label: "Completed", classes: "bg-green-500/15 text-green-400 border-green-500/30", icon: <CheckCircle size={12} /> },
    failed: { label: "Failed", classes: "bg-red-500/15 text-red-400 border-red-500/30", icon: <XCircle size={12} /> },
    cancelled: { label: "Cancelled", classes: "bg-slate-500/15 text-slate-400 border-slate-500/30", icon: <XCircle size={12} /> },
  };
  const { label, classes, icon } = map[status] ?? map.queued;
  return (
    <span className={`inline-flex items-center gap-1.5 px-2 py-0.5 rounded border text-xs font-medium ${classes}`}>
      {icon} {label}
    </span>
  );
}

function HealthScore({ score }: { score: number | null | undefined }) {
  if (score == null) return <span className="text-muted-foreground text-sm">—</span>;
  const color = score >= 80 ? "text-green-400" : score >= 50 ? "text-yellow-400" : "text-red-400";
  return <span className={`font-mono font-semibold text-sm ${color}`}>{Math.round(score)}/100</span>;
}

export default function Dashboard() {
  const [, setLocation] = useLocation();
  const { user } = useUser();

  const reviews = useListReviews({ query: { queryKey: getListReviewsQueryKey() } });
  const summary = useGetDashboardSummary({ query: { queryKey: getGetDashboardSummaryQueryKey() } });
  const activity = useGetRecentActivity({ query: { queryKey: getGetRecentActivityQueryKey() } });

  const stats = [
    { label: "Total Reviews", value: summary.data?.totalReviews ?? 0, icon: Code2, color: "text-purple-400" },
    { label: "Completed", value: summary.data?.completedReviews ?? 0, icon: CheckCircle, color: "text-green-400" },
    { label: "Total Issues", value: summary.data?.totalIssues ?? 0, icon: AlertTriangle, color: "text-yellow-400" },
    { label: "Critical Issues", value: summary.data?.criticalIssues ?? 0, icon: Shield, color: "text-red-400" },
  ];

  return (
    <div className="min-h-screen bg-background">
      {/* Navbar */}
      <header className="border-b border-white/5 sticky top-0 z-10 bg-background/80 backdrop-blur-md">
        <div className="max-w-7xl mx-auto px-6 h-14 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Code2 size={20} className="text-purple-400" />
            <span className="font-semibold text-white">Code Insight</span>
          </div>
          <div className="flex items-center gap-4">
            <Button
              onClick={() => setLocation("/analyze")}
              data-testid="button-new-analysis"
              className="bg-purple-600 hover:bg-purple-500 text-white text-sm h-8 px-4"
            >
              <Plus size={15} className="mr-1" /> New Analysis
            </Button>
            <UserButton afterSignOutUrl="/" />
          </div>
        </div>
      </header>

      <main className="max-w-7xl mx-auto px-6 py-8">
        {/* Welcome */}
        <motion.div
          initial={{ opacity: 0, y: 16 }}
          animate={{ opacity: 1, y: 0 }}
          className="mb-8"
        >
          <h1 className="text-2xl font-bold text-white">
            Welcome back{user?.firstName ? `, ${user.firstName}` : ""}
          </h1>
          <p className="text-muted-foreground text-sm mt-1">Here's an overview of your code reviews.</p>
        </motion.div>

        {/* Stats */}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
          {stats.map((stat, i) => (
            <motion.div
              key={stat.label}
              initial={{ opacity: 0, y: 16 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: i * 0.07 }}
              className="glass rounded-xl p-4"
            >
              <div className="flex items-center gap-2 mb-2">
                <stat.icon size={16} className={stat.color} />
                <span className="text-muted-foreground text-xs">{stat.label}</span>
              </div>
              {summary.isLoading ? (
                <Skeleton className="h-7 w-12" />
              ) : (
                <span className="text-2xl font-bold text-white">{stat.value}</span>
              )}
            </motion.div>
          ))}
        </div>

        <div className="grid lg:grid-cols-3 gap-6">
          {/* Reviews list */}
          <div className="lg:col-span-2">
            <div className="flex items-center justify-between mb-4">
              <h2 className="font-semibold text-white">Your Reviews</h2>
              {reviews.data && reviews.data.length > 0 && (
                <span className="text-muted-foreground text-xs">{reviews.data.length} reviews</span>
              )}
            </div>

            {reviews.isLoading && (
              <div className="space-y-3">
                {[1, 2, 3].map((i) => (
                  <Skeleton key={i} className="h-20 w-full rounded-xl" />
                ))}
              </div>
            )}

            {!reviews.isLoading && (!reviews.data || reviews.data.length === 0) && (
              <motion.div
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                className="glass rounded-xl p-12 text-center"
              >
                <Code2 size={36} className="text-purple-400/50 mx-auto mb-4" />
                <h3 className="font-medium text-white mb-2">No reviews yet</h3>
                <p className="text-muted-foreground text-sm mb-6">Submit your first repo for AI analysis</p>
                <Button
                  onClick={() => setLocation("/analyze")}
                  data-testid="button-first-analysis"
                  className="bg-purple-600 hover:bg-purple-500 text-white"
                >
                  <Plus size={16} className="mr-2" /> Start Analysis
                </Button>
              </motion.div>
            )}

            {reviews.data && reviews.data.length > 0 && (
              <div className="space-y-3">
                {reviews.data.map((review, i) => (
                  <motion.div
                    key={review.id}
                    initial={{ opacity: 0, y: 10 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: i * 0.05 }}
                    onClick={() => {
                      if (review.status === "processing" || review.status === "queued") {
                        setLocation(`/reviews/${review.id}/processing`);
                      } else {
                        setLocation(`/reviews/${review.id}`);
                      }
                    }}
                    data-testid={`card-review-${review.id}`}
                    className="glass rounded-xl p-4 cursor-pointer hover:border-white/15 hover:bg-white/3 transition-all duration-200"
                  >
                    <div className="flex items-start justify-between gap-4">
                      <div className="min-w-0">
                        <h3 className="font-medium text-white truncate">
                          {review.repoName ?? review.repoUrl ?? "Unknown repo"}
                        </h3>
                        <p className="text-muted-foreground text-xs mt-0.5 font-mono truncate">
                          {review.repoUrl ?? review.repoType}
                        </p>
                      </div>
                      <div className="flex flex-col items-end gap-2 shrink-0">
                        <StatusBadge status={review.status} />
                        <HealthScore score={review.healthScore} />
                      </div>
                    </div>
                    <div className="flex items-center gap-4 mt-3 text-xs text-muted-foreground">
                      {review.totalIssues != null && (
                        <span>{review.totalIssues} issues</span>
                      )}
                      {review.fileCount != null && (
                        <span>{review.fileCount} files</span>
                      )}
                      <span>{new Date(review.createdAt).toLocaleDateString()}</span>
                    </div>
                  </motion.div>
                ))}
              </div>
            )}
          </div>

          {/* Recent activity */}
          <div>
            <div className="flex items-center gap-2 mb-4">
              <Activity size={16} className="text-purple-400" />
              <h2 className="font-semibold text-white">Recent Activity</h2>
            </div>
            <div className="glass rounded-xl overflow-hidden">
              {activity.isLoading && (
                <div className="p-4 space-y-3">
                  {[1, 2, 3].map((i) => <Skeleton key={i} className="h-12 w-full" />)}
                </div>
              )}
              {!activity.isLoading && (!activity.data || activity.data.length === 0) && (
                <div className="p-6 text-center text-muted-foreground text-sm">No activity yet</div>
              )}
              {activity.data && activity.data.map((item, i) => (
                <div
                  key={item.id}
                  className="px-4 py-3 border-b border-white/5 last:border-0 hover:bg-white/3 transition-colors"
                >
                  <div className="flex items-center justify-between gap-2">
                    <span className="text-sm text-white truncate">{item.repoName}</span>
                    <StatusBadge status={item.status} />
                  </div>
                  {item.healthScore != null && (
                    <div className="mt-1">
                      <HealthScore score={item.healthScore} />
                    </div>
                  )}
                </div>
              ))}
            </div>
          </div>
        </div>
      </main>
    </div>
  );
}
