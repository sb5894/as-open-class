// Run from the repository root: node scripts/optimize-school-map.mjs
// Encoding/resizing only; illustration edits are performed with image_gen.
import { chromium } from '@playwright/test';
import { readFile, writeFile, stat } from 'node:fs/promises';
const source = 'materials/derived/maps/school-guide-v1.png';
const browser = await chromium.launch({ headless: true });
try {
  const page = await browser.newPage();
  const data = `data:image/png;base64,${(await readFile(source)).toString('base64')}`;
  for (const width of [768, 1024]) {
    const result = await page.evaluate(async ({ data, width }) => {
      const img = new Image(); img.src = data; await img.decode();
      const canvas = document.createElement('canvas');
      canvas.width = width; canvas.height = Math.round(img.height * width / img.width);
      const ctx = canvas.getContext('2d');
      ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
      return { url: canvas.toDataURL('image/webp', 0.82), height: canvas.height,
        cornerAlpha: ctx.getImageData(0, 0, 1, 1).data[3] };
    }, { data, width });
    if (!result.url.startsWith('data:image/webp;')) throw new Error('WebP encoding unavailable');
    const path = `materials/derived/maps/school-guide-v1-${width}.webp`;
    await writeFile(path, Buffer.from(result.url.split(',')[1], 'base64'));
    console.log(JSON.stringify({ path, width, height: result.height,
      bytes: (await stat(path)).size, cornerAlpha: result.cornerAlpha }));
  }
} finally { await browser.close(); }
