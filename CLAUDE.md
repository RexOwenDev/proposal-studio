@AGENTS.md

# Proposal Studio

## Stack
- Next.js 16 (App Router) with React 19 + React Compiler
- TypeScript strict mode
- Tailwind CSS v4 for app UI — proposal CSS is preserved separately
- Custom block editor (contenteditable-based) for inline editing
- Supabase (PostgreSQL + Auth + Storage)
- Deployed on Vercel

## Critical Rules
1. NEVER modify imported proposal HTML/CSS — preserve pixel-perfectly
2. Auth uses Supabase Magic Link — no passwords
3. Public view (/p/[slug]) requires NO auth
4. Auto-save with debounce — no manual save buttons
5. No drag-and-drop — click-to-edit only
6. Middleware lives in `src/middleware.ts` — it re-exports from `src/proxy.ts`
7. All request APIs are async: await cookies(), await headers(), await params
