import puppeteer from 'puppeteer-core';

const allSizes = [
  { name: 'iphone-se', w: 375, h: 667 },
  { name: 'iphone-12', w: 390, h: 844 },
  { name: 'ipad-mini', w: 768, h: 1024 },
  { name: 'ipad-pro', w: 1024, h: 1366 },
  { name: 'desktop-hd', w: 1280, h: 800 },
  { name: 'desktop-fhd', w: 1920, h: 1080 },
];

const sections = [
  { id: 'hero', label: 'hero' },
  { id: 'stolen-things', label: 's2-stolen' },
  { id: 'empathy', label: 's3-empathy' },
  { id: 'industry-structure', label: 's4-industry' },
];

const argv = process.argv.slice(2);
const sizes = argv.includes('--md-only')
  ? allSizes.filter((s) => ['iphone-se', 'desktop-hd'].includes(s.name))
  : allSizes;
const onlySection = argv.find((a) => a.startsWith('--section='));
const targetSections = onlySection
  ? sections.filter((s) => s.id === onlySection.split('=')[1])
  : sections;
const heroOnly = argv.includes('--hero-only');
const sectionsToShoot = heroOnly ? sections.slice(0, 1) : targetSections;

const browser = await puppeteer.launch({
  executablePath: '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',
  headless: 'new',
  args: ['--no-sandbox'],
});

for (const { name, w, h } of sizes) {
  const page = await browser.newPage();
  await page.setViewport({ width: w, height: h, deviceScaleFactor: 1 });
  await page.goto('http://127.0.0.1:5173/', { waitUntil: 'networkidle0', timeout: 15000 });
  await new Promise((r) => setTimeout(r, 700));

  for (const sec of sectionsToShoot) {
    await page.evaluate((id) => {
      const el = document.getElementById(id);
      if (!el) return;
      const rect = el.getBoundingClientRect();
      window.scrollTo({ top: window.scrollY + rect.top, behavior: 'instant' });
    }, sec.id);
    await new Promise((r) => setTimeout(r, 1100));
    await page.screenshot({
      path: `/tmp/katakaru-shots-real/${sec.label}-${name}-${w}x${h}.png`,
    });
    console.log(`shot: ${sec.label} ${name} ${w}x${h}`);
  }

  await page.close();
}

await browser.close();
