// Real browser audit. Loads each route, waits for content, captures console + errors.
import { chromium } from "playwright";

const BASE = process.env.BASE ?? "http://127.0.0.1:4173";

const routes = [
  { path: "/", needle: ["A wallet that runs itself", "loop, end to end"], label: "Landing" },
  { path: "/app", needle: ["Connect to start", "self driving wallet"], label: "Dashboard" },
  { path: "/arm", needle: ["Tell the wallet", "Connect to arm"], label: "Arm" },
  { path: "/receipts", needle: ["Every move on chain"], label: "Receipts" },
  { path: "/track", needle: ["Onward earns its trust ceiling", "Track record"], label: "TrackRecord" },
  { path: "/connectors", needle: ["Three venues"], label: "Connectors" },
  { path: "/docs", needle: ["About Onward"], label: "DocsAbout" },
  { path: "/docs/how-it-works", needle: ["How it works"], label: "DocsHow" },
  { path: "/docs/architecture", needle: ["Architecture"], label: "DocsArch" },
  { path: "/docs/challenge", needle: ["self correcting challenge"], label: "DocsChallenge" },
  { path: "/docs/contracts", needle: ["Smart contracts"], label: "DocsContracts" },
  { path: "/docs/faq", needle: ["FAQ"], label: "DocsFaq" },
  { path: "/receipts/1", needle: ["Action", "All receipts"], label: "ReceiptDetail" }
];

(async () => {
  const browser = await chromium.launch();
  const ctx = await browser.newContext({ viewport: { width: 1280, height: 900 } });
  const results = [];

  for (const r of routes) {
    const page = await ctx.newPage();
    const consoleErrors = [];
    const pageErrors = [];
    const failedRequests = [];

    page.on("console", (msg) => {
      if (msg.type() === "error") consoleErrors.push(msg.text());
    });
    page.on("pageerror", (err) => pageErrors.push(err.message));
    page.on("requestfailed", (req) =>
      failedRequests.push(`${req.method()} ${req.url()} :: ${req.failure()?.errorText}`)
    );

    let status = "ok";
    let detail = "";
    let foundNeedle = null;
    let bodyTextSample = "";
    let displayFont = "";
    let headingFont = "";

    try {
      const resp = await page.goto(`${BASE}${r.path}`, { waitUntil: "networkidle", timeout: 30000 });
      if (!resp || !resp.ok()) {
        status = "fail";
        detail = `HTTP ${resp?.status?.()}`;
      } else {
        // Wait for any of the needles to appear, up to 8s.
        const got = await Promise.race([
          ...r.needle.map((n) =>
            page
              .waitForFunction((needle) => document.body.innerText.includes(needle), n, { timeout: 8000 })
              .then(() => n)
          ),
          new Promise((res) => setTimeout(() => res(null), 8000))
        ]);
        foundNeedle = got;
        if (!got) {
          status = "fail";
          detail = "needle not found in body innerText";
        }
        bodyTextSample = (await page.evaluate(() => document.body.innerText)).slice(0, 220).replace(/\n+/g, " ");
        const fonts = await page.evaluate(() => {
          const body = window.getComputedStyle(document.body).fontFamily;
          const h = document.querySelector("h1,h2,h3");
          const heading = h ? window.getComputedStyle(h).fontFamily : "(no heading)";
          return { body, heading };
        });
        displayFont = fonts.heading;
        headingFont = fonts.body;
      }
    } catch (e) {
      status = "fail";
      detail = e instanceof Error ? e.message : String(e);
    }

    results.push({
      label: r.label,
      path: r.path,
      status,
      detail,
      foundNeedle,
      consoleErrors,
      pageErrors,
      failedRequests,
      bodyFont: headingFont,
      headingFont: displayFont,
      bodyTextSample
    });
    await page.close();
  }

  await browser.close();

  // Pretty report.
  let hardFail = 0;
  for (const r of results) {
    console.log("=".repeat(80));
    console.log(`${r.status === "ok" ? "WORKING" : "BROKEN "} ${r.label.padEnd(16)} ${r.path}`);
    console.log(`  needle    ${r.foundNeedle ?? "(none)"}`);
    console.log(`  detail    ${r.detail || "(no detail)"}`);
    console.log(`  heading f ${r.headingFont}`);
    console.log(`  body f    ${r.bodyFont}`);
    console.log(`  body[:220] ${r.bodyTextSample}`);
    if (r.consoleErrors.length) {
      console.log("  console errors:");
      r.consoleErrors.forEach((c) => console.log("    " + c));
    } else {
      console.log("  console errors: none");
    }
    if (r.pageErrors.length) {
      console.log("  page errors:");
      r.pageErrors.forEach((c) => console.log("    " + c));
      hardFail++;
    } else {
      console.log("  page errors: none");
    }
    if (r.failedRequests.length) {
      console.log("  failed requests:");
      r.failedRequests.forEach((c) => console.log("    " + c));
    }
  }
  console.log("=".repeat(80));
  const okCount = results.filter((r) => r.status === "ok").length;
  console.log(`SUMMARY  ${okCount}/${results.length} routes rendered with required content. Page errors on ${hardFail} routes.`);
  if (hardFail || okCount !== results.length) process.exit(1);
})();
