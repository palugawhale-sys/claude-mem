# Pagewright — demo marketing site

Landing page for a fictional AI website builder. Built by the frontend-dev / backend-dev / qa agents in `.claude/agents/`.

```bash
bun run ai-site/server.ts          # http://localhost:3000  (PORT=xxxx to change)
bun test ai-site/tests             # API tests
```

- `public/` — the page (plain HTML/CSS/JS)
- `api.ts`, `server.ts`, `data/` — Bun server and JSON API (see `SPEC.md`)
- `screenshots/` — QA screenshots

The "generate" demo is keyword-based, not a real AI model; the waitlist is in-memory.
