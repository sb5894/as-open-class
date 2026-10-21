import { test, expect } from '@playwright/test';
import { createRegistrationApi, registrationRow } from '../../functions/src/registrations';

test('updated topics render with the intended shared and science PDFs', async ({ page }) => {
  test.slow();
  for (const [id, topic, pdf] of [
    ['lesson-4-5', '기후 변화 현상의 예를 알고 인간 활동과의 관련성 설명하기', 'special-4-5'],
    ['lesson-6-1', '나의 건강 습관 보고서 쓰기', 'special-6-1'],
    ['lesson-multicultural-red', '우리 반을 글과 그림으로 소개하기', 'multicultural-red'],
    ['lesson-multicultural-green', '우리 반을 글과 그림으로 소개하기', 'multicultural-red'],
  ]) {
    const response = page.waitForResponse(response => new URL(response.url()).pathname === `/pdfs/${pdf}.pdf`);
    await page.goto(`/lessons/${id}`);
    await expect(page.locator('h1')).toHaveText(topic);
    expect((await response).ok()).toBe(true);
    await expect(page.locator('.pdf-page canvas').first()).toHaveAttribute('aria-label', '수업 지도안 1페이지');
    await expect(page.locator('.pdf-placeholder')).toHaveCount(0);
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
  }
});

test('merged multicultural choice counts as one and 6-3 submits independently through the mock storage adapter', async ({ page }) => {
  const rows: string[][] = [];
  const api = createRegistrationApi({isConfigured:()=>true, append:async record=>{ rows.push(registrationRow(record)); }});
  await page.route('**/api/registrations', async route => {
    const result = await api({method:'POST', path:'/api/registrations', contentType:'application/json', body:route.request().postDataJSON(), bodyBytes:500});
    await route.fulfill({status:result.status, json:result.body});
  });
  await page.goto('/register');
  await page.locator('.preference-disclosure summary').tap();
  const merged = page.locator('input[value="multicultural-red-green"]');
  await merged.check();
  await expect(page.locator('#preference-count')).toHaveText('선택 1 / 2');
  await expect(page.locator('.lesson-choice').filter({has:merged})).toContainText('우리 반을 글과 그림으로 소개하기');
  const grade = page.locator('input[value="grade-6"]');
  const separate = page.locator('input[value="lesson-6-3"]');
  await expect(page.locator('.lesson-choice').filter({has:grade})).not.toContainText('맞혀봐');
  await expect(page.locator('.lesson-choice').filter({has:separate})).toContainText('맞혀봐');
  await separate.check();
  await expect(grade).toBeDisabled();
  await expect(page.locator('#preference-count')).toContainText('선택 2 / 2');
  for (const label of ['지역(시)', '소속교', '직위', '성함']) await page.getByLabel(label, {exact:true}).fill('모의 검증');
  await expect(page.getByLabel('연구학교 운영과 관련하여 궁금한 점이 있으신가요? (선택, 최대 2,000자)', {exact:true})).toHaveAttribute('maxlength', '2000');
  await page.getByLabel('개인정보 수집·이용에 동의합니다. (필수)', {exact:true}).check();
  await page.getByRole('button', {name:'신청 제출'}).tap();
  await expect(page.getByRole('status')).toContainText('신청이 완료되었습니다.');
  expect(rows).toHaveLength(1);
  expect(rows[0].slice(7,9)).toEqual(['lesson-6-3 / multicultural-red-green', '6-3 / 다문화특별학급 빨강·초록반']);
});

test('live API accepts the new choice IDs but rejects missing consent without saving', async ({ request }) => {
  test.skip(process.env.VERIFY_LIVE_API !== 'true', 'Opt in only for the deployed API.');
  const result = await request.post('/api/registrations', {data:{city:'검증',school:'검증',assignment:'검증',name:'검증',lessonIds:['lesson-6-3','multicultural-red-green'],consent:false}});
  expect(result.status()).toBe(400);
  const body = await result.json();
  expect(body.fieldErrors.consent).toBeTruthy();
  expect(body.fieldErrors.lessonIds).toBeUndefined();
});
