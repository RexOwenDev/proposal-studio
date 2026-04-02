@AGENTS.md

# Proposal Studio

## Stack
- Next.js 16 (App Router) with React 19 + React Compiler
- TypeScript strict mode
- Tailwind CSS v4 for app UI — proposal CSS is preserved separately
- Tiptap (headless rich text editor) for inline editing
- Supabase (PostgreSQL + Auth + Storage) — project ref: vjtpykjmrukhypghzqnt
- Deployed on Vercel

## Critical Rules
1. NEVER modify imported proposal HTML/CSS — preserve pixel-perfectly
2. Auth uses Supabase Magic Link — no passwords
3. Public view (/p/[slug]) requires NO auth
4. Auto-save with debounce — no manual save buttons
5. No drag-and-drop — click-to-edit only
6. Design Shopp is a PE client — data flows through Claude models ONLY
7. Use proxy.ts (not middleware.ts) for Next.js 16
8. All request APIs are async: await cookies(), await headers(), await params
