// Verify live chain data renders in TrackRecord and Receipts within reasonable time.
import { chromium } from "playwright";

const BASE = process.env.BASE ?? "http://127.0.0.1:4173";

(async () => {
  const browser = await chromium.launch();
  const ctx = await browser.newContext({ viewport: { width: 1280, height: 900 } });
  const page = await ctx.newPage();
  const consoleAll = [];
  const errors = [];
  page.on("console", (m) => consoleAll.push(`${m.type()}: ${m.text()}`));
  page.on("pageerror", (e) => errors.push(e.message));

  console.log("track record page, wait for non-zero totals (live data 8 evaluations)");
  await page.goto(`${BASE}/track`, { waitUntil: "domcontentloaded" });
  try {
    await page.waitForFunction(
      () => {
        const cards = Array.from(document.querySelectorAll("p.font-display"));
        return cards.some((c) => {
          const t = (c.textContent ?? "").trim();
          return /^[1-9]/.test(t);
        });
      },
      null,
      { timeout: 15000 }
    );
    const nums = await page.$$eval("p.font-display", (els) => els.slice(0, 8).map((e) => e.textContent?.trim()));
    console.log("  big numbers seen:", nums);
  } catch (e) {
    console.log("  TIMEOUT waiting for non-zero numbers. Dumping all big numbers:");
    const nums = await page.$$eval("p.font-display", (els) => els.map((e) => e.textContent?.trim()));
    console.log(nums);
  }

  console.log("dashboard connect gate check after wagmi hydration");
  await page.goto(`${BASE}/app`, { waitUntil: "domcontentloaded" });
  try {
    await page.waitForFunction(
      () => document.body.innerText.includes("Connect to start") || document.body.innerText.includes("Your wallet"),
      null,
      { timeout: 10000 }
    );
    const txt = await page.evaluate(() => document.body.innerText);
    const which = txt.includes("Connect to start") ? "ConnectGate" : "DashboardWithWallet";
    console.log(`  resolved: ${which}`);
  } catch (e) {
    console.log("  TIMEOUT waiting for dashboard resolution");
  }

  console.log("--- console output summary ---");
  console.log(`console events: ${consoleAll.length}`);
  consoleAll.filter((c) => c.startsWith("error")).forEach((c) => console.log("  " + c));
  console.log(`page errors: ${errors.length}`);
  errors.forEach((e) => console.log("  " + e));

  await browser.close();
  if (errors.length) process.exit(1);
})();
