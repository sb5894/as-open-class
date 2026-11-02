import { test, expect } from '@playwright/test';

const senior = '‘시장놀이’를 하기 위한 인사말 배우기';
const moral = '개인의 자유와 전체의 평등 중 무엇이 옳은지 생각하기';
const korean = '언어 전문가 부스에서 만나는 다양한 말과 소통';

test.beforeEach(async ({ page }) => { await page.route('**/api/**', route => route.abort()); });

test('uploaded lesson topics appear in detail titles and story fields, with the checked senior lenses', async ({ page }) => {
  for (const [id, topic] of [['1-3', senior], ['5-1', moral], ...['5-2', '5-3', '5-4', '5-5'].map(id => [id, korean])]) {
    await page.goto(`/lessons/lesson-${id}`);
    await expect(page.locator('h1')).toHaveText(topic);
    const heading = page.getByRole('heading', { name: '수업 주제', exact: true });
    expect(await heading.evaluate(node => node.nextElementSibling?.textContent)).toBe(topic);
    if (id === '1-3') {
      await expect(page.locator('.lens-button')).toHaveText(['참여', '표현']);
      for (const [label, value] of [
        ['학급 맥락', '다양한 나라의 인사말(안녕하세요, 감사합니다)을 놀이를 통해 배우는 수업'],
        ['참관 포인트', '다른 언어로 활동에 참여해보려고 노력하고, 친구를 배려하며 함께 놀이에 참여하는 모습'],
      ]) {
        const field = page.getByRole('heading', { name: label, exact: true });
        expect(await field.evaluate(node => node.nextElementSibling?.textContent)).toBe(value);
      }
      await expect(page.getByRole('heading', { name: '지원인력·환경', exact: true })).toHaveCount(0);
    }
    if (id === '5-1') await expect(page.locator('.location')).toHaveText('📍 본관 2층 1과학실');
  }
});

test('registration choices use the same new topics without changing the selection IDs', async ({ page }) => {
  await page.goto('/register');
  await page.locator('.preference-disclosure summary').click();
  for (const [id, topic] of [['lesson-1-3', senior], ['lesson-5-1', moral], ['grade-5', korean]]) {
    await expect(page.locator('.lesson-choice').filter({ has: page.locator(`input[value="${id}"]`) })).toContainText(topic);
  }
  await expect(page.locator('.lesson-choice')).toHaveCount(14);
});

test('floor topic lists use the new text and main 2F follows the requested class order', async ({ page }) => {
  await page.goto('/guide/main/2');
  const second = page.locator('#floor-2 .floor-topics');
  await expect(second.locator('h3')).toHaveText(['다문화특별학급 1반(빨강)', '다문화특별학급 2반(초록)', '다문화특별학급 3반(파랑)', '5-1 도덕', '4-5 과학']);
  await expect(second.locator('[data-lesson-ids="lesson-5-1"] p')).toHaveText(moral);
  await expect(page.locator('#floor-3 .floor-topics')).toContainText(korean);
  await expect(page.locator('#floor-3 .floor-topics')).not.toContainText('가면으로 떠나는 세계 여행');
  await page.goto('/guide/rear/2');
  await expect(page.locator('#floor-2 [data-lesson-ids="lesson-1-3"] p')).toHaveText(senior);
});

test('science rooms display their class on a lower line at narrow and wide viewport widths', async ({ page }, testInfo) => {
  for (const width of [320, 390, 430, 1440]) {
    await page.setViewportSize({ width, height: 900 });
    await page.goto('/guide/main/2');
    for (const [space, room, suffix] of [['science-1', '1과학실', '(5-1)'], ['science-2', '2과학실', '(4-5)']]) {
      const link = page.locator(`#floor-2 svg a[data-space-id="${space}"]`);
      await expect(link).toHaveAttribute('aria-label', new RegExp(`${room} \\${suffix[0]}${suffix.slice(1, -1)}\\)`));
      await expect(link.locator('text')).toHaveCount(1);
      const lines = await link.locator('text tspan').allTextContents();
      expect(lines).toEqual([room, suffix]);
      const bounds = await link.evaluate(node => {
        const rect = node.querySelector('rect')!.getBBox();
        const text = node.querySelector('text')!.getBBox();
        const last = node.querySelector<SVGTSpanElement>('text tspan:last-child')!.getStartPositionOfChar(0);
        const first = node.querySelector<SVGTSpanElement>('text tspan')!.getStartPositionOfChar(0);
        const view = node.closest('svg')!.viewBox.baseVal;
        return { rect: {x:rect.x,y:rect.y,width:rect.width,height:rect.height},
          text: {x:text.x,y:text.y,width:text.width,height:text.height},
          fitsWidth: text.x >= rect.x && text.x + text.width <= rect.x + rect.width + 1,
          fitsHeight: text.y >= rect.y && text.y + text.height <= rect.y + rect.height + 1,
          lowerLine: last.y > first.y,
          insideDrawing: rect.x >= view.x && rect.x + rect.width <= view.x + view.width + 1 };
      });
      expect(bounds, `${width}px ${space}: ${JSON.stringify(bounds)}`).toMatchObject({fitsWidth:true, fitsHeight:true, lowerLine:true, insideDrawing:true});
    }
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
    if (width === 320) await page.locator('#floor-2').screenshot({ path: `tmp/pdf-update-1102/${testInfo.project.name}-science-class-labels.png` });
  }
});
