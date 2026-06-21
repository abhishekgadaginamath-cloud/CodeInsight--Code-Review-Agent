# Code Insight — AI Code Review SaaS

## Architecture

**Monorepo** managed by pnpm workspaces.

### Artifacts
- `artifacts/code-insight` — React+Vite frontend (port from env `PORT`, base path `/`)
- `artifacts/api-server` — Express backend (port `8080`, path `/api`, WebSocket at `/ws`)
- `artifacts/mockup-sandbox` — Component canvas preview server

### Shared Libraries
- `lib/api-spec` — OpenAPI YAML specification
- `lib/api-client-react` — React Query hooks + custom fetch (orval codegen)
- `lib/api-zod` — Zod validation schemas (orval codegen)
- `lib/db` — Drizzle ORM schema + PostgreSQL client
- `lib/integrations-anthropic-ai` — Anthropic AI client via Replit AI integration

## Tech Stack
- **Frontend**: React 19, Vite 7, TailwindCSS v4, Framer Motion, Wouter, Clerk React
- **Backend**: Express, Pino logger, ws (WebSocket), Clerk Express, Drizzle ORM
- **AI**: Anthropic Claude via Replit AI Integrations proxy
- **Auth**: Clerk (GitHub + Google OAuth)
- **DB**: PostgreSQL (Replit-provisioned), Drizzle ORM

## Pages
- `/` — Landing page (public, particle canvas, hero, features, CTA)
- `/sign-in/*?` — Clerk sign-in
- `/sign-up/*?` — Clerk sign-up
- `/dashboard` — Auth required. Lists reviews with stats
- `/analyze` — Auth required. Submit repo (GitHub URL, Git URL, ZIP)
- `/reviews/:id/processing` — Real-time progress with WebSocket
- `/reviews/:id` — 3-panel results: file tree, issues list, issue detail with diff

## API Routes (`/api`)
- `GET /api/healthz`
- `GET /api/reviews` — List user's reviews
- `POST /api/reviews` — Create review + start AI pipeline
- `GET /api/reviews/:id` — Get review with issues
- `POST /api/reviews/:id/cancel`
- `GET /api/reviews/:id/patch` — Download unified diff patch
- `GET /api/dashboard/summary`
- `GET /api/dashboard/recent-activity`
- `GET /api/github/repo-info?url=...`
- `WS /ws/reviews/:id` — WebSocket progress stream

## Database Schema (`lib/db/src/schema`)
- `reviews` — id, userId, repoUrl, repoName, repoType, prUrl, status, healthScore, totalIssues, criticalIssues, fileCount, linesAnalyzed, currentStep, createdAt, updatedAt
- `issues` — id, reviewId, category, severity, file, line, title, description, explanation, oldCode, newCode, fixSuggestion, createdAt

## Review Pipeline (`artifacts/api-server/src/lib/reviewPipeline.ts`)
3 AI agents run in parallel via Anthropic Claude:
1. Security Agent — vulnerabilities, auth issues, injection risks
2. Code Smell Agent — antipatterns, maintainability, complexity
3. Architecture Agent — design, coupling, structural issues

Emits WebSocket events: `progress`, `completed`, `error`

## Environment Variables
- `CLERK_SECRET_KEY`, `CLERK_PUBLISHABLE_KEY` — Clerk server/client keys
- `VITE_CLERK_PUBLISHABLE_KEY` — Clerk publishable key for frontend
- `AI_INTEGRATIONS_ANTHROPIC_BASE_URL`, `AI_INTEGRATIONS_ANTHROPIC_API_KEY` — Anthropic via Replit
- `DATABASE_URL` — PostgreSQL connection string
- `SESSION_SECRET` — Session secret
- `PORT`, `BASE_PATH` — Injected by Replit workflow system

## Key Conventions
- **Never use console.log in server code** — use `req.log` (in routes) or `logger` singleton
- All hook imports from `@workspace/api-client-react`
- All Zod schemas from `@workspace/api-zod`
- Run `pnpm --filter @workspace/api-spec run codegen` after OpenAPI changes
- Run `pnpm --filter @workspace/db run push` after schema changes
