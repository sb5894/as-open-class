import { test, expect } from '@playwright/test';
import { readFileSync } from 'node:fs';
import type { Catalog } from '../../src/data/catalog';

const catalog: Catalog = JSON.parse(readFileSync('src/data/catalog.generated.json', 'utf8'));

test('latest class descriptions appear in the intended lesson without changing its location', async ({ page }) => {
  test.setTimeout(120000);
  const updated = catalog.lessons.filter(lesson => lesson.source.supplementalClassRow);
  expect(updated).toHaveLength(14);
  for (const lesson of updated) {
    await page.goto(`/lessons/${lesson.id}`);
    const fields = lesson.source.supplementalClassRow!.fields;
    for (const [field, label] of [['context', '학급 맥락'], ['observation', '참관 포인트'], ['support', '지원인력·환경']] as const) {
      if (fields.includes(field)) {
        const text = await page.getByRole('heading', { name: label, exact: true }).evaluate(node => node.nextElementSibling?.textContent);
        expect(text).toBe(lesson[field]);
      }
    }
    if (fields.includes('lenses')) await expect(page.locator('.lens-button')).toHaveText(lesson.lenses);
    if (lesson.id === 'lesson-5-1') {
      await expect(page.locator('.location')).toHaveText('📍 본관 2층 1과학실');
      await expect(page.locator('.pdf-placeholder')).toHaveText('자료 업로드 예정');
    }
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
  }
});

test('grade focus stays visible for separate lessons and is absent for non-grade classes', async ({ page }) => {
  for (const [id, text] of [['lesson-1-1', '1~2학년 중점: 놀이로 만나기'], ['lesson-3-2', '3~4학년 중점: 문화로 배우기'], ['lesson-5-1', '5~6학년 중점: 소통으로 어울리기'], ['lesson-6-1', '5~6학년 중점: 소통으로 어울리기']]) {
    await page.goto(`/lessons/${id}`);
    await expect(page.locator('.lesson-grade-focus')).toHaveText(text);
  }
  for (const id of ['lesson-multicultural-red', 'lesson-kindergarten-joint']) {
    await page.goto(`/lessons/${id}`);
    await expect(page.locator('h1')).toHaveCount(1);
    await expect(page.locator('.lesson-grade-focus')).toHaveCount(0);
  }
  for (const id of ['lesson-1-1', 'lesson-1-2']) {
    await page.goto(`/lessons/${id}`);
    await expect(page.locator('h1')).toHaveText('여러 나라 말과 몸짓으로 인사하며 알뜰 시장 놀이하기');
  }
});

test('class-specific titles and optional sections follow the latest display instructions', async ({ page }) => {
  for (const [id, topic] of [['lesson-multicultural-red', '우리 반을 글과 그림으로 소개하기'], ['lesson-multicultural-blue', '자신의 경험을 그림일기로 표현하기'], ['lesson-kindergarten-joint', '함께 가을 열매를 수확하는 협동 게임.']]) {
    await page.goto(`/lessons/${id}`);
    await expect(page.locator('h1')).toHaveText(topic);
  }
  await expect(page.locator('main h3')).toHaveText(['수업 주제']);
  await expect(page.locator('.lens-group, .text-placeholder')).toHaveCount(0);
  await page.goto('/lessons/lesson-1-2');
  await expect(page.getByRole('heading', { name: '학급 맥락', exact: true })).toBeVisible();
  await expect(page.getByRole('heading', { name: '지원인력·환경', exact: true })).toHaveCount(0);
  await page.goto('/lessons/lesson-6-1');
  const context = await page.getByRole('heading', { name: '학급 맥락', exact: true }).evaluate(node => node.nextElementSibling?.textContent);
  expect(context).not.toMatch(/[\r\n]/);
  expect(context).toContain('있는 학급');
  await expect(page.getByRole('heading', { name: '지원인력·환경', exact: true })).toBeVisible();
  await page.goto('/guide/main/2');
  for (const id of ['multicultural-red', 'multicultural-green', 'multicultural-blue']) {
    const lesson = catalog.lessons.find(item => item.classId === id)!;
    const group = page.locator(`.floor-topic[data-lesson-ids="${lesson.id}"]`);
    await expect(group.locator('h3')).toHaveText(catalog.classes.find(item => item.id === id)!.name);
    await expect(group.locator('p')).toHaveText(lesson.topic ?? '자료 업로드 예정입니다.');
  }
});
