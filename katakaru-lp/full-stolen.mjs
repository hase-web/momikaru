import puppeteer from 'puppeteer-core';
const browser = await puppeteer.launch({
  executablePath: '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',
  headless: 'new',
  args: ['--no-sandbox'],
});

const targets = (process.argv[2] || 'stolen-things,empathy,industry-structure').split(',');
const sizesArg = process.argv[3] || 'mobile,iphone12,desktop';
const allSizes = {
  mobile: { name: 'mobile', w: 375, h: 667 },
  iphone12: { name: 'iphone12', w: 390, h: 844 },
  desktop: { name: 'desktop', w: 1280, h: 800 },
  desktopfhd: { name: 'desktopfhd', w: 1920, h: 1080 },
};
const sizes = sizesArg.split(',').map((k) => allSizes[k]).filter(Boolean);

for (const sectionId of targets) {
  for (const { name, w, h } of sizes) {
    const page = await browser.newPage();
    await page.setViewport({ width: w, height: h, deviceScaleFactor: 1 });
    await page.goto('http://127.0.0.1:5173/', { waitUntil: 'networkidle0' });
    await new Promise((r) => setTimeout(r, 500));
    const totalHeight = await page.evaluate(() => document.documentElement.scrollHeight);
    for (let y = 0; y <= totalHeight; y += 250) {
      await page.evaluate((y) => window.scrollTo(0, y), y);
      await new Promise((r) => setTimeout(r, 60));
    }
    await new Promise((r) => setTimeout(r, 600));
    const box = await page.evaluate((id) => {
      const el = document.getElementById(id);
      const r = el.getBoundingClientRect();
      return { top: window.scrollY + r.top, height: r.height };
    }, sectionId);
    const label = sectionId.replace('-things', '').replace('-structure', '').replace(/-/g, '');
    await page.screenshot({
      path: `/tmp/katakaru-shots-real/${label}-${name}.png`,
      clip: { x: 0, y: box.top, width: w, height: Math.ceil(box.height) },
      captureBeyondViewport: true,
    });
    console.log(`shot ${label}-${name} h=${Math.ceil(box.height)}`);
    await page.close();
  }
}

await browser.close();
