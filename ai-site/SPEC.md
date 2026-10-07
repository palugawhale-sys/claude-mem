# Pagewright — marketing site spec

Pagewright is a (fictional) company that builds websites with AI: you describe your business in a sentence, it generates a site you can edit and publish.

This is a standalone project inside `ai-site/`. It is **not** part of claude-mem — don't import from `../src`, and don't follow claude-mem's repo rules beyond normal good practice.

## Stack

- Runtime: Bun (`bun run ai-site/server.ts`), no npm dependencies.
- Backend: `ai-site/server.ts` using `Bun.serve`. Serves `ai-site/public/` as static files and the JSON API below.
- Frontend: plain HTML/CSS/JS in `ai-site/public/` (`index.html`, `styles.css`, `app.js`). No build step, no frameworks.
- Tests: `ai-site/tests/*.test.ts` with `bun:test`. Run with `bun test ai-site/tests`.

## Backend structure (so it's testable without a port)

- `ai-site/data/plans.ts` — exports `plans`
- `ai-site/data/examples.ts` — exports `examples`
- `ai-site/api.ts` — exports `handleRequest(req: Request): Promise<Response>` (API + static files) and `resetWaitlist()` for tests
- `ai-site/server.ts` — only calls `Bun.serve({ port: Number(process.env.PORT) || 3000, fetch: handleRequest })` and logs the URL

## API contract

All JSON responses use `Content-Type: application/json`. Errors are `{ "error": string }`.

### `GET /api/plans` → 200
```json
{ "plans": [ {
  "id": "starter",            // "starter" | "pro" | "business"
  "name": "Starter",
  "priceMonthly": 0,          // USD per month, billed monthly
  "priceYearly": 0,           // USD per month, billed yearly (≈20% off)
  "tagline": "string",
  "features": ["string"],
  "cta": "string",            // button label
  "highlighted": false        // exactly one plan (pro) is true
} ] }
```
Prices: Starter 0/0, Pro 19/15, Business 49/39.

### `GET /api/examples` → 200
Optional `?category=` filter (case-insensitive). Unknown category → `{ "examples": [] }`.
```json
{ "examples": [ {
  "id": "string",
  "title": "Bloom Bakery",
  "category": "Restaurant",   // Restaurant | Portfolio | Shop | Fitness | Agency | Event
  "prompt": "A cozy neighborhood bakery ...",  // the one sentence the user typed
  "description": "string",
  "accent": "#e07a5f",        // hex color used for the preview card
  "sections": ["Hero", "Menu", "Hours", "Contact"]
} ] }
```
At least 6 examples, one per category.

### `POST /api/generate` body `{ "prompt": string }`
A deterministic demo (no real AI): picks a category from keywords in the prompt (fallback "Agency"), and returns a mock site outline.
- 200 → `{ "title": string, "category": string, "accent": string, "sections": string[], "headline": string }`
- 400 if prompt missing, not a string, blank after trim, or longer than 300 chars.

### `POST /api/waitlist` body `{ "email": string, "plan"?: "starter" | "pro" | "business" }`
In-memory store.
- 201 → `{ "ok": true }`
- 400 invalid email, invalid plan, or bad JSON
- 409 email already on the list (case-insensitive)

### Anything else
- Unknown `/api/*` → 404 JSON. Wrong method on a known API path → 405 JSON.
- Other paths → static file from `public/` (`/` → `index.html`), 404 if missing. Must not allow path traversal outside `public/`.

## Page sections (frontend)

1. Nav: logo, links to Examples / Pricing / FAQ, "Get started" button.
2. Hero: headline, subhead, a prompt box ("Describe your website…") that calls `/api/generate` and renders a live mock preview card using the returned accent, title, headline and sections.
3. "How it works": 3 steps (Describe → Generate → Publish).
4. Examples: grid from `/api/examples` with category filter chips; each card shows the prompt that made it.
5. Pricing: cards from `/api/plans`, monthly/yearly toggle, highlighted Pro plan.
6. FAQ: 4–5 questions, accessible accordion (`<details>`).
7. Waitlist/CTA: email form + plan select → `/api/waitlist`, show success/error messages (incl. 409).
8. Footer.

Requirements: responsive down to 360px, light/dark via `prefers-color-scheme`, keyboard accessible, loading and error states for every fetch.
