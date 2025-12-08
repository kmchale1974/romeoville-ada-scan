// crawl.js
const fs = require("fs");
const path = require("path");
const puppeteer = require("puppeteer");

const START_URL = "https://www.romeoville.org/";
const DOMAIN = "www.romeoville.org";

// Safety limits – tweak as needed
const MAX_PAGES = 20000;       // hard cap on number of pages
const MAX_DEPTH = 10;          // depth of link following

const visited = new Set();
const queue = [{ url: START_URL, depth: 0 }];

// Normalize and filter URLs
function normalizeUrl(url) {
  try {
    const u = new URL(url);

    // Only stay on www.romeoville.org
    if (u.hostname !== DOMAIN) return null;

    // Strip hash fragments (#section)
    u.hash = "";

    // Strip query strings (?EID=..., ?Mode=...)
    // This avoids thousands of "same template, different params" URLs.
    u.search = "";

    return u.toString();
  } catch {
    return null;
  }
}

(async () => {
  const browser = await puppeteer.launch({
    headless: true,
    args: ["--no-sandbox", "--disable-setuid-sandbox"],
  });
  const page = await browser.newPage();

  while (queue.length && visited.size < MAX_PAGES) {
    const { url, depth } = queue.shift();
    if (visited.has(url)) continue;
    visited.add(url);

    console.log(`Crawling (${visited.size}) [depth ${depth}]: ${url}`);

    try {
      await page.goto(url, {
        waitUntil: "networkidle2",
        timeout: 60000,
      });

      if (depth >= MAX_DEPTH) continue;

      const links = await page.$$eval("a[href]", (anchors) =>
        anchors.map((a) => a.href)
      );

      for (const link of links) {
        const normalized = normalizeUrl(link);
        if (!normalized) continue;
        if (!visited.has(normalized)) {
          queue.push({ url: normalized, depth: depth + 1 });
        }
      }
    } catch (err) {
      console.error(`Error crawling ${url}: ${err.message}`);
    }
  }

  await browser.close();

  const outPath = path.join(__dirname, "all-urls.txt");
  const sorted = Array.from(visited).sort();
  fs.writeFileSync(outPath, sorted.join("\n"), "utf8");

  console.log(`\nDone. Saved ${sorted.length} URLs to ${outPath}`);
})();
