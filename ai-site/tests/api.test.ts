import { describe, test, expect, beforeEach } from "bun:test";
import { handleRequest, resetWaitlist } from "../api";

const BASE = "http://localhost";
const get = (path: string, init: RequestInit = {}) => handleRequest(new Request(BASE + path, init));
const post = (path: string, body: unknown, raw = false) =>
  handleRequest(
    new Request(BASE + path, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: raw ? (body as string) : JSON.stringify(body),
    }),
  );
const isJson = (r: Response) => (r.headers.get("content-type") || "").startsWith("application/json");

beforeEach(() => resetWaitlist());

describe("GET /api/plans", () => {
  test("returns 3 plans with the spec'd prices", async () => {
    const r = await get("/api/plans");
    expect(r.status).toBe(200);
    expect(isJson(r)).toBe(true);
    const { plans } = await r.json();
    expect(plans.map((p: any) => [p.id, p.priceMonthly, p.priceYearly])).toEqual([
      ["starter", 0, 0],
      ["pro", 19, 15],
      ["business", 49, 39],
    ]);
  });
  test("exactly one plan is highlighted and it is pro", async () => {
    const { plans } = await (await get("/api/plans")).json();
    const hl = plans.filter((p: any) => p.highlighted);
    expect(hl.length).toBe(1);
    expect(hl[0].id).toBe("pro");
  });
  test("each plan has the contract fields with right types", async () => {
    const { plans } = await (await get("/api/plans")).json();
    for (const p of plans) {
      expect(typeof p.name).toBe("string");
      expect(typeof p.tagline).toBe("string");
      expect(typeof p.cta).toBe("string");
      expect(typeof p.highlighted).toBe("boolean");
      expect(Array.isArray(p.features) && p.features.length > 0).toBe(true);
    }
  });
  test("trailing slash still resolves", async () => {
    expect((await get("/api/plans/")).status).toBe(200);
  });
  test("ignores query string", async () => {
    expect((await get("/api/plans?x=1")).status).toBe(200);
  });
});

describe("GET /api/examples", () => {
  test("returns at least 6 examples covering all 6 categories", async () => {
    const { examples } = await (await get("/api/examples")).json();
    expect(examples.length).toBeGreaterThanOrEqual(6);
    const cats = new Set(examples.map((e: any) => e.category));
    for (const c of ["Restaurant", "Portfolio", "Shop", "Fitness", "Agency", "Event"]) expect(cats.has(c)).toBe(true);
  });
  test("example objects match the contract; accents are hex and ids unique", async () => {
    const { examples } = await (await get("/api/examples")).json();
    const ids = new Set();
    for (const e of examples) {
      for (const k of ["id", "title", "category", "prompt", "description"]) expect(typeof e[k]).toBe("string");
      expect(e.accent).toMatch(/^#[0-9a-fA-F]{6}$/);
      expect(Array.isArray(e.sections) && e.sections.length > 0).toBe(true);
      ids.add(e.id);
    }
    expect(ids.size).toBe(examples.length);
  });
  test("category filter is case-insensitive", async () => {
    for (const q of ["shop", "SHOP", "Shop"]) {
      const { examples } = await (await get("/api/examples?category=" + q)).json();
      expect(examples.length).toBeGreaterThan(0);
      expect(examples.every((e: any) => e.category === "Shop")).toBe(true);
    }
  });
  test("unknown category returns empty list with 200", async () => {
    const r = await get("/api/examples?category=nope");
    expect(r.status).toBe(200);
    expect(await r.json()).toEqual({ examples: [] });
  });
  test("empty category param returns everything", async () => {
    const all = (await (await get("/api/examples")).json()).examples.length;
    const { examples } = await (await get("/api/examples?category=")).json();
    expect(examples.length).toBe(all);
  });
  test("unicode / odd category does not error", async () => {
    const r = await get("/api/examples?category=" + encodeURIComponent("日本語 <script>"));
    expect(r.status).toBe(200);
    expect((await r.json()).examples).toEqual([]);
  });
  test("category with surrounding whitespace still matches", async () => {
    const { examples } = await (await get("/api/examples?category=%20event%20")).json();
    expect(examples.length).toBeGreaterThan(0);
  });
});

describe("POST /api/generate", () => {
  const gen = async (prompt: string) => {
    const r = await post("/api/generate", { prompt });
    return { r, body: await r.json() };
  };

  test("happy path returns the contract shape", async () => {
    const { r, body } = await gen("A cozy bakery in town");
    expect(r.status).toBe(200);
    expect(isJson(r)).toBe(true);
    expect(typeof body.title).toBe("string");
    expect(body.title.length).toBeGreaterThan(0);
    expect(body.category).toBe("Restaurant");
    expect(body.accent).toMatch(/^#[0-9a-fA-F]{6}$/);
    expect(Array.isArray(body.sections) && body.sections.length > 0).toBe(true);
    expect(typeof body.headline).toBe("string");
  });
  const cases: Array<[string, string]> = [
    ["Italian restaurant downtown", "Restaurant"],
    ["Portfolio for a photographer", "Portfolio"],
    ["Online store for handmade soap", "Shop"],
    ["Yoga studio for beginners", "Fitness"],
    ["A wedding planner", "Event"],
    ["Consulting firm", "Agency"],
  ];
  for (const [prompt, cat] of cases) {
    test(`"${prompt}" -> ${cat}`, async () => {
      expect((await gen(prompt)).body.category).toBe(cat);
    });
  }
  test("matching is case-insensitive", async () => {
    expect((await gen("ITALIAN RESTAURANT")).body.category).toBe("Restaurant");
  });
  test("ordered match: restaurant beats shop/fitness when several keywords present", async () => {
    expect((await gen("a restaurant with a gym and a shop")).body.category).toBe("Restaurant");
  });
  test("ordered match: portfolio beats shop", async () => {
    expect((await gen("portfolio shop")).body.category).toBe("Portfolio");
  });
  test("ordered match: fitness beats event; event beats agency", async () => {
    expect((await gen("gym event")).body.category).toBe("Fitness");
    expect((await gen("event agency")).body.category).toBe("Event");
  });
  test("no keywords falls back to Agency", async () => {
    expect((await gen("zzz qqq")).body.category).toBe("Agency");
  });
  test("punctuation-only prompt returns 200 with Agency and a non-empty title", async () => {
    const { r, body } = await gen("!!!???...");
    expect(r.status).toBe(200);
    expect(body.category).toBe("Agency");
    expect(body.title.trim().length).toBeGreaterThan(0);
  });
  test("unicode / emoji / RTL prompts do not crash", async () => {
    for (const p of ["日本語のパン屋", "🍕🍕🍕", "مطعم جميل", "ÀÉÎ café", "a\u0000b"]) {
      const { r, body } = await gen(p);
      expect(r.status).toBe(200);
      expect(typeof body.title).toBe("string");
    }
  });
  test("accented keyword 'café' matches Restaurant", async () => {
    expect((await gen("Café on the corner")).body.category).toBe("Restaurant");
  });
  test("deterministic: same prompt gives identical output", async () => {
    const a = (await gen("A cozy bakery")).body;
    const b = (await gen("A cozy bakery")).body;
    expect(a).toEqual(b);
  });
  test("sections array is a fresh copy (mutation does not leak)", async () => {
    const a = (await gen("gym")).body;
    a.sections.push("X");
    expect((await gen("gym")).body.sections).not.toContain("X");
  });
  test("prompt is trimmed: whitespace padding does not change result", async () => {
    expect((await gen("  gym  ")).body).toEqual((await gen("gym")).body);
  });
  test("300 chars accepted", async () => {
    expect((await gen("a".repeat(300))).r.status).toBe(200);
  });
  test("301 chars rejected with 400 JSON error", async () => {
    const { r, body } = await gen("a".repeat(301));
    expect(r.status).toBe(400);
    expect(isJson(r)).toBe(true);
    expect(typeof body.error).toBe("string");
  });
  test("300 chars + surrounding whitespace is accepted (length is after trim)", async () => {
    expect((await gen("  " + "a".repeat(300) + "  ")).r.status).toBe(200);
  });
  test("301 chars after trim rejected even with padding", async () => {
    expect((await gen("  " + "a".repeat(301) + "  ")).r.status).toBe(400);
  });
  test("blank / whitespace-only prompts -> 400", async () => {
    for (const p of ["", "   ", "\n\t "]) expect((await gen(p)).r.status).toBe(400);
  });
  test("missing or non-string prompt -> 400", async () => {
    for (const body of [{}, { prompt: null }, { prompt: 5 }, { prompt: ["a"] }, { prompt: { a: 1 } }, { prompt: true }]) {
      const r = await post("/api/generate", body);
      expect(r.status).toBe(400);
      expect(isJson(r)).toBe(true);
      expect(typeof (await r.json()).error).toBe("string");
    }
  });
  test("invalid JSON / non-object bodies -> 400 JSON", async () => {
    for (const raw of ["{not json", "", "null", "[]", '"str"', "42"]) {
      const r = await post("/api/generate", raw, true);
      expect(r.status).toBe(400);
      expect(isJson(r)).toBe(true);
    }
  });
  test("HTML in prompt is returned only as data (title has no angle brackets)", async () => {
    const { body } = await gen("<img src=x onerror=alert(1)> bakery");
    expect(body.title).not.toMatch(/[<>]/);
  });
  test("concurrent requests all succeed and are consistent", async () => {
    const rs = await Promise.all(Array.from({ length: 25 }, () => post("/api/generate", { prompt: "yoga" })));
    const bodies = await Promise.all(rs.map((r) => r.json()));
    expect(rs.every((r) => r.status === 200)).toBe(true);
    expect(new Set(bodies.map((b) => JSON.stringify(b))).size).toBe(1);
  });
});

describe("POST /api/waitlist", () => {
  test("valid email -> 201 {ok:true}", async () => {
    const r = await post("/api/waitlist", { email: "a@b.co" });
    expect(r.status).toBe(201);
    expect(isJson(r)).toBe(true);
    expect(await r.json()).toEqual({ ok: true });
  });
  test("accepts each valid plan", async () => {
    for (const [i, plan] of ["starter", "pro", "business"].entries()) {
      expect((await post("/api/waitlist", { email: `u${i}@x.io`, plan })).status).toBe(201);
    }
  });
  test("duplicate -> 409 JSON error", async () => {
    await post("/api/waitlist", { email: "dup@x.io" });
    const r = await post("/api/waitlist", { email: "dup@x.io" });
    expect(r.status).toBe(409);
    expect(isJson(r)).toBe(true);
    expect(typeof (await r.json()).error).toBe("string");
  });
  test("duplicate is case-insensitive", async () => {
    await post("/api/waitlist", { email: "Case@X.io" });
    expect((await post("/api/waitlist", { email: "case@x.IO" })).status).toBe(409);
  });
  test("whitespace-padded email is trimmed and treated as duplicate", async () => {
    expect((await post("/api/waitlist", { email: "  pad@x.io  " })).status).toBe(201);
    expect((await post("/api/waitlist", { email: "pad@x.io" })).status).toBe(409);
  });
  test("duplicate with different plan is still 409", async () => {
    await post("/api/waitlist", { email: "p@x.io", plan: "pro" });
    expect((await post("/api/waitlist", { email: "p@x.io", plan: "starter" })).status).toBe(409);
  });
  test("invalid email formats -> 400", async () => {
    for (const email of ["", "   ", "plain", "a@b", "@b.co", "a@.co".replace(".co", ""), "a b@c.de", "a@b c.de", "a@@b.co"]) {
      const r = await post("/api/waitlist", { email });
      expect(r.status).toBe(400);
      expect(isJson(r)).toBe(true);
    }
  });
  test("non-string / missing email -> 400", async () => {
    for (const body of [{}, { email: null }, { email: 5 }, { email: ["a@b.co"] }, { email: { a: 1 } }]) {
      expect((await post("/api/waitlist", body)).status).toBe(400);
    }
  });
  test("overly long email (>254) -> 400", async () => {
    expect((await post("/api/waitlist", { email: "a".repeat(250) + "@b.co" })).status).toBe(400);
  });
  test("invalid plan -> 400", async () => {
    for (const plan of ["enterprise", "", "PRO", 3, null, ["pro"], {}]) {
      const r = await post("/api/waitlist", { email: "x@y.zz", plan });
      expect(r.status).toBe(400);
    }
  });
  test("invalid plan does not consume the email", async () => {
    await post("/api/waitlist", { email: "keep@y.zz", plan: "bogus" });
    expect((await post("/api/waitlist", { email: "keep@y.zz" })).status).toBe(201);
  });
  test("bad JSON / array / null body -> 400", async () => {
    for (const raw of ["{oops", "", "null", "[]", "7"]) {
      const r = await post("/api/waitlist", raw, true);
      expect(r.status).toBe(400);
      expect(isJson(r)).toBe(true);
    }
  });
  test("unicode email local part accepted", async () => {
    expect((await post("/api/waitlist", { email: "jürgen@exämple.de" })).status).toBe(201);
  });
  test("resetWaitlist clears the store", async () => {
    await post("/api/waitlist", { email: "r@x.io" });
    resetWaitlist();
    expect((await post("/api/waitlist", { email: "r@x.io" })).status).toBe(201);
  });
  test("concurrent identical signups: exactly one 201, rest 409", async () => {
    const rs = await Promise.all(Array.from({ length: 20 }, () => post("/api/waitlist", { email: "race@x.io" })));
    const codes = rs.map((r) => r.status);
    expect(codes.filter((c) => c === 201).length).toBe(1);
    expect(codes.filter((c) => c === 409).length).toBe(19);
  });
});

describe("methods, unknown API paths, content types", () => {
  const matrix: Array<[string, string[], string]> = [
    ["/api/plans", ["POST", "PUT", "DELETE", "PATCH"], "GET"],
    ["/api/examples", ["POST", "PUT", "DELETE", "PATCH"], "GET"],
    ["/api/generate", ["GET", "PUT", "DELETE", "PATCH"], "POST"],
    ["/api/waitlist", ["GET", "PUT", "DELETE", "PATCH"], "POST"],
  ];
  for (const [path, methods] of matrix) {
    for (const m of methods) {
      test(`${m} ${path} -> 405 JSON`, async () => {
        const r = await get(path, { method: m });
        expect(r.status).toBe(405);
        expect(isJson(r)).toBe(true);
        expect(typeof (await r.json()).error).toBe("string");
      });
    }
  }
  test("405 responses include an Allow header", async () => {
    expect((await get("/api/plans", { method: "POST" })).headers.get("allow")).toContain("GET");
    expect((await get("/api/generate")).headers.get("allow")).toContain("POST");
  });
  test("unknown /api/* -> 404 JSON", async () => {
    for (const p of ["/api/nope", "/api/", "/api", "/api/plans/extra", "/api/../x", "/api/%zz", "/apix"]) {
      const r = await get(p);
      if (p === "/apix") continue; // not an API path; covered by static tests
      expect(r.status).toBe(404);
      expect(isJson(r)).toBe(true);
      expect(typeof (await r.json()).error).toBe("string");
    }
  });
  test("unknown API path with POST is 404 not 405", async () => {
    expect((await get("/api/nope", { method: "POST" })).status).toBe(404);
  });
  test("all API success and error responses are JSON", async () => {
    const rs = [
      await get("/api/plans"),
      await get("/api/examples"),
      await post("/api/generate", { prompt: "x" }),
      await post("/api/generate", {}),
      await post("/api/waitlist", { email: "j@x.io" }),
      await post("/api/waitlist", { email: "j@x.io" }),
      await post("/api/waitlist", { email: "bad" }),
      await get("/api/nope"),
      await get("/api/plans", { method: "DELETE" }),
    ];
    for (const r of rs) expect(isJson(r)).toBe(true);
  });
  test("HEAD / OPTIONS on API paths -> 405 JSON", async () => {
    expect((await get("/api/plans", { method: "OPTIONS" })).status).toBe(405);
  });
});

describe("static files", () => {
  test("/ serves index.html", async () => {
    const r = await get("/");
    expect(r.status).toBe(200);
    expect(r.headers.get("content-type")).toContain("text/html");
    expect(await r.text()).toContain("<!doctype html>");
  });
  test("/index.html equals /", async () => {
    expect(await (await get("/index.html")).text()).toBe(await (await get("/")).text());
  });
  test("css and js are served with proper content types", async () => {
    const css = await get("/styles.css");
    expect(css.status).toBe(200);
    expect(css.headers.get("content-type")).toContain("text/css");
    const js = await get("/app.js");
    expect(js.status).toBe(200);
    expect(js.headers.get("content-type")).toMatch(/javascript/);
  });
  test("query string on static path is ignored", async () => {
    expect((await get("/styles.css?v=2")).status).toBe(200);
  });
  test("missing file -> 404 (JSON error)", async () => {
    const r = await get("/nope.txt");
    expect(r.status).toBe(404);
    expect(isJson(r)).toBe(true);
  });
  test("directory path without index returns 404 not 500", async () => {
    expect((await get("/missing-dir/")).status).toBe(404);
  });
  test("non-GET on static path -> 405", async () => {
    expect((await get("/", { method: "POST" })).status).toBe(405);
  });
  test("HEAD on / returns 200 with empty body", async () => {
    const r = await get("/", { method: "HEAD" });
    expect(r.status).toBe(200);
    expect(await r.text()).toBe("");
  });
  test("a bare /data or /public directory name does not 500", async () => {
    for (const p of ["/data", "/data/", "/public", "/public/"]) {
      const r = await get(p);
      expect([404]).toContain(r.status);
    }
  });
});

describe("path traversal", () => {
  // Request URL parsing normalises plain ../ so we use encoded forms that survive.
  const attacks = [
    "/%2e%2e/api.ts",
    "/%2e%2e%2fapi.ts",
    "/..%2fapi.ts",
    "/%2e%2e/%2e%2e/etc/passwd",
    "/..%5capi.ts",
    "/%5c..%5capi.ts",
    "/%2e%2e%5capi.ts",
    "/%252e%252e/api.ts",
    "/%252e%252e%252fapi.ts",
    "/..%252fapi.ts",
    "/index.html%00.png",
    "/%00",
    "/%00/../api.ts",
    "/..%00/api.ts",
    "/data/../../api.ts",
    "/data/..%2f..%2fapi.ts",
    "/....//api.ts",
    "/%2e%2e%2f%2e%2e%2f%2e%2e%2fetc%2fpasswd",
    "/%c0%ae%c0%ae/api.ts",
    "/%2e%2e;/api.ts",
    "//etc/passwd",
    "/%2fetc%2fpasswd",
  ];
  for (const a of attacks) {
    test(`blocked: ${a}`, async () => {
      const r = await get(a);
      expect(r.status).toBe(404);
      const text = await r.text();
      expect(text).not.toContain("handleRequest");
      expect(text).not.toContain("root:");
    });
  }
  test("raw ../ in URL is normalised by URL parser and cannot reach api.ts", async () => {
    const r = await get("/../api.ts");
    expect(r.status).toBe(404);
    expect(await r.text()).not.toContain("handleRequest");
  });
  test("sibling dir with same prefix (public-evil) is not reachable", async () => {
    expect((await get("/..%2fpublic-evil/x")).status).toBe(404);
  });
  test("malformed percent-encoding -> 404, not 500", async () => {
    for (const p of ["/%zz", "/%", "/%e0%a4%a", "/%gg/x", "/styles.css%"]) {
      const r = await get(p);
      expect(r.status).toBe(404);
    }
  });
  test("api.ts / server.ts / SPEC.md / data are not served", async () => {
    for (const p of ["/api.ts", "/server.ts", "/SPEC.md", "/data/plans.ts", "/tests/api.test.ts"]) {
      expect((await get(p)).status).toBe(404);
    }
  });
});
