import { test, expect } from '@playwright/test';
import { readFileSync } from 'node:fs';
import { createHash } from 'node:crypto';

interface PdfUpdate { id: string; classes: string[]; pdfSha256: string; pageCount: number }
const updates: PdfUpdate[] = JSON.parse(readFileSync('docs/reviews/pdf-updates-1102.json', 'utf8'));

for (const update of updates) {
  test(`November 2 PDF ${update.id} has the exact new bytes and renders for its intended classes`, async ({ page }) => {
    test.setTimeout(90000);
    // These checks must never submit registrations or add production spreadsheet rows.
    await page.route('**/api/**', route => route.abort());
    const errors: string[] = [];
    page.on('pageerror', error => errors.push(error.message));
    for (const classId of update.classes) {
      const download = page.waitForResponse(response => new URL(response.url()).pathname === `/pdfs/${update.id}.pdf`);
      await page.goto(`/lessons/lesson-${classId}`);
      const response = await download;
      expect(response.ok()).toBe(true);
      expect(createHash('sha256').update(await response.body()).digest('hex')).toBe(update.pdfSha256);
      await expect(page.locator('.pdf-placeholder')).toHaveCount(0);
      await expect(page.locator('.pdf-page canvas')).toHaveCount(update.pageCount);
      for (const canvas of [page.locator('.pdf-page canvas').first(), page.locator('.pdf-page canvas').last()]) {
        await canvas.scrollIntoViewIfNeeded();
        await expect(canvas).toHaveAttribute('data-rendered', 'true');
        expect(await canvas.evaluate((node: HTMLCanvasElement) => node.width > 100 && node.height > 100)).toBe(true);
      }
      await expect(page.getByRole('link', { name: 'PDF 새 탭에서 열기' })).toHaveAttribute('href', `/pdfs/${update.id}.pdf`);
      expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
      if (classId === '5-1') await expect(page.locator('.location')).toHaveText('📍 본관 2층 1과학실');
      if (classId === '4-5') await expect(page.locator('.location')).toHaveText('📍 본관 2층 2과학실');
    }
    expect(errors).toEqual([]);
  });
}

test('the unrelated missing 6-3 plan remains missing without a PDF fallback', async ({ page }) => {
  const pdfs: string[] = [];
  page.on('request', request => { if (new URL(request.url()).pathname.endsWith('.pdf')) pdfs.push(request.url()); });
  await page.goto('/lessons/lesson-6-3');
  await expect(page.locator('.pdf-placeholder')).toHaveText('자료 업로드 예정');
  expect(pdfs).toEqual([]);
});
