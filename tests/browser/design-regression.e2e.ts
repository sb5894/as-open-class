import { test, expect } from '@playwright/test';

test('home tables remain readable at 200 percent text size and the final section clears the application bar', async ({ page }) => {
  for (const width of [320, 390]) {
    await page.setViewportSize({ width, height: 740 });
    await page.goto('/');
    await page.evaluate(() => document.fonts.ready);
    expect(await page.evaluate(() => [...document.fonts].some(face => face.family.includes('Noto Sans KR') && face.status === 'loaded'))).toBe(true);
    expect(await page.evaluate(() => [...document.querySelectorAll('*')].every(node => ['400', '600', '700'].includes(getComputedStyle(node).fontWeight)))).toBe(true);
    await page.addStyleTag({ content: 'html { font-size: 200%; }' });
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
    for (const table of await page.locator('.home-content table').all()) {
      expect(await table.evaluate(node => {
        const bounds = node.getBoundingClientRect();
        return bounds.left >= 0 && bounds.right <= innerWidth;
      })).toBe(true);
    }
    await page.evaluate(() => window.scrollTo(0, document.documentElement.scrollHeight));
    expect(await page.evaluate(() => document.querySelector('.grade-focus')!.getBoundingClientRect().bottom
      <= document.querySelector('.home-mobile-dock')!.getBoundingClientRect().top)).toBe(true);
  }
});

test('shared navigation and keyboard skip remain usable when web fonts fail', async ({ page }) => {
  test.slow(); // Several direct routes, including a PDF page, in both engines.
  await page.route('**/*.woff2', route => route.fulfill({ status: 503, body: '' }));
  await page.route('**/*.woff', route => route.fulfill({ status: 503, body: '' }));
  await page.setViewportSize({ width: 320, height: 740 });
  let header: string | undefined;
  for (const path of ['/', '/register', '/guide', '/guide/main', '/guide/parking', '/lessons/lesson-3-2', '/not-found']) {
    await page.goto(path, { waitUntil: 'domcontentloaded' });
    const navigation = page.getByRole('navigation', { name: '주 메뉴', exact: true });
    header ??= await navigation.innerHTML();
    expect(await navigation.innerHTML()).toBe(header);
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
    const skip = page.getByRole('link', { name: '본문 바로가기', exact: true });
    // WebKit's native Tab order depends on the host's keyboard-access setting.
    await skip.focus();
    await expect(skip).toBeFocused();
    await expect(skip).toBeInViewport();
    await page.keyboard.press('Enter');
    await expect(page.locator('main')).toBeFocused();
  }
});

test('reordered senior and moral choices keep their API IDs and question errors retain their accessible description', async ({ page }) => {
  const requests: unknown[] = [];
  await page.route('**/api/registrations', async route => {
    requests.push(route.request().postDataJSON());
    await route.fulfill({ status: 201, json: { ok: true, status: 'saved', registrationId: 'mock-only', submittedAt: '2026-10-21T00:00:00Z' } });
  });
  await page.goto('/register');
  for (const [label, value] of [['지역(시)', '안성시'], ['소속교', '시험학교'], ['직위', '교사'], ['성함', '모의 검증']]) {
    await page.getByLabel(label, { exact: true }).fill(value);
  }
  const question = page.getByLabel('연구학교 운영과 관련하여 궁금한 점이 있으신가요? (선택, 최대 2,000자)', { exact: true });
  await expect(question).toHaveAttribute('maxlength', '2000');
  await question.evaluate(node => { (node as HTMLTextAreaElement).value = '가'.repeat(2001); });
  await page.locator('#registration-consent').check();
  await page.getByRole('button', { name: '신청 제출', exact: true }).click();
  await expect(question).toBeFocused();
  await expect(question).toHaveAttribute('aria-describedby', 'registration-question-error');
  expect(requests).toHaveLength(0);
  await question.fill('운영 사례를 알고 싶습니다.');
  await expect(question).not.toHaveAttribute('aria-invalid');
  await expect(question).not.toHaveAttribute('aria-describedby');
  await page.locator('.preference-disclosure summary').click();
  await page.locator('input[value="lesson-1-3"]').check();
  await page.locator('input[value="lesson-5-1"]').check();
  await expect(page.locator('.lesson-choice input:disabled')).toHaveCount(12);
  await expect(page.getByText('선택한 수업: 수석교사 · 1-3 / 도덕 전담 · 5-1', { exact: true })).toBeVisible();
  await page.getByRole('button', { name: '신청 제출', exact: true }).click();
  await expect(page.getByRole('status')).toContainText('신청이 완료되었습니다.');
  expect(requests).toHaveLength(1);
  expect(requests[0]).toMatchObject({ lessonIds: ['lesson-1-3', 'lesson-5-1'], question: '운영 사례를 알고 싶습니다.' });
});
