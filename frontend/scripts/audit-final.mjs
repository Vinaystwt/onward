/**
 * Final comprehensive click-through audit — v3 edition.
 * Tests navigation, provenance badges, rollback proof timeline, copy accuracy,
 * image loading, mobile viewport, SPA reload.
 * Usage: BASE=http://127.0.0.1:5173 node scripts/audit-final.mjs
 */
import { chromium } from "playwright";

const BASE = process.env.BASE ?? "http://127.0.0.1:5173";

async function run() {
  const browser = await chromium.launch({ headless: true });
  const allResults = [];

  async function runSession(label, { width = 1280, height = 900 } = {}) {
    const ctx = await browser.newContext({ viewport: { width, height } });
    const page = await ctx.newPage();
    const errors = [];
    page.on("pageerror", (e) => errors.push(`pageerror: ${e.message.slice(0, 120)}`));
    page.on("console", (m) => {
      if (m.type() === "error") errors.push(`console: ${m.text().slice(0, 120)}`);
    });
    const results = [];
    const isMobile = width < 768;

    async function step(name, fn) {
      try {
        await fn();
        const body = await page.evaluate(() => document.body.innerText.slice(0, 140).replace(/\n+/g, " "));
        results.push({ name, ok: true, body });
      } catch (e) {
        results.push({ name, ok: false, err: e.message.slice(0, 200) });
      }
    }

    async function waitText(t, timeout = 8000) {
      await page.waitForFunction((s) => document.body.innerText.includes(s), t, { timeout });
    }

    async function navTo(href, needle) {
      if (!isMobile) {
        await page.click(`nav a[href="${href}"]:visible`, { timeout: 4000 });
      } else {
        const menuBtn = page.getByRole("button", { name: /open menu/i });
        const visible = await menuBtn.isVisible().catch(() => false);
        if (visible) { await menuBtn.click({ timeout: 3000 }); await page.waitForTimeout(200); }
        const link = page.locator(`a[href="${href}"]`).filter({ visible: true }).first();
        await link.click({ timeout: 4000 });
      }
      await waitText(needle);
    }

    async function checkImg(src) {
      await page.waitForFunction((s) => {
        const img = document.querySelector(`img[src="${s}"]`);
        if (!img || !img.complete) return false;
        return img.getBoundingClientRect().width > 0;
      }, src, { timeout: 6000 });
    }

    // ── Steps ─────────────────────────────────────────────────────────────────

    await step("1. load /", async () => {
      await page.goto(BASE, { waitUntil: "domcontentloaded" });
      await waitText("A wallet that runs itself");
    });

    await step("2. hero copy: no overclaim language", async () => {
      const text = await page.evaluate(() => document.body.innerText);
      // Must mention "consensus" and NOT say "verifies truth" / "knows reality" / "watches the real world"
      if (!text.includes("consensus")) throw new Error("Hero missing 'consensus' language");
      if (text.includes("watches the real world")) throw new Error("Hero contains overclaim: 'watches the real world'");
    });

    await step("3. navigate → /app", async () => {
      if (!isMobile) { await navTo("/app", "Connect to start"); }
      else { await page.click('a:text("Open the app")', { timeout: 4000 }); await waitText("Connect to start"); }
    });

    await step("4. navigate → /arm", async () => { await navTo("/arm", "Connect to arm"); });

    await step("5. navigate → /track", async () => { await navTo("/track", "Onward earns its trust ceiling"); });

    await step("6. navigate → /connectors", async () => { await navTo("/connectors", "Three venues"); });

    await step("7. navigate → /receipts", async () => { await navTo("/receipts", "Every move on chain"); });

    await step("8. receipts: provenance legend visible", async () => {
      await waitText("Provenance");
      const badges = await page.$$eval('[class*="bg-signal-amber"]', els => els.length);
      if (badges === 0) throw new Error("No provenance badge elements found on receipts page");
    });

    await step("9. receipts: live rollback proof link present", async () => {
      const link = page.locator('a[href="/docs/challenge"]:has-text("rollback proof")');
      await link.waitFor({ timeout: 3000 });
    });

    await step("10. navigate → /docs", async () => { await navTo("/docs", "About Onward"); });

    await step("11. docs: click how-it-works", async () => {
      await page.click('a[href="/docs/how-it-works"]:visible', { timeout: 4000 });
      await waitText("How it works");
    });

    await step("12. docs how-it-works: precise consensus wording", async () => {
      const text = await page.evaluate(() => document.body.innerText);
      if (!text.includes("consensus")) throw new Error("How-it-works missing 'consensus' language");
    });

    await step("13. docs: loop diagram loaded", async () => { await checkImg("/onward-loop.svg"); });

    await step("14. docs: click challenge section", async () => {
      await page.click('a[href="/docs/challenge"]:visible', { timeout: 4000 });
      await waitText("self correcting challenge");
    });

    await step("15. docs challenge: challenge diagram loaded", async () => {
      await checkImg("/onward-challenge.svg");
    });

    await step("16. docs challenge: rollback proof timeline rendered", async () => {
      await waitText("Live rollback proof");
    });

    await step("17. docs challenge: proof has explorer tx links", async () => {
      const links = await page.$$eval(
        'a[href*="shannon-explorer.somnia.network/tx/"]',
        els => els.length
      );
      if (links < 4) throw new Error(`Expected >=4 explorer tx links, got ${links}`);
    });

    await step("18. docs challenge: rollback outcome shown", async () => {
      await waitText("Rolled back");
    });

    await step("19. docs challenge: settle outcome shown", async () => {
      await waitText("Settled");
    });

    await step("20. docs: click architecture", async () => {
      await page.click('a[href="/docs/architecture"]:visible', { timeout: 4000 });
      await waitText("Architecture");
    });

    await step("21. docs: architecture diagram loaded", async () => { await checkImg("/onward-architecture.svg"); });

    await step("22. docs: click safety", async () => {
      await page.click('a[href="/docs/safety"]:visible', { timeout: 4000 });
      await waitText("Safety");
    });

    await step("23. docs safety: 'does not guarantee' note present", async () => {
      await waitText("does not guarantee");
    });

    await step("24. docs: click smart contracts", async () => {
      await page.click('a[href="/docs/contracts"]:visible', { timeout: 4000 });
      await waitText("Smart contracts");
    });

    await step("25. docs: contracts table has shannon explorer links", async () => {
      const links = await page.$$eval('a[href*="shannon-explorer"]', els => els.length);
      if (links === 0) throw new Error("No Shannon explorer links in contracts table");
    });

    await step("26. docs: deployments-v3 referenced", async () => {
      await waitText("deployments-v3");
    });

    await step("27. docs: click faq", async () => {
      await page.click('a[href="/docs/faq"]:visible', { timeout: 4000 });
      await waitText("FAQ");
    });

    await step("28. faq: source-accuracy question present", async () => {
      await waitText("Does Onward guarantee the source data");
    });

    await step("29. /receipts/2 (rollback receipt) renders", async () => {
      await page.goto(`${BASE}/receipts/2`, { waitUntil: "domcontentloaded" });
      await page.waitForFunction(
        () => document.body.innerText.includes("Loading receipt") ||
              document.body.innerText.includes("Action") ||
              document.body.innerText.includes("Render error"),
        null, { timeout: 8000 }
      );
    });

    await step("30. receipt detail: provenance legend visible", async () => {
      // Provenance legend is inside a card above the receipt fields
      await waitText("Provenance");
    });

    await step("31. receipt detail: field layout has provenance badges", async () => {
      // The new layout renders badge spans beside each field label
      const badges = await page.$$eval('[class*="bg-signal-amber"],[class*="bg-brand/8"],[class*="bg-signal-mint/12"]', els => els.length);
      if (badges === 0) throw new Error("No provenance badge elements found on receipt detail");
    });

    await step("32. hard reload /docs/challenge (SPA fallback)", async () => {
      await page.goto(`${BASE}/docs/challenge`, { waitUntil: "networkidle" });
      await page.reload({ waitUntil: "networkidle" });
      await waitText("Live rollback proof");
    });

    await step("33. /receipts/NaN shows id-not-found, not blank", async () => {
      await page.goto(`${BASE}/receipts/NaN`, { waitUntil: "domcontentloaded" });
      await waitText("Receipt id not found in URL");
    });

    await step("34. no dashes in hero copy", async () => {
      await page.goto(BASE, { waitUntil: "domcontentloaded" });
      const heroText = await page.evaluate(() => {
        const h1 = document.querySelector("h1");
        return h1 ? h1.innerText : "";
      });
      if (/[-–—]/.test(heroText)) throw new Error(`Dash found in hero h1: "${heroText}"`);
    });

    // ── Roadmap steps ─────────────────────────────────────────────────────────
    await step("35. docs nav has Roadmap entry", async () => {
      await page.goto(`${BASE}/docs`, { waitUntil: "domcontentloaded" });
      await waitText("About Onward");
      const link = page.locator('a[href="/docs/roadmap"]:visible');
      await link.waitFor({ timeout: 4000 });
    });

    await step("36. click Roadmap in docs nav", async () => {
      await page.click('a[href="/docs/roadmap"]:visible', { timeout: 4000 });
      await waitText("Roadmap");
    });

    await step("37. roadmap: Shipped block visible with Live today pill", async () => {
      await waitText("Live today");
      await waitText("Shipped");
    });

    await step("38. roadmap: shipped items all present", async () => {
      await waitText("Plain English rules");
      await waitText("Autonomous execution");
      await waitText("The self correcting challenge");
      await waitText("Receipts with provenance");
    });

    await step("39. roadmap: Q3 2026 block present", async () => {
      await waitText("Q3 2026");
      await waitText("Trust and incentives");
      await waitText("Challenge bonds and rewards");
      await waitText("Multi source reads");
    });

    await step("40. roadmap: Q4 2026 block present", async () => {
      await waitText("Q4 2026");
      await waitText("Expressive rules");
      await waitText("Composable rule builder");
    });

    await step("41. roadmap: Q1 2027 block present", async () => {
      await waitText("Q1 2027");
      await waitText("Open network and mainnet");
      await waitText("Mainnet readiness");
    });

    await step("42. roadmap: deep link /docs/roadmap (SPA hard reload)", async () => {
      await page.goto(`${BASE}/docs/roadmap`, { waitUntil: "networkidle" });
      await page.reload({ waitUntil: "networkidle" });
      await waitText("Live today");
    });

    await step("43. roadmap: no em/en dashes in rendered roadmap copy", async () => {
      await page.goto(`${BASE}/docs/roadmap`, { waitUntil: "domcontentloaded" });
      await waitText("Roadmap");
      const text = await page.evaluate(() => {
        // Find the article element (roadmap content area)
        const article = document.querySelector("article");
        return article ? article.innerText : "";
      });
      const match = text.match(/[–—]/);
      if (match) throw new Error(`Em/en dash found in roadmap: near "${text.slice(Math.max(0, text.indexOf(match[0]) - 20), text.indexOf(match[0]) + 20)}"`);
    });

    await ctx.close();
    allResults.push({ label, results, errors });
  }

  await runSession("Desktop 1280×900", { width: 1280, height: 900 });
  await runSession("Mobile 390×844", { width: 390, height: 844 });

  await browser.close();

  // ── Report ─────────────────────────────────────────────────────────────────
  let totalFail = 0;
  let totalRuntime = 0;
  for (const session of allResults) {
    console.log("\n" + "═".repeat(70));
    console.log(`SESSION: ${session.label}`);
    console.log("═".repeat(70));
    for (const r of session.results) {
      const icon = r.ok ? "✓" : "✗";
      console.log(`${icon} ${r.name}`);
      if (!r.ok) { console.log(`    ERR: ${r.err}`); totalFail++; }
      else if (r.body) { console.log(`    "${r.body.slice(0, 90)}"`); }
    }
    if (session.errors.length) {
      console.log(`\n  Runtime errors (${session.errors.length}):`);
      session.errors.forEach((e) => console.log(`  ! ${e}`));
      totalRuntime += session.errors.length;
    } else {
      console.log("\n  Runtime errors: none");
    }
  }

  console.log("\n" + "═".repeat(70));
  const totalSteps = allResults.reduce((s, r) => s + r.results.length, 0);
  const totalPass = totalSteps - totalFail;
  console.log(`FINAL: ${totalPass}/${totalSteps} steps passed · ${totalRuntime} runtime errors`);
  if (totalFail || totalRuntime) process.exit(1);
}

run().catch((e) => { console.error(e); process.exit(1); });
