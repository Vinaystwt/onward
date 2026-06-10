// Second pass: SPA reload, in-page navigation, explorer link targets.
import { chromium } from "playwright";

const BASE = process.env.BASE ?? "http://127.0.0.1:4173";

(async () => {
  const browser = await chromium.launch();
  const ctx = await browser.newContext({ viewport: { width: 1280, height: 900 } });
  const page = await ctx.newPage();
  const errors = [];
  page.on("pageerror", (e) => errors.push(e.message));
  page.on("console", (m) => {
    if (m.type() === "error") errors.push(`console: ${m.text()}`);
  });

  // 1. Deep link reload check: load /docs/architecture directly, then reload, then forward to /track via nav click.
  console.log("step 1: deep link /docs/architecture");
  let r = await page.goto(`${BASE}/docs/architecture`, { waitUntil: "networkidle" });
  console.log(`  status ${r?.status()} content has 'Architecture' = ${(await page.content()).includes("Architecture")}`);
  console.log("step 2: hard reload of /docs/architecture");
  await page.reload({ waitUntil: "networkidle" });
  console.log(`  content has 'Onward is nine small contracts' = ${(await page.content()).includes("Onward is nine small contracts")}`);

  // 3. Click nav link to /track from inside docs.
  console.log("step 3: click nav 'Track record' link");
  await page.click('a[href="/track"]:visible');
  await page.waitForLoadState("networkidle");
  console.log(`  url=${page.url()}`);
  console.log(`  content has 'Onward earns its trust ceiling' = ${(await page.content()).includes("Onward earns its trust ceiling")}`);

  // 4. Verify totals stats render some number, not stuck on "0" only.
  const totalsCells = await page.$$eval(".grid p.font-display, p.font-display", (els) =>
    els.slice(0, 12).map((e) => e.textContent?.trim() ?? "")
  );
  console.log(`  visible big numbers: ${totalsCells.join(" | ").slice(0, 200)}`);

  // 5. Verify a Shannon explorer href exists.
  const shannons = await page.$$eval('a[href*="shannon-explorer.somnia.network"]', (els) =>
    els.slice(0, 5).map((a) => a.getAttribute("href"))
  );
  console.log(`  shannon explorer links sample: ${shannons.join(", ")}`);

  // 6. Click landing CTA "Open the app".
  console.log("step 4: from / click 'Open the app'");
  await page.goto(`${BASE}/`, { waitUntil: "networkidle" });
  await page.click('text=Open the app');
  await page.waitForLoadState("networkidle");
  console.log(`  url=${page.url()}  has 'Connect to start' = ${(await page.content()).includes("Connect to start")}`);

  // 7. Click 'Arm a rule' from connect gate.
  console.log("step 5: click Arm a rule on dashboard");
  await page.goto(`${BASE}/app`, { waitUntil: "networkidle" });
  await page.click('a[href="/arm"]:visible');
  await page.waitForLoadState("networkidle");
  console.log(`  url=${page.url()}  has 'Tell the wallet' or 'Connect to arm' = ${(await page.content()).match(/Tell the wallet|Connect to arm/)?.[0]}`);

  // 8. Click into docs sidebar links one by one.
  console.log("step 6: click each docs sidebar entry");
  await page.goto(`${BASE}/docs`, { waitUntil: "networkidle" });
  const sidebarLinks = await page.$$eval('aside nav a', (els) => els.map((a) => ({ href: a.getAttribute("href"), text: a.textContent?.trim() })));
  for (const l of sidebarLinks) {
    if (!l.href) continue;
    await page.click(`aside nav a[href="${l.href}"]`);
    await page.waitForLoadState("networkidle");
    const body = await page.evaluate(() => document.querySelector("article")?.textContent ?? "");
    console.log(`  ${l.href.padEnd(28)} content len=${body.length}`);
  }

  console.log("--- final errors ---");
  for (const e of errors) console.log("ERR: " + e);
  console.log(`error count: ${errors.length}`);

  await browser.close();
  if (errors.length) process.exit(1);
})();
