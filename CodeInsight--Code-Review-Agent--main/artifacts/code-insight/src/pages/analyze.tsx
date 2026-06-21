import { useState, useRef, useCallback } from "react";
import { useLocation } from "wouter";
import { motion } from "framer-motion";
import { UserButton } from "@clerk/react";
import {
  useCreateReview,
  useGetGithubRepoInfo,
  getGetGithubRepoInfoQueryKey,
} from "@workspace/api-client-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useQueryClient } from "@tanstack/react-query";
import {
  Code2,
  ArrowLeft,
  Github,
  Link,
  Upload,
  Star,
  GitBranch,
  Globe,
  Loader2,
  Lock,
  FileArchive,
} from "lucide-react";

type Tab = "github" | "git_url" | "zip";

function useDebounce<T>(value: T, delay: number): T {
  const [debouncedValue, setDebouncedValue] = useState(value);
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const update = useCallback(
    (v: T) => {
      if (timerRef.current) clearTimeout(timerRef.current);
      timerRef.current = setTimeout(() => setDebouncedValue(v), delay);
    },
    [delay]
  );

  return debouncedValue;
}

export default function AnalyzePage() {
  const [, setLocation] = useLocation();
  const queryClient = useQueryClient();
  const [activeTab, setActiveTab] = useState<Tab>("github");
  const [githubUrl, setGithubUrl] = useState("");
  const [gitUrl, setGitUrl] = useState("");
  const [prUrl, setPrUrl] = useState("");
  const [prMode, setPrMode] = useState(false);
  const [zipFile, setZipFile] = useState<File | null>(null);
  const [dragOver, setDragOver] = useState(false);
  const [zipProgress, setZipProgress] = useState(0);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const debouncedGithubUrl = useDebounce(githubUrl, 500);
  const isValidGithubUrl = debouncedGithubUrl.includes("github.com");

  const repoInfo = useGetGithubRepoInfo(
    { url: debouncedGithubUrl },
    {
      query: {
        enabled: isValidGithubUrl,
        queryKey: getGetGithubRepoInfoQueryKey({ url: debouncedGithubUrl }),
        retry: false,
      },
    }
  );

  const createReview = useCreateReview({
    mutation: {
      onSuccess: (review) => {
        queryClient.invalidateQueries({ queryKey: ["listReviews"] });
        setLocation(`/reviews/${review.id}/processing`);
      },
    },
  });

  const handleSubmit = () => {
    if (activeTab === "github" && githubUrl) {
      createReview.mutate({
        data: {
          repoUrl: githubUrl,
          repoName: repoInfo.data?.fullName ?? githubUrl.split("/").slice(-2).join("/"),
          repoType: "github",
          prUrl: prMode && prUrl ? prUrl : null,
        },
      });
    } else if (activeTab === "git_url" && gitUrl) {
      createReview.mutate({
        data: {
          repoUrl: gitUrl,
          repoName: gitUrl.replace(/\.git$/, "").split("/").pop() ?? "repo",
          repoType: "git_url",
        },
      });
    } else if (activeTab === "zip" && zipFile) {
      createReview.mutate({
        data: {
          repoName: zipFile.name.replace(/\.zip$/, ""),
          repoType: "zip",
        },
      });
    }
  };

  const canSubmit =
    (activeTab === "github" && githubUrl.length > 5) ||
    (activeTab === "git_url" && gitUrl.length > 5) ||
    (activeTab === "zip" && !!zipFile);

  const tabs = [
    { id: "github" as Tab, label: "GitHub / GitLab", icon: Github },
    { id: "git_url" as Tab, label: "Git URL", icon: Link },
    { id: "zip" as Tab, label: "ZIP Upload", icon: Upload },
  ];

  return (
    <div className="min-h-screen bg-background">
      <header className="border-b border-white/5 sticky top-0 z-10 bg-background/80 backdrop-blur-md">
        <div className="max-w-7xl mx-auto px-6 h-14 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <button
              onClick={() => setLocation("/dashboard")}
              data-testid="button-back-dashboard"
              className="text-muted-foreground hover:text-white transition-colors"
            >
              <ArrowLeft size={18} />
            </button>
            <Code2 size={20} className="text-purple-400" />
            <span className="font-semibold text-white">New Analysis</span>
          </div>
          <UserButton afterSignOutUrl="/" />
        </div>
      </header>

      <main className="max-w-2xl mx-auto px-6 py-12">
        <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }}>
          <h1 className="text-2xl font-bold text-white mb-2">Analyze your code</h1>
          <p className="text-muted-foreground text-sm mb-8">
            Submit a repository for AI-powered security, quality, and architecture review.
          </p>

          {/* Tabs */}
          <div className="flex gap-1 p-1 glass rounded-xl mb-6">
            {tabs.map((tab) => (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id)}
                data-testid={`tab-${tab.id}`}
                className={`flex-1 flex items-center justify-center gap-2 px-3 py-2 rounded-lg text-sm font-medium transition-all duration-200 ${
                  activeTab === tab.id
                    ? "bg-purple-600 text-white"
                    : "text-muted-foreground hover:text-white hover:bg-white/5"
                }`}
              >
                <tab.icon size={15} />
                <span className="hidden sm:inline">{tab.label}</span>
              </button>
            ))}
          </div>

          {/* Tab content */}
          <div className="glass rounded-xl p-6">
            {activeTab === "github" && (
              <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="space-y-4">
                <div>
                  <label className="text-sm text-muted-foreground block mb-2">Repository URL</label>
                  <Input
                    value={githubUrl}
                    onChange={(e) => setGithubUrl(e.target.value)}
                    placeholder="https://github.com/owner/repo"
                    data-testid="input-github-url"
                    className="bg-muted border-white/10 text-white placeholder:text-muted-foreground/50 font-mono text-sm"
                  />
                </div>

                {/* Repo info card */}
                {isValidGithubUrl && (
                  <motion.div
                    initial={{ opacity: 0, y: 8 }}
                    animate={{ opacity: 1, y: 0 }}
                    className="rounded-lg bg-white/3 border border-white/5 p-4"
                  >
                    {repoInfo.isLoading && (
                      <div className="flex items-center gap-2 text-muted-foreground text-sm">
                        <Loader2 size={14} className="animate-spin" />
                        Fetching repository info...
                      </div>
                    )}
                    {repoInfo.isError && (
                      <div className="flex items-center gap-2 text-red-400 text-sm">
                        <Lock size={14} />
                        Repository not found or private
                      </div>
                    )}
                    {repoInfo.data && (
                      <div className="space-y-2">
                        <div className="flex items-start justify-between gap-4">
                          <div>
                            <p className="font-semibold text-white text-sm">{repoInfo.data.fullName}</p>
                            {repoInfo.data.description && (
                              <p className="text-muted-foreground text-xs mt-1">{repoInfo.data.description}</p>
                            )}
                          </div>
                          {repoInfo.data.isPrivate && (
                            <span className="text-xs px-2 py-0.5 rounded border border-orange-500/30 bg-orange-500/10 text-orange-400">
                              Private
                            </span>
                          )}
                        </div>
                        <div className="flex items-center gap-4 text-xs text-muted-foreground">
                          <span className="flex items-center gap-1">
                            <Star size={12} />
                            {repoInfo.data.stars.toLocaleString()}
                          </span>
                          <span className="flex items-center gap-1">
                            <GitBranch size={12} />
                            {repoInfo.data.defaultBranch}
                          </span>
                          {repoInfo.data.language && (
                            <span className="flex items-center gap-1">
                              <Globe size={12} />
                              {repoInfo.data.language}
                            </span>
                          )}
                        </div>
                      </div>
                    )}
                  </motion.div>
                )}

                {/* PR mode */}
                <label className="flex items-center gap-3 cursor-pointer group">
                  <input
                    type="checkbox"
                    checked={prMode}
                    onChange={(e) => setPrMode(e.target.checked)}
                    data-testid="checkbox-pr-mode"
                    className="w-4 h-4 rounded accent-purple-500"
                  />
                  <span className="text-sm text-muted-foreground group-hover:text-white transition-colors">
                    Review PR (diff-aware analysis)
                  </span>
                </label>

                {prMode && (
                  <motion.div initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: "auto" }}>
                    <label className="text-sm text-muted-foreground block mb-2">Pull Request URL</label>
                    <Input
                      value={prUrl}
                      onChange={(e) => setPrUrl(e.target.value)}
                      placeholder="https://github.com/owner/repo/pull/123"
                      data-testid="input-pr-url"
                      className="bg-muted border-white/10 text-white placeholder:text-muted-foreground/50 font-mono text-sm"
                    />
                  </motion.div>
                )}
              </motion.div>
            )}

            {activeTab === "git_url" && (
              <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }}>
                <label className="text-sm text-muted-foreground block mb-2">Git Clone URL</label>
                <Input
                  value={gitUrl}
                  onChange={(e) => setGitUrl(e.target.value)}
                  placeholder="https://gitlab.com/owner/repo.git"
                  data-testid="input-git-url"
                  className="bg-muted border-white/10 text-white placeholder:text-muted-foreground/50 font-mono text-sm"
                />
                <p className="text-muted-foreground text-xs mt-2">
                  Supports any public Git repository URL ending in .git
                </p>
              </motion.div>
            )}

            {activeTab === "zip" && (
              <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }}>
                <div
                  onDragOver={(e) => { e.preventDefault(); setDragOver(true); }}
                  onDragLeave={() => setDragOver(false)}
                  onDrop={(e) => {
                    e.preventDefault();
                    setDragOver(false);
                    const file = e.dataTransfer.files[0];
                    if (file?.name.endsWith(".zip")) setZipFile(file);
                  }}
                  onClick={() => fileInputRef.current?.click()}
                  data-testid="drop-zone-zip"
                  className={`border-2 border-dashed rounded-xl p-12 text-center cursor-pointer transition-all duration-200 ${
                    dragOver
                      ? "border-purple-500 bg-purple-500/10"
                      : "border-white/10 hover:border-white/20 hover:bg-white/3"
                  }`}
                >
                  <input
                    ref={fileInputRef}
                    type="file"
                    accept=".zip"
                    className="hidden"
                    onChange={(e) => {
                      const file = e.target.files?.[0];
                      if (file) setZipFile(file);
                    }}
                  />
                  {zipFile ? (
                    <div className="space-y-2">
                      <FileArchive size={36} className="text-purple-400 mx-auto" />
                      <p className="text-white font-medium">{zipFile.name}</p>
                      <p className="text-muted-foreground text-sm">
                        {(zipFile.size / 1024 / 1024).toFixed(2)} MB
                      </p>
                    </div>
                  ) : (
                    <div className="space-y-2">
                      <Upload size={36} className="text-muted-foreground mx-auto" />
                      <p className="text-white font-medium">Drag & drop your ZIP file</p>
                      <p className="text-muted-foreground text-sm">or click to browse</p>
                    </div>
                  )}
                </div>
              </motion.div>
            )}
          </div>

          {/* Submit */}
          <div className="mt-6">
            <Button
              onClick={handleSubmit}
              disabled={!canSubmit || createReview.isPending}
              data-testid="button-submit-analysis"
              className="w-full bg-purple-600 hover:bg-purple-500 text-white h-12 text-base font-semibold disabled:opacity-40"
            >
              {createReview.isPending ? (
                <><Loader2 size={18} className="mr-2 animate-spin" /> Submitting...</>
              ) : (
                "Start Analysis"
              )}
            </Button>
          </div>
        </motion.div>
      </main>
    </div>
  );
}
