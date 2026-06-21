import { Router } from "express";
import { getAuth } from "@clerk/express";
import { GetGithubRepoInfoQueryParams } from "@workspace/api-zod";

const router = Router();

router.get("/repo-info", async (req, res): Promise<void> => {
  const { userId } = getAuth(req);
  if (!userId) {
    res.status(401).json({ error: "Unauthorized" });
    return;
  }

  const parsed = GetGithubRepoInfoQueryParams.safeParse(req.query);
  if (!parsed.success) {
    res.status(400).json({ error: "url parameter required" });
    return;
  }

  const { url } = parsed.data;

  try {
    const match = url.match(/github\.com\/([^/]+\/[^/]+)/);
    if (!match) {
      res.status(400).json({ error: "Invalid GitHub URL" });
      return;
    }

    const repoPath = match[1].replace(/\.git$/, "");
    const ghRes = await fetch(`https://api.github.com/repos/${repoPath}`, {
      headers: {
        Accept: "application/vnd.github.v3+json",
        "User-Agent": "Code-Insight",
      },
    });

    if (!ghRes.ok) {
      res.status(400).json({ error: "Failed to fetch repo info. Repository may be private or not found." });
      return;
    }

    const data = (await ghRes.json()) as {
      name: string;
      full_name: string;
      description: string | null;
      stargazers_count: number;
      language: string | null;
      private: boolean;
      default_branch: string;
      open_issues_count: number;
    };

    res.json({
      name: data.name,
      fullName: data.full_name,
      description: data.description ?? null,
      stars: data.stargazers_count,
      language: data.language ?? null,
      isPrivate: data.private,
      defaultBranch: data.default_branch,
      openPRs: data.open_issues_count,
    });
  } catch (err) {
    req.log.error({ err }, "Failed to fetch GitHub repo info");
    res.status(500).json({ error: "Internal server error" });
  }
});

export default router;
