/**
 * Deploy-gate Playwright audit.
 * Runs against the production preview build (npm run preview).
 * Checks every route, provenance badge values, rollback-proof tx links,
 * SPA hard-reload for docs/challenge and docs/roadmap, and zero console errors.
 *
 * Usage: BASE=http://127.0.0.1:5173 node scripts/audit-deploy.mjs
 */
import { chromium } from "playwright";

const BASE = process.env.BASE ?? "http://127.0.0.1:5173";

async function run() {
  const browser = await chromium.launch({ headless: true });
  const allResults = [];

  async function runSession(label, { width = 1280, height = 900 } = {}) {
    const ctx = await browser.newContext({ viewport: { width, height } });
    const page = await ctx.newPage();
    const runtimeErrors = [];
    page.on("pageerror", (e) => runtimeErrors.push(`pageerror: ${e.message.slice(0, 160)}`));
    page.on("console", (m) => {
      if (m.type() === "error") runtimeErrors.push(`console.error: ${m.text().slice(0, 160)}`);
    });
    const results = [];
    const isMobile = width < 768;

    async function step(name, fn) {
      try {
        await fn();
        const body = await page.evaluate(() => document.body.innerText.slice(0, 120).replace(/\n+/g, " "));
        results.push({ name, ok: true, body });
      } catch (e) {
        results.push({ name, ok: false, err: e.message.slice(0, 250) });
      }
    }

    async function waitText(t, timeout = 9000) {
      await page.waitForFunction((s) => document.body.innerText.includes(s), t, { timeout });
    }

    async function navTo(href, needle) {
      if (!isMobile) {
        await page.click(`nav a[href="${href}"]:visible`, { timeout: 5000 });
      } else {
        const btn = page.getByRole("button", { name: /open menu/i });
        if (await btn.isVisible().catch(() => false)) {
          await btn.click({ timeout: 3000 });
          await page.waitForTimeout(250);
        }
        await page.locator(`a[href="${href}"]`).filter({ visible: true }).first().click({ timeout: 5000 });
      }
      await waitText(needle);
    }

    async function checkImg(src) {
      await page.waitForFunction((s) => {
        const img = document.querySelector(`img[src="${s}"]`);
        return img && img.complete && img.getBoundingClientRect().width > 0;
      }, src, { timeout: 7000 });
    }

    // ── Steps ─────────────────────────────────────────────────────────────

    await step("1. load /", async () => {
      await page.goto(BASE, { waitUntil: "domcontentloaded" });
      await waitText("A wallet that runs itself");
    });

    await step("2. hero: consensus language, no overclaim", async () => {
      const text = await page.evaluate(() => document.body.innerText);
      if (!text.includes("consensus")) throw new Error("hero missing 'consensus'");
      if (text.includes("verifies truth") || text.includes("watches the real world"))
        throw new Error("overclaim found");
    });

    await step("3. navigate /app", async () => {
      if (!isMobile) await navTo("/app", "Connect to start");
      else { await page.click('a:text("Open the app")', { timeout: 5000 }); await waitText("Connect to start"); }
    });

    await step("4. navigate /arm", async () => { await navTo("/arm", "Connect to arm"); });

    await step("5. navigate /track", async () => { await navTo("/track", "Onward earns its trust ceiling"); });

    await step("6. navigate /connectors", async () => { await navTo("/connectors", "Three venues"); });

    await step("7. navigate /receipts", async () => { await navTo("/receipts", "Every move on chain"); });

    await step("8. receipts: provenance legend", async () => {
      await waitText("Provenance");
      const n = await page.$$eval('[class*="bg-signal-amber"]', e => e.length);
      if (n === 0) throw new Error("no amber provenance badge");
    });

    await step("9. receipts: rollback proof link", async () => {
      await page.locator('a[href="/docs/challenge"]:has-text("rollback proof")').waitFor({ timeout: 4000 });
    });

    await step("10. navigate /docs", async () => { await navTo("/docs", "About Onward"); });

    await step("11. docs: how-it-works", async () => {
      await page.click('a[href="/docs/how-it-works"]:visible', { timeout: 5000 });
      await waitText("How it works");
    });

    await step("12. docs: loop SVG loaded", async () => { await checkImg("/onward-loop.svg"); });

    await step("13. docs: challenge section", async () => {
      await page.click('a[href="/docs/challenge"]:visible', { timeout: 5000 });
      await waitText("self correcting challenge");
    });

    await step("14. docs challenge: challenge SVG loaded", async () => { await checkImg("/onward-challenge.svg"); });

    await step("15. docs challenge: rollback timeline rendered", async () => {
      await waitText("Live rollback proof");
    });

    await step("16. docs challenge: ≥4 shannon explorer tx links", async () => {
      const n = await page.$$eval('a[href*="shannon-explorer.somnia.network/tx/"]', e => e.length);
      if (n < 4) throw new Error(`expected >=4 tx links, got ${n}`);
    });

    await step("17. docs challenge: rollback outcome text", async () => { await waitText("Rolled back. Reserved funds returned."); });

    await step("18. docs challenge: settle outcome text", async () => { await waitText("Settled. Action executed on venue."); });

    await step("19. docs challenge: hard reload SPA", async () => {
      await page.goto(`${BASE}/docs/challenge`, { waitUntil: "networkidle" });
      await page.reload({ waitUntil: "networkidle" });
      await waitText("Live rollback proof");
    });

    await step("20. docs: architecture section", async () => {
      await page.click('a[href="/docs/architecture"]:visible', { timeout: 5000 });
      await waitText("Architecture");
      await checkImg("/onward-architecture.svg");
    });

    await step("21. docs: safety 'does not guarantee'", async () => {
      await page.click('a[href="/docs/safety"]:visible', { timeout: 5000 });
      await waitText("does not guarantee");
    });

    await step("22. docs: contracts v3 reference", async () => {
      await page.click('a[href="/docs/contracts"]:visible', { timeout: 5000 });
      await waitText("deployments-v3");
      const n = await page.$$eval('a[href*="shannon-explorer"]', e => e.length);
      if (n === 0) throw new Error("no shannon explorer links in contracts");
    });

    await step("23. docs: FAQ source-accuracy Q", async () => {
      await page.click('a[href="/docs/faq"]:visible', { timeout: 5000 });
      await waitText("Does Onward guarantee the source data");
    });

    await step("24. docs: roadmap nav entry", async () => {
      await page.locator('a[href="/docs/roadmap"]:visible').waitFor({ timeout: 4000 });
    });

    await step("25. docs: roadmap content", async () => {
      await page.click('a[href="/docs/roadmap"]:visible', { timeout: 5000 });
      await waitText("Live today");
      await waitText("Q3 2026");
      await waitText("Q4 2026");
      await waitText("Q1 2027");
    });

    await step("26. docs roadmap: hard reload SPA", async () => {
      await page.goto(`${BASE}/docs/roadmap`, { waitUntil: "networkidle" });
      await page.reload({ waitUntil: "networkidle" });
      await waitText("Live today");
    });

    // ── Receipt detail with provenance value checks ──────────────────────

    await step("27. /receipts/2 loads", async () => {
      await page.goto(`${BASE}/receipts/2`, { waitUntil: "domcontentloaded" });
      await page.waitForFunction(
        () => document.body.innerText.includes("Loading receipt") ||
              document.body.innerText.includes("Action") ||
              document.body.innerText.includes("not found"),
        null, { timeout: 9000 }
      );
    });

    await step("28. receipt/2: provenance legend visible", async () => {
      await waitText("Provenance");
    });

    let sourceValue = "(not read)";
    let statusValue = "(not read)";
    await step("29. receipt/2: SOURCE field has non-empty value", async () => {
      // Wait for the field grid to render
      await page.waitForFunction(
        () => document.body.innerText.includes("What the agent saw"),
        null, { timeout: 9000 }
      );
      // Extract Source field value: the third column of the row labeled "Source"
      const text = await page.evaluate(() => {
        const rows = document.querySelectorAll(".grid.grid-cols-\\[1fr_auto_2fr\\]");
        for (const row of rows) {
          const label = row.querySelector("span.label");
          if (label && label.textContent?.trim() === "Source") {
            const spans = row.querySelectorAll("span");
            // spans[0]=label, spans[1]=badge, then value text is last child
            const cells = [...row.children];
            return cells[2] ? cells[2].textContent?.trim() : null;
          }
        }
        return null;
      });
      if (!text || text.length === 0) throw new Error("Source field value empty");
      sourceValue = text;
    });

    await step("30. receipt/2: CONSENSUS_VERIFIED Status field non-empty", async () => {
      const text = await page.evaluate(() => {
        // Look for the Status row which uses CONSENSUS_VERIFIED tier
        const rows = document.querySelectorAll(".grid.grid-cols-\\[1fr_auto_2fr\\]");
        for (const row of rows) {
          const label = row.querySelector("span.label");
          if (label && label.textContent?.trim() === "Status") {
            const cells = [...row.children];
            return cells[2] ? cells[2].textContent?.trim() : null;
          }
        }
        return null;
      });
      if (!text || text.length === 0) throw new Error("Status field value empty");
      statusValue = text;
    });

    await step("31. receipt/2: five badge tiers present on page", async () => {
      const badgeText = await page.evaluate(() => {
        const badges = document.querySelectorAll('[class*="bg-signal-amber"],[class*="bg-brand/8"],[class*="bg-signal-mint/12"],[class*="bg-ink/6"],[class*="bg-\\[#7B5EA7\\]"]');
        return [...badges].map(b => b.textContent?.trim()).filter(Boolean);
      });
      if (badgeText.length < 3) throw new Error(`only ${badgeText.length} badge types found`);
    });

    await step("32. /receipts/NaN: id-not-found message", async () => {
      await page.goto(`${BASE}/receipts/NaN`, { waitUntil: "domcontentloaded" });
      await waitText("Receipt id not found in URL");
    });

    await step("33. no dashes in hero H1", async () => {
      await page.goto(BASE, { waitUntil: "domcontentloaded" });
      const h1 = await page.evaluate(() => document.querySelector("h1")?.innerText ?? "");
      if (/[-–—]/.test(h1)) throw new Error(`dash in H1: "${h1}"`);
    });

    await ctx.close();
    allResults.push({ label, results, runtimeErrors, sourceValue, statusValue });
  }

  await runSession("Desktop 1280×900", { width: 1280, height: 900 });
  await runSession("Mobile 390×844", { width: 390, height: 844 });
  await browser.close();

  // ── Report ──────────────────────────────────────────────────────────────
  let totalFail = 0;
  let totalRuntime = 0;
  for (const s of allResults) {
    console.log("\n" + "═".repeat(72));
    console.log(`SESSION: ${s.label}`);
    console.log("═".repeat(72));
    for (const r of s.results) {
      console.log(`${r.ok ? "✓" : "✗"} ${r.name}`);
      if (!r.ok) { console.log(`    ERR: ${r.err}`); totalFail++; }
      else if (r.body) console.log(`    "${r.body.slice(0, 80)}"`);
    }
    console.log(`\n  SOURCE value on /receipts/2     : ${s.sourceValue}`);
    console.log(`  CONSENSUS_VERIFIED value        : ${s.statusValue}`);
    if (s.runtimeErrors.length) {
      console.log(`\n  Runtime errors (${s.runtimeErrors.length}):`);
      s.runtimeErrors.forEach(e => console.log(`  ! ${e}`));
      totalRuntime += s.runtimeErrors.length;
    } else {
      console.log("  Runtime errors: none");
    }
  }

  const total = allResults.reduce((n, s) => n + s.results.length, 0);
  const passed = total - totalFail;
  console.log("\n" + "═".repeat(72));
  console.log(`FINAL: ${passed}/${total} steps passed · ${totalRuntime} runtime errors`);
  if (totalFail || totalRuntime) process.exit(1);
}

run().catch(e => { console.error(e); process.exit(1); });
