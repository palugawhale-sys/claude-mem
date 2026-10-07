import { resolve, sep, join } from "node:path";
import { plans } from "./data/plans";
import { examples } from "./data/examples";

const PUBLIC_DIR = resolve(import.meta.dir, "public");
const PLAN_IDS = plans.map((p) => p.id as string);
const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

const waitlist = new Set<string>();

export function resetWaitlist(): void {
  waitlist.clear();
}

function json(body: unknown, status = 200, headers: Record<string, string> = {}): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json", ...headers },
  });
}

function err(message: string, status: number, headers: Record<string, string> = {}): Response {
  return json({ error: message }, status, headers);
}

const CATEGORY_KEYWORDS: Array<[string, string[], string, string[]]> = [
  ["Restaurant", ["restaurant", "cafe", "café", "bakery", "coffee", "bistro", "pizza", "food truck", "catering", "bar ", "menu", "kitchen"], "#e07a5f", ["Hero", "Menu", "Hours", "Reservations", "Contact"]],
  ["Portfolio", ["portfolio", "photographer", "photography", "illustrator", "designer", "artist", "freelance", "writer", "resume"], "#6d597a", ["Hero", "Selected Work", "About", "Contact"]],
  ["Shop", ["shop", "store", "sell", "selling", "boutique", "ecommerce", "e-commerce", "products", "handmade", "merch"], "#2a9d8f", ["Hero", "Featured Products", "Collections", "Reviews", "Checkout"]],
  ["Fitness", ["fitness", "gym", "yoga", "workout", "trainer", "coach", "pilates", "crossfit", "running"], "#e63946", ["Hero", "Classes", "Coaches", "Membership", "Free Trial"]],
  ["Event", ["event", "conference", "festival", "wedding", "meetup", "concert", "party", "tickets", "market"], "#f4a261", ["Hero", "Schedule", "Speakers", "Venue", "Tickets"]],
  ["Agency", ["agency", "consulting", "consultancy", "studio", "marketing", "startup", "firm"], "#3d5a80", ["Hero", "Services", "Projects", "Process", "Contact"]],
];

// Whole-word matcher: unicode-aware boundaries, optional simple inflection
// (s / es / ing, and y -> ies), multi-word phrases allow any whitespace between words.
function keywordRegex(word: string): RegExp {
  const esc = (s: string) => s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  const phrase = (s: string) => s.trim().split(/\s+/).map(esc).join("\\s+");
  const base = phrase(word);
  const stem = /[^aeiou]y$/i.test(word.trim()) ? `(?:${phrase(word.trim().slice(0, -1))}ies|${base}s?)` : `${base}(?:s|es|ing)?`;
  return new RegExp(`(?<![\\p{L}\\p{N}])${stem}(?![\\p{L}\\p{N}])`, "iu");
}

const CATEGORY_MATCHERS = CATEGORY_KEYWORDS.map(([, words]) => words.map(keywordRegex));

function classify(prompt: string): number {
  // Score = number of distinct keywords found; highest wins, ties go to the earliest category.
  let best = -1;
  let bestScore = 0;
  CATEGORY_MATCHERS.forEach((matchers, i) => {
    const score = matchers.reduce((n, re) => n + (re.test(prompt) ? 1 : 0), 0);
    if (score > bestScore) {
      best = i;
      bestScore = score;
    }
  });
  return best >= 0 ? best : CATEGORY_KEYWORDS.findIndex(([c]) => c === "Agency");
}

function generate(prompt: string) {
  const match = CATEGORY_KEYWORDS[classify(prompt)];
  const [category, , accent, sections] = match;

  // Title: first up-to-3 meaningful words, title-cased.
  const stop = new Set(["a", "an", "the", "for", "of", "and", "to", "with", "that", "my", "our", "i", "we", "is", "in", "on", "by", "who", "which", "sells", "sell", "selling", "makes", "make", "about", "want", "need"]);
  const words = prompt.replace(/[^\p{L}\p{N}\s'-]/gu, " ").split(/\s+/).filter((w) => w && !stop.has(w.toLowerCase())).slice(0, 2);
  const base = words.map((w) => w[0].toUpperCase() + w.slice(1).toLowerCase()).join(" ") || "Your";
  const suffix: Record<string, string> = { Restaurant: "Kitchen", Portfolio: "Portfolio", Shop: "Shop", Fitness: "Fitness", Agency: "Studio", Event: "Live" };
  const title = `${base} ${suffix[category]}`;

  const headlines: Record<string, string> = {
    Restaurant: "Fresh, local and made with love.",
    Portfolio: "Work that speaks for itself.",
    Shop: "Beautiful things, delivered to your door.",
    Fitness: "Stronger every single day.",
    Agency: "Ideas that move your business forward.",
    Event: "One unforgettable experience. Save your spot.",
  };
  return { title, category, accent, sections: [...sections], headline: headlines[category] };
}

async function readJson(req: Request): Promise<{ ok: true; body: any } | { ok: false }> {
  try {
    const body = await req.json();
    if (body === null || typeof body !== "object" || Array.isArray(body)) return { ok: false };
    return { ok: true, body };
  } catch {
    return { ok: false };
  }
}

async function serveStatic(req: Request, pathname: string): Promise<Response> {
  if (req.method !== "GET" && req.method !== "HEAD") {
    return err("Method not allowed", 405, { Allow: "GET, HEAD" });
  }
  let decoded: string;
  try {
    decoded = decodeURIComponent(pathname);
  } catch {
    return err("Not found", 404);
  }
  if (decoded.includes("\0") || decoded.includes("\\")) return err("Not found", 404);
  if (decoded.endsWith("/")) decoded += "index.html";
  const full = resolve(join(PUBLIC_DIR, decoded));
  if (full !== PUBLIC_DIR && !full.startsWith(PUBLIC_DIR + sep)) return err("Not found", 404);
  const file = Bun.file(full);
  if (!(await file.exists())) return err("Not found", 404);
  try {
    return new Response(req.method === "HEAD" ? null : file, { headers: { "Content-Type": file.type } });
  } catch {
    return err("Not found", 404);
  }
}

export async function handleRequest(req: Request): Promise<Response> {
  const { pathname, searchParams } = new URL(req.url);
  const method = req.method;

  if (pathname === "/api" || pathname.startsWith("/api/")) {
    const path = pathname.replace(/\/+$/, "");
    switch (path) {
      case "/api/plans":
        if (method !== "GET") return err("Method not allowed", 405, { Allow: "GET" });
        return json({ plans });
      case "/api/examples": {
        if (method !== "GET") return err("Method not allowed", 405, { Allow: "GET" });
        const category = searchParams.get("category");
        const list = category === null || category === ""
          ? examples
          : examples.filter((e) => e.category.toLowerCase() === category.trim().toLowerCase());
        return json({ examples: list });
      }
      case "/api/generate": {
        if (method !== "POST") return err("Method not allowed", 405, { Allow: "POST" });
        const r = await readJson(req);
        if (!r.ok) return err("Invalid JSON body", 400);
        const prompt = r.body.prompt;
        if (typeof prompt !== "string") return err("prompt is required and must be a string", 400);
        const trimmed = prompt.trim();
        if (!trimmed) return err("prompt must not be blank", 400);
        if (trimmed.length > 300) return err("prompt must be at most 300 characters", 400);
        return json(generate(trimmed));
      }
      case "/api/waitlist": {
        if (method !== "POST") return err("Method not allowed", 405, { Allow: "POST" });
        const r = await readJson(req);
        if (!r.ok) return err("Invalid JSON body", 400);
        const { email, plan } = r.body;
        if (typeof email !== "string" || email.trim().length > 254 || !EMAIL_RE.test(email.trim())) {
          return err("A valid email is required", 400);
        }
        if (plan !== undefined && (typeof plan !== "string" || !PLAN_IDS.includes(plan))) {
          return err("plan must be one of: " + PLAN_IDS.join(", "), 400);
        }
        const key = email.trim().toLowerCase();
        if (waitlist.has(key)) return err("This email is already on the waitlist", 409);
        waitlist.add(key);
        return json({ ok: true }, 201);
      }
      default:
        return err("Not found", 404);
    }
  }

  return serveStatic(req, pathname);
}
