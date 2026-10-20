import { test, expect } from '@playwright/test';
import { createRegistrationApi, type RegistrationRecord, registrationRow } from '../../functions/src/registrations';

test('model-two reference images and invitation emphasis remain readable on mobile', async ({ page }) => {
  await page.goto('/');
  await expect(page.locator('#event .event-facts > li')).toHaveCount(4);
  await expect(page.locator('#event .event-facts strong')).toHaveText(['일시: 2026. 11. 11.(수) 12:50~16:00', '신청 기한: 2026. 10. 28.(수) 16:00까지']);
  await expect(page.locator('#event > p strong')).toHaveText('「상호문화적 (만남·배움·어울림) 이중언어 교육 프로그램 운영을 통한 미래 핵심역량 함양」');
  await expect(page.locator('.model-two h2')).toHaveText('만남·배움·어울림이란?');
  expect(await page.locator('.event-schedule').evaluate(node => node.nextElementSibling?.classList.contains('model-two'))).toBe(true);
  const modelLink = page.getByRole('link', { name: '만남·배움·어울림', exact: true });
  await expect(modelLink).toHaveCSS('color', 'rgb(24, 91, 170)');
  await expect(modelLink).toHaveCSS('text-decoration-line', 'underline');
  await modelLink.tap();
  await expect(page).toHaveURL(/#model-two$/);
  await expect(page.locator('#model-two h2')).toBeInViewport();
  await expect(page.locator('.model-two-table thead th')).toHaveText(['원리', '한눈에 보면', '참관자가 볼 장면']);
  for (const [name, summary, scene] of [
    ['만남', '차이를 알아차리고 관계 시작', '낯선 언어·문화에 관심을 갖고 질문하기'],
    ['배움', '서로의 언어·경험으로 이해 넓히기', '비교·탐구하며 경험을 배움에 활용하기'],
    ['어울림', '서로의 강점을 연결해 함께 만들기', '역할을 나누고 공동의 결과 만들기'],
  ]) {
    const step = page.getByRole('row', { name, exact: true });
    await step.scrollIntoViewIfNeeded();
    await expect(step.locator('td')).toHaveText([summary, scene]);
    await expect.poll(() => step.locator('img').evaluate(node => (node as HTMLImageElement).naturalWidth)).toBe(183);
    expect((await step.locator('img').boundingBox())!.width).toBeLessThanOrEqual(64);
  }
  for (const width of [320, 390, 430]) {
    await page.setViewportSize({ width, height: 740 });
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
    expect(await page.locator('.model-two-table td').evaluateAll(cells => cells.every(cell => {
      const bounds = cell.getBoundingClientRect();
      return [...cell.querySelectorAll('span')].every(word => {
        const range = document.createRange(); range.selectNodeContents(word);
        const rects = [...range.getClientRects()];
        return rects.length === 1 && rects[0].left >= bounds.left && rects[0].right <= bounds.right;
      });
    }))).toBe(true);
  }
  await page.screenshot({ path: `test-results/${test.info().project.name}-1020-home.png`, fullPage: true });
  await page.getByRole('link', { name: '참관 신청하기', exact: true }).tap();
  await expect(page).toHaveURL(/\/register$/);
});

test('kindergarten selection reaches the server without fetching an old PDF', async ({ page }) => {
  const saved: RegistrationRecord[] = [];
  const api = createRegistrationApi({ isConfigured: () => true, append: async record => { saved.push(record); } });
  await page.route('**/api/registrations', async route => {
    const result = await api({ method: 'POST', path: '/api/registrations', contentType: 'application/json', body: route.request().postDataJSON(), bodyBytes: 400 });
    await route.fulfill({ status: result.status, json: result.body });
  });
  await page.goto('/register');
  const deadline = page.locator('main > .registration-deadline');
  await expect(deadline).toHaveText('신청 기한: 2026. 10. 28.(수) 16:00까지');
  expect(await deadline.evaluate(node => node.previousElementSibling?.tagName)).toBe('H1');
  for (const [label, value] of [['지역(시)', '안성'], ['소속교', '시험학교'], ['직위', '교사'], ['성함', '유치원 선택 시험']]) await page.getByLabel(label, { exact: true }).fill(value);
  await page.getByLabel('직위', { exact: true }).focus();
  await expect(page.getByLabel('직위', { exact: true })).toHaveCSS('outline-color', 'rgb(121, 99, 165)');
  await expect(page.locator('.registration-preferences')).toContainText('선택한 수업: 없음');
  await page.locator('.preference-disclosure summary').tap();
  const choice = page.locator('.lesson-choice').filter({ has: page.getByText('유치원', { exact: true }) }).locator('input');
  await choice.check(); await choice.uncheck();
  await expect(page.locator('.registration-preferences')).toContainText('선택한 수업: 없음');
  await choice.check();
  await page.locator('#registration-consent').check();
  await page.getByRole('button', { name: '신청 제출' }).tap();
  await expect(page.getByRole('status')).toContainText('신청이 완료되었습니다.');
  expect(saved).toHaveLength(1);
  expect(registrationRow(saved[0]).slice(7, 9)).toEqual(['lesson-kindergarten-joint', '유치원 공동 수업(샘물·햇살·풀잎반)']);
  const pdfRequests: string[] = [];
  page.on('request', request => { if (/\/pdfs\/.*\.pdf/.test(request.url())) pdfRequests.push(request.url()); });
  await page.goto('/guide/main/1');
  const kindergarten = page.locator('#floor-1 svg a[data-space-id="kindergarten-public"]');
  await kindergarten.tap();
  await expect(page.locator('.location')).toHaveText('📍 본관 1층 유치원');
  await expect(page.locator('.pdf-placeholder')).toHaveText('자료 업로드 예정');
  await expect(page.locator('main .text-placeholder')).toContainText(['자료 업로드 예정입니다.', '자료 업로드 예정입니다.', '자료 업로드 예정입니다.', '자료 업로드 예정입니다.']);
  expect(pdfRequests).toEqual([]);
});

test('new main-building facilities keep their placement, purpose and labels on mobile', async ({ page }) => {
  const rect = async (selector: string) => page.locator(selector).evaluate(node => {
    const b = (node as SVGGraphicsElement).getBBox(); return { x: b.x, y: b.y, width: b.width, height: b.height };
  });
  for (const width of [320, 390, 430]) {
    await page.setViewportSize({ width, height: 740 });
    await page.goto('/guide');
    const auditorium = page.locator('.map-auditorium-label');
    await expect(auditorium).toHaveText('시청각실\n공개보고회장');
    const exhibition = page.locator('.map-exhibition-label');
    await expect(exhibition).toHaveText('소모임실\n자료 전시');
    await expect(auditorium).toHaveCSS('font-size', '11px');
    await expect(exhibition).toHaveCSS('background-color', 'rgb(222, 208, 255)');
    await expect(page.locator('.map-entrance-label')).toHaveText('등록 장소:\n본관 1층 중앙현관');
    const labelBounds = (await auditorium.boundingBox())!;
    const entrance = (await page.locator('.map-entrance-label').boundingBox())!;
    expect(labelBounds.x + labelBounds.width <= entrance.x || labelBounds.y + labelBounds.height <= entrance.y || entrance.y + entrance.height <= labelBounds.y).toBe(true);
    const exhibitBounds = (await exhibition.boundingBox())!;
    expect(labelBounds.y + labelBounds.height).toBeLessThan(exhibitBounds.y);
    expect(exhibitBounds.y + exhibitBounds.height).toBeLessThan(entrance.y);
    await auditorium.tap();
    await expect(page).toHaveURL(/\/guide\/main\/4$/);
    await expect(page.locator('#floor-4 .plan-event-space')).toHaveCount(2);
    expect(await page.locator('#floor-4 .plan-event-space').evaluateAll(nodes => nodes.map(node => [...node.querySelectorAll('.room-purpose')].map(span => span.textContent).join('').replace(/\s/g, '')))).toEqual(['자료전시', '공개보고회장']);
    const center = await rect('#floor-3 .plan-language-center rect');
    const five2 = await rect('[data-space-id="classroom-5-2"] rect');
    const five3 = await rect('[data-space-id="classroom-5-3"] rect');
    expect(center.x).toBeGreaterThanOrEqual(five2.x + five2.width - .01);
    expect(center.x + center.width).toBeLessThanOrEqual(five3.x + .01);
    const auditoriumRect = await rect('#floor-4 .plan-event-space[data-source-y="40"] rect');
    const elevator = await rect('#floor-4 .facility-elevator rect');
    const upperStair = await rect('#floor-4 .facility-stairs[data-source-y="40"] rect');
    expect(auditoriumRect.x).toBeCloseTo(elevator.x + elevator.width, 1);
    expect(auditoriumRect.x + auditoriumRect.width).toBeCloseTo(upperStair.x, 1);
    const kindergarten = await rect('#floor-1 [data-space-id="kindergarten-public"] rect');
    const corridor = await rect('#floor-1 .plan-corridor');
    expect(kindergarten.y).toBe(corridor.y);
    expect(kindergarten.y + kindergarten.height).toBeGreaterThan(corridor.y + corridor.height);
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
    for (const selector of ['#floor-3 .plan-language-center', '#floor-4 .plan-event-space']) for (const room of await page.locator(selector).all()) {
      expect(await room.evaluate(node => { const r = node.querySelector('rect')!.getBBox(); return [...node.querySelectorAll('text')].every(text => { const b = text.getBBox(); return b.width > 0 && b.x >= r.x - .1 && b.x + b.width <= r.x + r.width + .1 && b.y >= r.y - .1 && b.y + b.height <= r.y + r.height + .1; }); })).toBe(true);
    }
  }
  await page.screenshot({ path: `test-results/${test.info().project.name}-1020-main-facilities.png`, fullPage: true });
});
