/**
 * Click-through navigation audit.
 *
 * Simulates real in-app navigation (clicking links, NOT fresh URL loads).
 * This is the test that catches double-mount crashes which only appear on navigation.
 *
 * Usage: BASE=http://127.0.0.1:5173 node scripts/audit-nav.mjs
 */
import { chromium } from "playwright";

const BASE = process.env.BASE ?? "http://127.0.0.1:5173";

async function run() {
  const browser = await chromium.launch({ headless: true });
  const ctx = await browser.newContext({
    viewport: { width: 1280, height: 900 },
    // No wallet injected — tests the disconnected state that most users see.
  });
  const page = await ctx.newPage();

  const allErrors = [];
  page.on("pageerror", (e) => allErrors.push({ step: currentStep, msg: e.message }));
  page.on("console", (m) => {
    if (m.type() === "error") allErrors.push({ step: currentStep, msg: `console: ${m.text()}` });
  });

  let currentStep = "init";
  const results = [];

  async function step(label, fn) {
    currentStep = label;
    const start = Date.now();
    try {
      await fn();
      const body = await page.evaluate(() => document.body.innerText.slice(0, 160).replace(/\n+/g, " "));
      results.push({ label, ok: true, url: page.url(), body, ms: Date.now() - start });
    } catch (e) {
      results.push({ label, ok: false, url: page.url(), err: e.message.slice(0, 200), ms: Date.now() - start });
    }
  }

  async function waitForText(text, timeout = 8000) {
    await page.waitForFunction(
      (t) => document.body.innerText.includes(t),
      text,
      { timeout }
    );
  }

  // ── 1. Land on / ──────────────────────────────────────────────────────────
  await step("1. Load /", async () => {
    await page.goto(BASE, { waitUntil: "domcontentloaded" });
    await waitForText("A wallet that runs itself");
  });

  // ── 2. Click nav "App" link ───────────────────────────────────────────────
  await step("2. Click nav → /app", async () => {
    await page.click('a[href="/app"]', { timeout: 5000 });
    await waitForText("Connect to start");
  });

  // ── 3. From /app click "Arm a rule" in nav ────────────────────────────────
  await step("3. Click nav → /arm", async () => {
    await page.click('nav a[href="/arm"]', { timeout: 5000 });
    // With no wallet connected it should show "Connect to arm."
    await waitForText("Connect to arm");
  });

  // ── 4. Back → click nav "Track record" ───────────────────────────────────
  await step("4. Click nav → /track", async () => {
    await page.click('nav a[href="/track"]', { timeout: 5000 });
    await waitForText("Onward earns its trust ceiling");
  });

  // ── 5. Click nav "Connectors" ─────────────────────────────────────────────
  await step("5. Click nav → /connectors", async () => {
    await page.click('nav a[href="/connectors"]', { timeout: 5000 });
    await waitForText("Three venues");
  });

  // ── 6. Click nav "Receipts" ───────────────────────────────────────────────
  await step("6. Click nav → /receipts", async () => {
    await page.click('nav a[href="/receipts"]', { timeout: 5000 });
    await waitForText("Every move on chain");
  });

  // ── 7. Click nav "Docs" ───────────────────────────────────────────────────
  await step("7. Click nav → /docs", async () => {
    await page.click('nav a[href="/docs"]', { timeout: 5000 });
    await waitForText("About Onward");
  });

  // ── 8. Click docs sidebar "How it works" ─────────────────────────────────
  await step("8. Click docs sidebar → how-it-works", async () => {
    await page.click('aside nav a[href="/docs/how-it-works"]', { timeout: 5000 });
    await waitForText("How it works");
  });

  // ── 9. Click docs sidebar "Architecture" ─────────────────────────────────
  await step("9. Click docs sidebar → architecture", async () => {
    await page.click('aside nav a[href="/docs/architecture"]', { timeout: 5000 });
    await waitForText("Architecture");
  });

  // ── 10. Click docs sidebar "Smart contracts" ─────────────────────────────
  await step("10. Click docs sidebar → contracts", async () => {
    await page.click('aside nav a[href="/docs/contracts"]', { timeout: 5000 });
    await waitForText("Smart contracts");
  });

  // ── 11. Click docs sidebar "FAQ" ─────────────────────────────────────────
  await step("11. Click docs sidebar → faq", async () => {
    await page.click('aside nav a[href="/docs/faq"]', { timeout: 5000 });
    await waitForText("FAQ");
  });

  // ── 12. Navigate to /app from Docs ───────────────────────────────────────
  await step("12. Click nav → /app again", async () => {
    await page.click('nav a[href="/app"]', { timeout: 5000 });
    await waitForText("Connect to start");
  });

  // ── 13. Navigate from /app back to / via logo ─────────────────────────────
  await step("13. Click logo → /", async () => {
    await page.click('a[href="/"]', { timeout: 5000 });
    await waitForText("A wallet that runs itself");
  });

  // ── 14. Click CTA "Open the app" → /app ──────────────────────────────────
  await step("14. CTA 'Open the app' → /app", async () => {
    await page.click('a:text("Open the app"):visible', { timeout: 5000 });
    await waitForText("Connect to start");
  });

  // ── 15. Navigate to /receipts/:id (no data, should show loading not blank) ─
  await step("15. Navigate to /receipts/1 (no wallet)", async () => {
    await page.goto(`${BASE}/receipts/1`, { waitUntil: "domcontentloaded" });
    // Should show either "Loading receipt" or "Action" — never blank.
    await page.waitForFunction(
      () =>
        document.body.innerText.includes("Loading receipt") ||
        document.body.innerText.includes("Action") ||
        document.body.innerText.includes("Render error"),
      null,
      { timeout: 8000 }
    );
  });

  await browser.close();

  // ── Report ─────────────────────────────────────────────────────────────────
  console.log("\n" + "=".repeat(72));
  console.log("CLICK-THROUGH NAVIGATION AUDIT");
  console.log("=".repeat(72));
  let fails = 0;
  for (const r of results) {
    const icon = r.ok ? "PASS" : "FAIL";
    console.log(`${icon}  ${r.label} (${r.ms}ms)`);
    if (!r.ok) {
      console.log(`      ERR: ${r.err}`);
      fails++;
    } else {
      console.log(`      url: ${r.url}`);
      console.log(`      txt: ${r.body.slice(0, 100)}`);
    }
  }

  console.log("\n" + "=".repeat(72));
  if (allErrors.length) {
    console.log(`RUNTIME ERRORS (${allErrors.length}):`);
    for (const e of allErrors) console.log(`  [${e.step}] ${e.msg.slice(0, 180)}`);
  } else {
    console.log("Runtime errors: none");
  }
  console.log("=".repeat(72));
  console.log(`SUMMARY  ${results.filter((r) => r.ok).length}/${results.length} steps passed · ${allErrors.length} runtime errors`);

  if (fails || allErrors.length) process.exit(1);
}

run().catch((e) => { console.error(e); process.exit(1); });
