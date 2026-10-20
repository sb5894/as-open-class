import { test, expect } from '@playwright/test';
import { readFileSync } from 'node:fs';
import { createRegistrationApi, registrationRow, type RegistrationRecord } from '../../functions/src/registrations';

test('feedback schedule is shared and disclosure is independent of required consent', async ({ page }) => {
  const saved: RegistrationRecord[] = [];
  const api = createRegistrationApi({ isConfigured: () => true, append: async record => { saved.push(record); } });
  let requests = 0;
  await page.route('**/api/registrations', async route => {
    requests++;
    const result = await api({ method: 'POST', path: '/api/registrations', contentType: 'application/json', body: route.request().postDataJSON(), bodyBytes: 500 });
    await route.fulfill({ status: result.status, json: result.body });
  });
  await page.goto('/');
  const schedule = await page.locator('.event-schedule table').innerText();
  for (const width of [320, 390, 430]) {
    await page.setViewportSize({ width, height: 740 });
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
  }
  await page.getByRole('link', { name: '참관 신청하기', exact: true }).tap();
  expect(await page.locator('.event-schedule table').innerText()).toBe(schedule);
  await expect(page.locator('#event')).toHaveCount(0);
  await expect(page.getByLabel('담당 학년·교과', { exact: true })).toHaveCount(0);
  for (const [label, value] of [['지역(시)', '경기도'], ['소속교', '교육청'], ['직위', '장학사'], ['성함', '시험 신청자']]) {
    await page.getByLabel(label, { exact: true }).fill(value);
  }
  const consent = page.getByLabel('개인정보 수집·이용에 동의합니다. (필수)', { exact: true });
  const privacy = page.locator('.privacy-disclosure');
  await expect(consent).not.toBeChecked();
  await expect(consent).toBeVisible();
  await expect(privacy).not.toHaveAttribute('open', '');
  const summary = privacy.locator('summary');
  await expect(summary).toHaveCSS('color', 'rgb(22, 77, 145)');
  await expect(summary).toHaveCSS('text-decoration-line', 'underline');
  await summary.tap();
  for (const text of ['수집·이용 목적', '지역, 소속, 직위, 성명, 문의 내용(선택)', '2026. 11. 11.(수)까지', '동의 거부권 및 불이익']) await expect(privacy).toContainText(text);
  await expect(consent).not.toBeChecked();
  await summary.tap();
  await page.getByRole('button', { name: '신청 제출' }).tap();
  await expect(consent).toBeFocused();
  await expect(consent).toHaveAttribute('aria-invalid', 'true');
  expect(requests).toBe(0);
  expect(saved).toHaveLength(0);
  const question = page.getByLabel('연구학교 운영과 관련하여 궁금한 점이 있으신가요? (선택)', { exact: true });
  await question.fill('운영 사례를 더 알고 싶습니다.\n자료 공유가 가능한가요?');
  await consent.check();
  await expect(consent).not.toHaveAttribute('aria-invalid');
  await page.screenshot({ path: `test-results/${test.info().project.name}-feedback-registration.png`, fullPage: true });
  await page.getByRole('button', { name: '신청 제출' }).tap();
  await expect(page.getByRole('status')).toContainText('신청이 완료되었습니다.');
  expect(requests).toBe(1);
  expect(saved).toHaveLength(1);
  expect(registrationRow(saved[0]).slice(5)).toEqual(['장학사', '시험 신청자', '', '', '동의', '운영 사례를 더 알고 싶습니다.\n자료 공유가 가능한가요?']);
});

test('confirmed school map loads only on guide and route toggles on a narrow screen', async ({ page }) => {
  const requests: string[] = [];
  page.on('request', request => requests.push(request.url()));
  await page.goto('/');
  expect(requests.some(url => /school-guide-v\d-.*\.webp/.test(url))).toBe(false);
  await page.getByRole('link', { name: '보고회 둘러보기', exact: true }).tap();
  const image = page.locator('.school-map img');
  await expect(image).toBeVisible();
  await expect.poll(() => image.evaluate(node => (node as HTMLImageElement).naturalWidth)).toBeGreaterThan(0);
  await expect(page.locator('.map-entrance-label')).toHaveText('등록 장소:\n본관 1층 중앙현관');
  await expect(page.locator('.map-help')).toHaveCount(0);
  await expect(page.locator('main')).not.toContainText(/이름을 누르면|수업을 만나러 가는 길|정문 → 회색 진입로/);
  expect((await page.locator('.map-route-control').boundingBox())!.y).toBeGreaterThanOrEqual((await page.locator('.school-map-frame').boundingBox())!.y+(await page.locator('.school-map-frame').boundingBox())!.height);
  await expect(page.locator('main')).not.toContainText(/가안|정구장|대표 수업/);
  await expect(page.locator('.school-map-building')).toHaveCount(3);
  await expect(page.getByRole('link',{name:'강당',exact:true})).toHaveCount(0);
  await expect(page.locator('.school-map-static')).toHaveText(['강당','교직원 전용\n주차장']);
  expect(await page.locator('.map-staff-label').evaluate(node=>getComputedStyle(node).backgroundColor)).toBe(await page.locator('.school-map-static').first().evaluate(node=>getComputedStyle(node).backgroundColor));
  expect(await page.locator('.map-entrance-label').evaluate(node=>getComputedStyle(node).backgroundColor)).not.toBe(await page.locator('.map-parking-label').evaluate(node=>getComputedStyle(node).backgroundColor));
  expect(await page.locator('.map-parking-label').evaluate(node=>getComputedStyle(node).backgroundColor)).toBe(await page.locator('.map-route-label').evaluate(node=>getComputedStyle(node).backgroundColor));
  await page.getByLabel('주차 진입 동선 보기').uncheck();
  await expect(page.locator('.school-map-route')).toBeHidden();
  await expect(page.locator('.map-route-label')).toBeHidden();
  await expect(page.locator('.map-entrance-label')).toBeVisible();
  await page.getByLabel('주차 진입 동선 보기').check();
  await expect(page.locator('.school-map-route')).toBeVisible();
  for (const width of [430, 390, 320]) {
    await page.setViewportSize({ width, height: 740 });
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
    const frame = page.locator('.school-map-frame');
    expect(await frame.evaluate(node => node.scrollWidth <= node.clientWidth)).toBe(true);
    const mapBounds = (await frame.boundingBox())!;
    for (const label of await page.locator('.school-map-label').all()) {
      const bounds = (await label.boundingBox())!;
      expect(bounds.x).toBeGreaterThanOrEqual(mapBounds.x);
      expect(bounds.x + bounds.width).toBeLessThanOrEqual(mapBounds.x + mapBounds.width);
    }
  }
  await page.reload();
  await expect(page.locator('.school-map img')).toBeVisible();
  await page.screenshot({ path: `test-results/${test.info().project.name}-school-guide-320.png`, fullPage: true });
});

test('invitation, guide, direct refresh, history and on-demand PDF controls', async ({ page }) => {
  const requests: string[] = [];
  page.on('request', request => requests.push(request.url()));
  await page.goto('/');
  await expect(page.getByRole('heading', { level: 1 })).toHaveText('2026 안성초등학교 정책연구학교 공개보고회 참관 신청');
  await expect(page.locator('.brand')).toHaveText('안성초 공개보고회');
  await expect(page.locator('.actions a')).toHaveText(['보고회 둘러보기', '참관 신청하기']);
  await expect(page.getByRole('link', { name: '행사 소개', exact: true })).toHaveCount(0);
  await expect(page.locator('#event')).toContainText('그동안의 연구 성과와 교육과정 운영 사례를 공유하는 공개보고회에 교육 관계자 여러분을 초대합니다.');
  await expect(page.locator('#event')).toContainText('일시: 2026. 11. 11.(수) 12:50~16:00');
  await expect(page.locator('#event')).toContainText('등록: 본관 1층 중앙현관');
  await expect(page.locator('#event')).toContainText('신청 기한: 2026. 10. 28.(수) 16:00까지');
  await expect(page.locator('main')).not.toContainText('정식 행사명');
  await expect(page.locator('main')).not.toContainText('행사 시간');
  await expect(page.locator('main')).not.toContainText('수업을 먼저 만나');
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
  expect(requests.some(url => /pdfjs|pdf-viewer|\.pdf(?:\?|$)|pdf\.worker/.test(url))).toBe(false);
  await page.getByRole('link', { name: '보고회 둘러보기', exact: true }).tap();
  await expect(page).toHaveURL(/\/guide$/);
  await expect(page.locator('main')).not.toContainText('대표 수업');
  await page.reload();
  await page.getByRole('link', { name: '신관', exact: true }).tap();
  await page.locator('svg a[data-space-id="classroom-3-2"]').tap();
  await expect(page.getByRole('heading', { level: 1 })).toHaveText('우리 주변의 다양한 문화 조사하고 정리하기');
  await expect(page.locator('.location')).toHaveText('📍 신관 3층 3-2 교실');
  await expect(page.locator('.lesson-grade-focus')).toHaveText('3~4학년 중점: 문화로 배우기');
  for (const name of ['학년 공통 주제', '수업 설계', '공통 참관 포인트']) await expect(page.getByRole('heading', { name, exact: true })).toHaveCount(0);
  await expect(page.locator('.pdf-page canvas').first()).toHaveAttribute('aria-label', '수업 지도안 1페이지');
  await expect(page.getByRole('button', { name: '다음 페이지' })).toBeEnabled();
  await expect(page.getByRole('button', { name: '이전 페이지' })).toHaveText('<');
  await expect(page.getByRole('button', { name: '다음 페이지' })).toHaveText('>');
  await page.getByRole('button', { name: '다음 페이지' }).tap();
  await expect(page.locator('.pdf-page canvas').nth(1)).toBeInViewport();
  await expect(page.getByRole('button', { name: '확대', exact: true })).toBeEnabled();
  await page.getByRole('button', { name: '확대', exact: true }).tap();
  await expect(page.locator('.pdf-toolbar')).toContainText('125%');
  await expect(page.getByRole('button', { name: '축소', exact: true })).toBeEnabled();
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
  await page.screenshot({ path: `test-results/${test.info().project.name}-detail.png`, fullPage: true });
  await page.reload();
  await expect(page.locator('.pdf-page canvas').first()).toHaveAttribute('aria-label', '수업 지도안 1페이지');
  await page.goBack(); await expect(page).toHaveURL(/\/guide\/new$/);
  await page.goBack(); await expect(page).toHaveURL(/\/guide$/);
  await page.goBack(); await expect(page).toHaveURL(/\/$/);
  await page.screenshot({ path: `test-results/${test.info().project.name}-invitation.png`, fullPage: true });
});

test('registration validates choices, locks during submission and keeps inputs on failure', async ({ page }) => {
  let requests = 0;
  let release!: () => void;
  const gate = new Promise<void>(resolve => { release = resolve; });
  await page.route('**/api/registrations', async route => {
    requests++;
    expect(route.request().postDataJSON().lessonIds).toEqual(['grade-1', 'grade-2']);
    if (requests === 1) {
      await gate;
      await route.fulfill({ status: 503, json: { ok: false, code: 'SAVE_NOT_CONFIRMED', retryable: true, message: '저장 완료를 확인하지 못했습니다.' } });
    } else {
      await route.fulfill({ status: 201, json: { ok: true, status: 'saved', registrationId: 'browser-mock-only', submittedAt: '2026-10-18T00:00:00Z' } });
    }
  });
  await page.goto('/register');
  for (const [name, value] of [['지역(시)', '연결시험'], ['소속교', '시험학교'], ['직위', '영어전담'], ['성함', '브라우저 시험']]) await page.getByLabel(name, { exact: true }).fill(value);
  await page.getByLabel('개인정보 수집·이용에 동의합니다. (필수)', { exact: true }).check();
  await page.locator('.preference-disclosure summary').tap();
  const checks = page.locator('.lesson-choice input'); await checks.nth(1).tap(); await checks.nth(2).tap();
  await expect(checks.nth(3)).toBeDisabled();
  expect(await checks.count()).toBe(14);
  await expect(page.locator('.lesson-choice strong')).toHaveText(['수석교사 · 1-3', '1학년', '2학년', '3학년', '4학년', '5학년', '6학년', '다문화특별학급 1반 (빨강)', '다문화특별학급 2반 (초록)', '다문화특별학급 3반 (파랑)', '5-1 도덕', '과학 전담 · 4-5', '영어 전담 · 6-1', '유치원']);
  await page.locator('fieldset').nth(1).screenshot({ path: `test-results/${test.info().project.name}-interest-options.png` });
  await expect(page.locator('legend').nth(1)).toHaveText('관심있는 수업 (선택, 최대 2개)');
  await expect(page.locator('main')).not.toContainText('희망 수업');
  await expect(page.locator('form')).not.toContainText('3-1');
  await expect(page.locator('form')).not.toContainText('본관 2층 1과학실');
  await page.getByRole('button', { name: '신청 제출' }).tap();
  await expect(page.getByRole('button', { name: '저장 중…' })).toBeDisabled();
  release();
  await expect(page.getByRole('button', { name: '다시 제출' })).toBeEnabled();
  await expect(page.getByLabel('성함', { exact: true })).toHaveValue('브라우저 시험');
  await expect(checks.nth(1)).toBeChecked(); expect(requests).toBe(1);
  await page.getByRole('button', { name: '다시 제출' }).tap();
  await expect(page.getByRole('status')).toContainText('신청이 완료되었습니다.');
  expect(requests).toBe(2);
  await expect(page.locator('form')).toHaveCount(0);
  await expect(page.locator('main')).not.toContainText('접수 번호');
  await expect(page.getByRole('link',{name:'메인 화면',exact:true})).toHaveAttribute('href','/');
  await page.getByRole('link', { name: '보고회 둘러보기' }).tap(); await expect(page).toHaveURL(/\/guide$/);
});

test('optional choices collapse, retain selections and explain the two-choice limit', async ({ page }) => {
  await page.goto('/register');
  const disclosure = page.locator('.preference-disclosure');
  const summary = disclosure.locator('summary');
  await expect(disclosure).not.toHaveAttribute('open', '');
  await expect(page.getByRole('button', { name: '신청 제출' })).toBeVisible();
  await summary.tap();
  const checks = page.locator('.lesson-choice input');
  await page.locator('.lesson-choice').nth(1).tap();
  await page.locator('.lesson-choice').nth(2).tap();
  await expect(page.locator('#preference-count')).toContainText('바꾸려면 선택한 수업을 먼저 해제하세요.');
  await expect(checks.nth(3)).toBeDisabled();
  await summary.tap();
  await expect(summary).toHaveText('수업 목록 보기 · 선택 2/2');
  await expect(page.getByText('선택한 수업: 1학년 / 2학년', { exact: true })).toBeVisible();
  await summary.tap();
  await expect(checks.nth(1)).toBeChecked();
  await checks.nth(1).tap();
  await expect(checks.nth(3)).toBeEnabled();
  await expect(page.locator('#preference-count')).toHaveText('선택 1 / 2');
  await checks.nth(3).tap();
  await expect(page.getByText('선택한 수업: 2학년 / 3학년', { exact: true })).toBeVisible();
  await page.screenshot({ path: `test-results/${test.info().project.name}-ux-choices.png`, fullPage: true });
});

test('Enter moves through fields without submitting and autocomplete stays unchanged', async ({ page }) => {
  let requests = 0;
  await page.route('**/api/registrations', route => { requests++; return route.abort(); });
  await page.goto('/register');
  const inputs = page.locator('.field input');
  for (let index = 0; index < 4; index++) {
    await expect(inputs.nth(index)).toHaveAttribute('autocomplete', index === 3 ? 'name' : 'off');
    await inputs.nth(index).fill('시험 입력');
  }
  await inputs.nth(0).focus();
  await inputs.nth(0).dispatchEvent('keydown', { key: 'Enter', code: 'Enter', isComposing: true });
  await expect(inputs.nth(0)).toBeFocused();
  for (let index = 0; index < 4; index++) {
    await inputs.nth(index).press('Enter');
    await expect(index < 3 ? inputs.nth(index + 1) : page.locator('.preference-disclosure summary')).toBeFocused();
  }
  await inputs.nth(3).press('NumpadEnter');
  await expect(page.locator('.preference-disclosure summary')).toBeFocused();
  expect(requests).toBe(0);
  await expect(page.locator('.field-error:visible')).toHaveCount(0);
});

test('inline validation focuses the first error and maps server errors back to fields', async ({ page }) => {
  let requests = 0;
  await page.route('**/api/registrations', route => {
    requests++;
    return route.fulfill({ status: 400, json: { ok: false, code: 'INVALID_INPUT', retryable: false, message: '입력 내용을 확인해 주세요.', fieldErrors: { school: '소속교를 확인해 주세요.' } } });
  });
  await page.goto('/register');
  const city = page.getByLabel('지역(시)', { exact: true });
  await city.fill('   ');
  await page.getByRole('button', { name: '신청 제출' }).tap();
  await expect(city).toBeFocused();
  await expect(city).toHaveAttribute('aria-invalid', 'true');
  await expect(page.locator('.field-error:visible')).toHaveCount(5);
  expect(requests).toBe(0);
  await city.fill('안성시');
  await expect(city).not.toHaveAttribute('aria-invalid');
  await page.getByRole('button', { name: '신청 제출' }).tap();
  await expect(page.getByLabel('소속교', { exact: true })).toBeFocused();
  for (const [name, value] of [['소속교', '시험학교'], ['직위', '5학년'], ['성함', '시험 이름']]) await page.getByLabel(name, { exact: true }).fill(value);
  await page.getByLabel('개인정보 수집·이용에 동의합니다. (필수)', { exact: true }).check();
  await page.getByRole('button', { name: '신청 제출' }).tap();
  await expect(page.getByLabel('소속교', { exact: true })).toBeFocused();
  await expect(page.locator('#registration-school-error')).toHaveText('소속교를 확인해 주세요.');
  await expect(page.getByLabel('성함', { exact: true })).toHaveValue('시험 이름');
  expect(requests).toBe(1);
  await page.screenshot({ path: `test-results/${test.info().project.name}-ux-errors.png`, fullPage: true });
});

test('no lesson preference submits through the real server handler with a test storage adapter', async ({ page }) => {
  const saved: RegistrationRecord[] = [];
  const api = createRegistrationApi({ isConfigured: () => true, append: async record => { saved.push(record); } });
  await page.route('**/api/registrations', async route => {
    const body = route.request().postDataJSON();
    expect(body.lessonIds).toEqual([]);
    const result = await api({ method: 'POST', path: '/api/registrations', contentType: 'application/json', body, bodyBytes: 300 });
    await route.fulfill({ status: result.status, json: result.body });
  });
  await page.goto('/register');
  await expect(page.getByRole('heading', { level: 1 })).toHaveText('참관 신청');
  await expect(page.locator('main')).not.toContainText('함께할 수업을');
  await expect(page.getByLabel('소속교', { exact: true })).toHaveAttribute('placeholder', '예: 안성초등학교');
  await expect(page.locator('.preference-help')).toHaveText('수요조사를 위한 문항이며, 공개보고회에서는 전체 수업을 자유롭게 참관 가능합니다.');
  await expect(page.locator('.lesson-choice small')).toHaveCount(0);
  for (const [name, value] of [['지역(시)', '시험시'], ['소속교', '시험학교'], ['직위', '영어전담'], ['성함', '선택없음 시험']]) await page.getByLabel(name, { exact: true }).fill(value);
  await page.getByLabel('개인정보 수집·이용에 동의합니다. (필수)', { exact: true }).check();
  await page.getByRole('button', { name: '신청 제출' }).tap();
  await expect(page.getByRole('status')).toContainText('신청이 완료되었습니다.');
  expect(saved).toHaveLength(1);
  expect(registrationRow(saved[0]).slice(7)).toEqual(['', '', '동의', '']);
  await page.getByRole('link', { name: '보고회 둘러보기' }).tap();
  await page.getByRole('link', { name: '신관', exact: true }).tap();
  await page.locator('svg a[data-space-id="classroom-3-2"]').tap();
  await expect(page.locator('.pdf-page canvas').first()).toHaveAttribute('aria-label', '수업 지도안 1페이지');
});

test('lens buttons reveal the supplied descriptions on touch and dismiss with Escape', async ({ page }) => {
  await page.goto('/lessons/lesson-3-2');
  await expect(page.getByRole('button',{name:'표현',exact:true})).toHaveCSS('color','rgb(255, 255, 255)');
  const discovery = page.getByRole('button', { name: '발견', exact: true });
  const expression = page.getByRole('button', { name: '표현', exact: true });
  const panel = page.getByRole('region', { name: '렌즈 설명' });
  await expect(discovery).toHaveAttribute('aria-expanded', 'false');
  await discovery.tap();
  await expect(panel).toContainText('학생을 새롭게 보기');
  await expect(panel).toContainText('무엇을 알고 있고, 어디서 막히는가?');
  await expression.tap();
  await expect(discovery).toHaveAttribute('aria-expanded', 'false');
  await expect(panel).toContainText('생각을 여러 방식으로 드러내기');
  await expect(panel).toContainText('말·글·그림·몸짓·모국어로 표현할 수 있는가?');
  await expression.tap(); await expect(panel).toBeHidden();
  await discovery.focus(); await page.keyboard.press('Enter');
  await expect(panel).toBeVisible();
  await page.keyboard.press('Escape'); await expect(panel).toBeHidden();
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
});

test.describe('desktop lens interaction', () => {
  test.use({ isMobile: false, hasTouch: false, viewport: { width: 1280, height: 800 } });
  test('mouse hover shows each lens and leaving closes the explanation', async ({ page }) => {
    await page.goto('/lessons/lesson-3-2');
    const panel = page.getByRole('region', { name: '렌즈 설명' });
    await page.getByRole('button', { name: '발견', exact: true }).hover();
    await expect(panel).toContainText('학생을 새롭게 보기');
    await page.getByRole('button', { name: '표현', exact: true }).hover();
    await expect(panel).toContainText('생각을 여러 방식으로 드러내기');
    await page.getByRole('heading', { name: '수업 이야기' }).hover();
    await expect(panel).toBeHidden();
  });
});

test('PDFs render continuous pages, scroll and zoom when modern Promise APIs are absent', async ({ page, browserName }) => {
  test.setTimeout(120000);
  await page.addInitScript(()=>{
    (Promise as unknown as {withResolvers:unknown}).withResolvers=undefined;
    (Promise as unknown as {try:unknown}).try=undefined;
    const NativeWorker=window.Worker;
    window.Worker=class extends NativeWorker {
      constructor(url: string | URL, options?: WorkerOptions) {
        const target=new URL(String(url),location.href).href;
        const bootstrap=`Promise.withResolvers=undefined; Promise.try=undefined; import(${JSON.stringify(target)});`;
        super(URL.createObjectURL(new Blob([bootstrap],{type:'text/javascript'})),options);
      }
    };
  });
  for(const id of ['lesson-3-2','lesson-4-1','lesson-5-2']) {
    await page.goto(`/lessons/${id}`);
    const canvas=page.locator('.pdf-page canvas').first();
    await expect(page.getByRole('button',{name:'다음 페이지',exact:true})).toBeEnabled({timeout:30000});
    await canvas.scrollIntoViewIfNeeded();
    await expect(canvas).toHaveAttribute('data-rendered','true');
    await expect.poll(()=>canvas.evaluate(node=>{
      const c=node as HTMLCanvasElement;
      const data=c.getContext('2d')!.getImageData(0,0,c.width,c.height).data;
      for(let i=0;i<data.length;i+=16) if(data[i+3] && data[i]+data[i+1]+data[i+2]<600) return true;
      return false;
    })).toBe(true);
    const pages=page.locator('.pdf-page');
    expect(await pages.count()).toBeGreaterThan(1);
    expect(await page.locator('.pdf-viewer').evaluate(node=>node.scrollHeight <= node.clientHeight + 1)).toBe(true);
    const top=await page.evaluate(()=>scrollY);
    if (browserName === 'chromium') {
      const session=await page.context().newCDPSession(page);
      await session.send('Input.dispatchTouchEvent',{type:'touchStart',touchPoints:[{x:200,y:600}]});
      for (const y of [500,400,300,200]) await session.send('Input.dispatchTouchEvent',{type:'touchMove',touchPoints:[{x:200,y}]});
      await session.send('Input.dispatchTouchEvent',{type:'touchEnd',touchPoints:[]});
      await session.detach();
    } else {
      // Mobile WebKit has no automation wheel/swipe API; verify document scrolling directly.
      await page.evaluate(()=>window.scrollBy(0,400));
    }
    await expect.poll(()=>page.evaluate(()=>scrollY)).toBeGreaterThan(top);
    const last=pages.last().locator('canvas');
    await last.scrollIntoViewIfNeeded();
    await expect(last).toHaveAttribute('data-rendered','true');
    await expect.poll(()=>last.evaluate(node=>{
      const c=node as HTMLCanvasElement, data=c.getContext('2d')!.getImageData(0,0,c.width,c.height).data;
      for(let i=0;i<data.length;i+=16) if(data[i+3] && data[i]+data[i+1]+data[i+2]<600) return true;
      return false;
    })).toBe(true);
    const original=page.getByRole('link',{name:'PDF 새 탭에서 열기',exact:true});
    await expect(original).toBeVisible(); await expect(original).toHaveAttribute('target','_blank');
    await expect(original).toHaveAttribute('rel','noopener');
    await expect(original).toHaveAttribute('href',`/pdfs/grade-${id.split('-')[1]}.pdf`);
    await expect(page.getByRole('button',{name:'확대',exact:true})).toBeEnabled();
    const width=await canvas.evaluate(node=>node.style.width);
    await page.getByRole('button',{name:'확대',exact:true}).click();
    await expect.poll(()=>canvas.evaluate(node=>node.style.width)).not.toBe(width);
    expect(await pages.first().evaluate(node=>node.scrollWidth > node.clientWidth)).toBe(true);
    await pages.first().evaluate(node=>{node.scrollLeft=40;});
    expect(await pages.first().evaluate(node=>node.scrollLeft)).toBeGreaterThan(0);
    await expect(page.locator('.pdf-viewer-slot .error')).toHaveCount(0);
  }
});

test('continuous PDF controls keep page tops clear on narrow screens and cancel work on navigation', async ({ page }) => {
  const errors: string[] = []; page.on('pageerror', error => errors.push(error.message));
  for (const width of [320, 390, 430]) {
    await page.setViewportSize({width,height:740});
    await page.goto('/lessons/lesson-3-2');
    const toolbar=page.locator('.pdf-toolbar'), second=page.locator('.pdf-page').nth(1);
    await page.getByRole('button',{name:'다음 페이지',exact:true}).click();
    await expect(second.locator('canvas')).toHaveAttribute('data-rendered','true');
    await expect.poll(async()=>{
      const bar=(await toolbar.boundingBox())!, bounds=(await second.boundingBox())!;
      return bounds.y >= bar.y + bar.height + 14;
    }).toBe(true);
    expect(await page.evaluate(()=>document.documentElement.scrollWidth <= innerWidth)).toBe(true);
    for (let count=0;count<3;count++) await page.getByRole('button',{name:'확대',exact:true}).click();
    await expect(toolbar).toContainText('175%');
    await expect(second.locator('canvas')).toHaveAttribute('data-rendered','true');
    await expect(page.locator('.pdf-viewer .error')).toHaveCount(0);
    await page.getByRole('link',{name:'안성초 공개보고회',exact:true}).click();
    await expect(page).toHaveURL(/\/$/);
    expect(errors).toEqual([]);
  }
});

test('provided PDF failure has retry and original link', async ({ page }) => {
  let attempts = 0;
  await page.route('**/pdfs/grade-3.pdf', async route => { attempts++; await route.fulfill({ status: 503, body: 'unavailable' }); });
  await page.goto('/lessons/lesson-3-2');
  await expect(page.getByText('지도안을 불러오지 못했습니다.', { exact: false })).toBeVisible();
  await expect(page.getByRole('link', { name: 'PDF 새 탭에서 열기' })).toHaveAttribute('href', '/pdfs/grade-3.pdf');
  await expect(page.getByRole('link', { name: 'PDF 새 탭에서 열기' })).toHaveAttribute('target', '_blank');
  expect(attempts).toBe(1);
  await page.unroute('**/pdfs/grade-3.pdf');
  await page.getByRole('button', { name: '다시 시도' }).tap();
  await expect(page.locator('.pdf-page canvas').first()).toHaveAttribute('aria-label', '수업 지도안 1페이지');
});

test('missing materials use shared text and viewer-sized gray placeholder without PDF requests', async ({ page }) => {
  const catalog = JSON.parse(readFileSync('src/data/catalog.generated.json', 'utf8'));
  const lesson = catalog.lessons.find((item: { id: string }) => item.id === 'lesson-3-2');
  lesson.lessonPlanId = null; lesson.context = null;
  await page.route('**/src/data/catalog.generated.json*', route => route.fulfill({ contentType: 'application/javascript', body: `export default ${JSON.stringify(catalog)}` }));
  const requests: string[] = []; page.on('request', request => requests.push(request.url()));
  await page.goto('/lessons/lesson-3-2');
  await expect(page.locator('.text-placeholder')).toHaveText('자료 업로드 예정입니다.');
  await expect(page.locator('.pdf-placeholder')).toHaveText('자료 업로드 예정');
  expect(await page.locator('.pdf-placeholder').evaluate(node => node.clientHeight)).toBeGreaterThanOrEqual(350);
  expect(await page.locator('.pdf-placeholder').evaluate(node => getComputedStyle(node).backgroundColor)).toBe('rgb(233, 236, 240)');
  expect(requests.some(url => /pdf-viewer|pdfjs|\.pdf(?:\?|$)/.test(url))).toBe(false);
  await expect(page.getByRole('link', { name: /PDF 새 탭에서 열기/ })).toHaveCount(0);
});

test('local API proxy reaches the deployed server validation without saving a row', async ({ request }) => {
  test.skip(process.env.VERIFY_LIVE_API !== 'true', 'Explicit opt-in for external server validation');
  const response = await request.post('/api/registrations', { data: {} });
  expect(response.status()).toBe(400);
  expect(await response.json()).toMatchObject({ ok: false, code: 'INVALID_INPUT' });
});

test('small mobile viewport keeps readable text and touch targets', async ({ page }) => {
  await page.setViewportSize({ width: 320, height: 740 });
  await page.goto('/');
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
  expect(await page.evaluate(() => document.documentElement.scrollHeight > innerHeight)).toBe(true);
  await expect(page.getByRole('link',{name:'신청하기',exact:true})).toBeVisible();
  await expect(page.locator('.brand img')).toHaveJSProperty('naturalWidth',64);
  for (const button of await page.locator('.actions .button').all()) {
    expect((await button.boundingBox())!.height).toBeGreaterThanOrEqual(44);
  }
  expect((await page.locator('.brand').boundingBox())!.height).toBeGreaterThanOrEqual(44);
  await page.goto('/register');
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
  expect(await page.getByLabel('성함', { exact: true }).evaluate(node => parseFloat(getComputedStyle(node).fontSize))).toBeGreaterThanOrEqual(16);
  await page.screenshot({ path: `test-results/${test.info().project.name}-register-320.png` });
});

