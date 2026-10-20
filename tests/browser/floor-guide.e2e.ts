import { test, expect } from '@playwright/test';
import { readFileSync } from 'node:fs';
import type { Catalog } from '../../src/data/catalog';
const catalog: Catalog = JSON.parse(readFileSync('src/data/catalog.generated.json','utf8'));
const publicIds = new Set(catalog.classes.filter(item=>item.isPublic).map(item=>item.id));
function getPublicLessons() { return catalog.lessons.filter(item=>publicIds.has(item.classId)); }
function floorHref(building: string, floor: number, space?: string) { return `/guide/${building}/${floor}${space?`?space=${space}`:''}`; }

test('main first floor marks the confirmed lower central entrance for registration', async ({ page }) => {
  await page.goto('/guide/main');
  const floor = page.locator('#floor-1');
  await expect(floor).toBeVisible();
  await expect(floor.locator('.registration-location')).toHaveText('등록 장소: 본관 1층 중앙현관');
  const marker = floor.locator('.plan-registration');
  await expect(marker).toHaveCount(1);
  await expect(marker).toHaveAttribute('data-source-x', '765');
  await expect(marker).toHaveAttribute('data-source-y', '166');
  await expect(marker).toContainText('등록');
  await expect(floor.locator('.facility-stairs')).toHaveCount(3);
  await expect(floor.locator('.facility-elevator .room-name')).toHaveText('E/V');
  await expect(floor.locator('.room-name')).toHaveText(['활동실', '놀이마루', '등록현관', '보건실', '행정실', 'E/V', '1컴퓨터실', '유치원']);
  await expect(floor.locator('.facility-toilet')).toHaveCount(0);
  await expect(floor).not.toContainText('서고');
  await expect(floor.locator('svg a[data-space-id="kindergarten-public"]')).toHaveCount(1);
  await expect(floor.locator('svg a:not([data-space-id="kindergarten-public"])')).toHaveCount(0);
  await expect(floor.locator('.floor-topic p')).toHaveText('자료 업로드 예정입니다.');
  for (const width of [320, 390, 430]) {
    await page.setViewportSize({ width, height: 740 });
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
    const region = floor.locator('.floor-plan');
    await expect.poll(() => region.evaluate(node => Number(node.querySelector('svg')!.getAttribute('width')) === Math.floor(node.clientWidth))).toBe(true);
    expect(await region.evaluate(node => node.scrollWidth <= node.clientWidth)).toBe(true);
    const placement = await floor.evaluate(node => {
      const registration = node.querySelector('.plan-registration rect') as SVGRectElement;
      const stairs = [...node.querySelectorAll<SVGRectElement>('.facility-stairs rect')];
      const facing = stairs.find(rect => Number(rect.getAttribute('y')) < 80)!;
      return { registrationWidth: registration.getBBox().width, registrationCenter: registration.getBBox().x + registration.getBBox().width / 2,
        facingCenter: facing.getBBox().x + facing.getBBox().width / 2,
        lowerCount: stairs.filter(rect => Number(rect.getAttribute('y')) === 104).length,
        textFits: [...node.querySelectorAll<SVGGElement>('.plan-room')].every(room => {
          const bounds = room.querySelector('rect')!.getBBox();
          return [...room.querySelectorAll('text')].every(text => { const box = text.getBBox(); return box.x >= bounds.x && box.y >= bounds.y && box.x + box.width <= bounds.x + bounds.width && box.y + box.height <= bounds.y + bounds.height; });
        }) };
    });
    expect(placement.registrationWidth).toBeGreaterThan(40);
    expect(placement.registrationCenter).toBeCloseTo(placement.facingCenter, 5);
    expect(placement.lowerCount).toBe(2);
    expect(placement.textFits).toBe(true);
    expect(await marker.evaluate(node => {
      const rect = node.querySelector('rect')!.getBBox();
      return [...node.querySelectorAll('text')].every(text => {
        const box = text.getBBox();
        return box.x >= rect.x && box.y >= rect.y && box.x + box.width <= rect.x + rect.width && box.y + box.height <= rect.y + rect.height;
      });
    })).toBe(true);
  }
  await page.goto('/guide/main/1');
  await page.reload();
  await expect(marker).toBeVisible();
  await page.screenshot({ path: `test-results/${test.info().project.name}-registration-floor.png`, fullPage: true });
  for (const building of ['rear', 'new']) {
    await page.goto(`/guide/${building}`);
    await expect(page.locator('.building-floor[data-floor="1"]')).toHaveCount(0);
  }
});

test('building and parking buttons open guides with 44px touch targets', async ({page}) => {
  await page.setViewportSize({width:320,height:740});
  await page.goto('/guide');
  for (const link of await page.locator('.school-map-link:not(.map-event-label)').all()) {
    const box=(await link.boundingBox())!;
    expect(box.width).toBeGreaterThanOrEqual(44);expect(box.height).toBeGreaterThanOrEqual(44);
  }
  for (const name of ['신관','후관','본관']) {
    await page.goto('/guide');
    await page.getByRole('link',{name,exact:true}).tap();
    await expect(page.getByRole('heading',{level:1})).toHaveText(name);
    await expect(page.locator('.building-floor > h2')).toHaveText(name === '본관' ? ['4층','3층','2층','1층'] : ['3층','2층']);
    await expect(page.getByRole('navigation',{name:'층 선택'})).toHaveCount(0);
  }
  await expect(page.locator('.building-floor[data-floor="1"]')).toHaveCount(1);
  await page.goto('/guide');
  await page.getByRole('link',{name:'운동장 주차장'}).tap();
  await expect(page.getByRole('heading',{level:1})).toHaveText('주차 안내');
  await expect(page.locator('main')).not.toContainText('가안');
  await expect(page.locator('main')).toContainText('본관 1층 중앙현관');
});

test('all 29 public lessons open from their actual SVG rooms and return to the selected floor', async ({page}) => {
  test.setTimeout(120000);
  const pdfRequests: string[] = [];
  page.on('request',request=>{if (/\/pdfs\/.*\.pdf/.test(request.url())) pdfRequests.push(request.url());});
  for (const lesson of getPublicLessons()) {
    const space=catalog.spaces.find(item=>item.id===lesson.spaceIds[0])!;
    await page.goto(floorHref(space.buildingId,space.floor));
    const before = pdfRequests.length;
    await page.locator(`svg a[data-space-id="${space.id}"]`).tap();
    await expect(page.locator('.space-panel')).toHaveCount(0);
    await expect(page).toHaveURL(new RegExp(`/lessons/${lesson.id}\\?from=`));
    await expect(page.locator('h1')).toHaveText(lesson.topic??'자료 업로드 예정입니다.');
    if (!lesson.lessonPlanId) {
      await expect(page.locator('.pdf-placeholder')).toHaveText('자료 업로드 예정');
      await expect(page.getByRole('link',{name:'원본 PDF 새 탭에서 열기'})).toHaveCount(0);
      expect(pdfRequests.length).toBe(before);
    } else {
      await expect(page.locator('canvas')).toHaveAttribute('aria-label','수업 지도안 1페이지');
      const plan = catalog.lessonPlans.find(item=>item.id===lesson.lessonPlanId)!;
      expect(pdfRequests.slice(before).some(url=>new URL(url).pathname===plan.url)).toBe(true);
    }
    await page.locator('main > .text-link').tap();
    await expect(page).toHaveURL(new RegExp(`/guide/${space.buildingId}/${space.floor}\\?space=${space.id}$`));
    await expect(page.locator('.space-panel')).toHaveCount(0);
    await expect(page.locator(`.plan-selected[data-space-id="${space.id}"]`)).toBeVisible();
  }
});

test('relocated classrooms lead to the real rooms; closed and general spaces do not show missing material placeholders', async ({page}) => {
  for (const [origin,actual] of [['classroom-3-1','science-1'],['classroom-4-5','science-2'],['classroom-6-1','english']]) {
    const space=catalog.spaces.find(item=>item.id===origin)!;
    const lesson=getPublicLessons().find(item=>item.spaceIds.includes(actual))!;
    const actualSpace=catalog.spaces.find(item=>item.id===actual)!;
    await page.goto(floorHref(space.buildingId,space.floor));
    await page.locator(`svg a[data-space-id="${origin}"]`).tap();
    await expect(page).toHaveURL(new RegExp(`/lessons/${lesson.id}\\?from=${origin}$`));
    await expect(page.locator('.space-panel')).toHaveCount(0);
    await expect(page.locator('main > .map-notice')).toContainText(actualSpace.name);
    await expect(page.locator('main > .map-notice')).toHaveText(`${space.name}에서는 진행하지 않습니다.실제 수업 장소는 ${actualSpace.buildingId==='main'?'본관':actualSpace.buildingId==='new'?'신관':'후관'} ${actualSpace.floor}층 ${actualSpace.name}입니다.`);
    await expect(page.locator('.map-notice strong')).toContainText(actualSpace.name);
    await expect(page.locator('.map-notice')).not.toContainText('📍');
    await expect(page.locator('.map-notice br')).toHaveCount(1);
    await page.locator('main > .text-link').tap();
    await expect(page).toHaveURL(new RegExp(`\\?space=${origin}$`));
    await expect(page.locator('.space-panel')).toHaveCount(0);
    await expect(page.locator(`.plan-selected[data-space-id="${origin}"]`)).toBeVisible();
  }
  for (const id of ['classroom-5-1','korean-instructor-1','korean-instructor-2']) {
    const space=catalog.spaces.find(item=>item.id===id)!;
    await page.goto(floorHref(space.buildingId,space.floor,id));
    await expect(page.locator('.space-panel')).toContainText(id==='classroom-5-1'?'비공개':'강사용');
    await expect(page.locator('.space-panel .text-placeholder, .space-panel .pdf-placeholder')).toHaveCount(0);
    await expect(page.locator('.space-panel a[href^="/lessons/"]')).toHaveCount(0);
  }
  await page.goto('/guide/new/1');
  await expect(page.locator('.building-floor[data-floor="1"]')).toHaveCount(0);
});

test('building overview preserves straight classroom rows with complete common topics below the drawing', async ({page}) => {
  for (const width of [320,390,430]) for (const building of ['main','rear','new']) {
    await page.setViewportSize({width,height:740});
    await page.goto(`/guide/${building}`);
    await expect(page.locator('.floor-topic p').first()).toBeVisible();
    expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth)).toBe(true);
    const tabs=await page.locator('.building-tabs .button').evaluateAll(nodes=>nodes.map(node=>{const r=node.getBoundingClientRect();return {width:r.width,height:r.height,y:r.y};}));
    expect(tabs).toHaveLength(3);
    expect(Math.max(...tabs.map(item=>item.width))-Math.min(...tabs.map(item=>item.width))).toBeLessThan(1);
    expect(new Set(tabs.map(item=>item.y)).size).toBe(1);
    expect(new Set(tabs.map(item=>item.height)).size).toBe(1);
    const teachingFloors = page.locator('.building-floor:not([data-floor="1"])');
    await expect(teachingFloors.locator('.facility-toilet, .facility-entrance, .facility-outdoor')).toHaveCount(0);
    await expect(teachingFloors.locator('g.facility-room')).toHaveCount(building==='main'?5:0);
    if(building==='main') {
      const offices=page.locator('#floor-2 g.facility-room text');
      await expect(offices).toHaveText(['자치실','교무실']);
      const widths=await page.locator('[data-space-id^="korean-"] rect').evaluateAll(nodes=>nodes.map(node=>Number(node.getAttribute('width'))));
      expect(Math.max(...widths)-Math.min(...widths)).toBeLessThan(.01);
      const ev=await page.locator('#floor-2 .facility-elevator rect').evaluate(node=>({x:Number(node.getAttribute('x')),w:Number(node.getAttribute('width')),y:Number(node.getAttribute('y')),h:Number(node.getAttribute('height'))}));
      const leftStair=await page.locator('#floor-2 .facility-stairs[data-source-x="222"] rect').evaluate(node=>({x:Number(node.getAttribute('x')),w:Number(node.getAttribute('width')),y:Number(node.getAttribute('y'))}));
      expect(ev.x+ev.w/2).toBeCloseTo(leftStair.x+leftStair.w/2,5);
      expect(ev.y+ev.h).toBeLessThan(leftStair.y);
      const koreanStrip = await page.locator('#floor-2').evaluate(floor => {
        const elevator = floor.querySelector<SVGRectElement>('.facility-elevator rect')!.getBBox();
        const stair = floor.querySelector<SVGRectElement>('.facility-stairs[data-source-y="30"] rect')!.getBBox();
        const rooms = [...floor.querySelectorAll<SVGAElement>('[data-space-id^="korean-"]')].map(node => {
          const rect = node.querySelector('rect')!.getBBox();
          return { id: node.getAttribute('data-space-id')!, href: node.getAttribute('href'), x: rect.x, width: rect.width, text: node.querySelector('text')?.textContent,
            textFits: [...node.querySelectorAll('text')].every(text => { const bounds = text.getBBox(); return bounds.x >= rect.x && bounds.y >= rect.y && bounds.x + bounds.width <= rect.x + rect.width && bounds.y + bounds.height <= rect.y + rect.height; }) };
        });
        return { start: elevator.x + elevator.width, end: stair.x, rooms };
      });
      expect(koreanStrip.rooms).toHaveLength(4);
      expect(Math.abs(koreanStrip.rooms[0].x - koreanStrip.start)).toBeLessThan(.01);
      expect(Math.abs(koreanStrip.rooms[3].x + koreanStrip.rooms[3].width - koreanStrip.end)).toBeLessThan(.01);
      for (const [index, room] of koreanStrip.rooms.entries()) {
        if (index) expect(Math.abs(room.x - koreanStrip.rooms[index - 1].x - koreanStrip.rooms[index - 1].width)).toBeLessThan(.01);
        expect(room.textFits).toBe(true);
        const lesson = getPublicLessons().find(item => item.spaceIds.includes(room.id));
        expect(room.href).toBe(lesson ? `/lessons/${lesson.id}?from=${encodeURIComponent(room.id)}` : floorHref('main', 2, room.id));
        if (room.id === 'korean-red' || room.id === 'korean-green') expect(room.text).toBe(room.id === 'korean-red' ? '빨강반' : '초록반');
      }
    }
    await expect(page.locator('.floor-legend li')).toHaveText(['공개수업 진행','다른 장소에서 공개수업 진행','공개수업 미진행','계단','E/V승강기']);
    await expect(page.locator('.floor-legend svg')).toHaveCount(5);
    await expect(page.locator('.legend-symbol.plan-stairs line')).toHaveCount(5);
    await expect(page.locator('.floor-facilities')).toHaveCount(0);
    await expect(page.locator('[data-space-id^="korean-instructor-"] text')).toHaveCount(0);
    for(const elevator of await teachingFloors.locator('.facility-elevator').all()) await expect(elevator.locator('text')).toHaveText('E/V');
    if(building==='main') await expect(page.locator('.building-floor[data-floor="1"]')).toHaveCount(1);
    if(building==='rear') {
      const floor=page.locator('.building-floor[data-floor="2"]');
      const passage=floor.locator('.plan-passage');
      await expect(passage).toHaveText('본관통로');
      const stair=floor.locator('.facility-stairs[data-source-y="70"] rect');
      const elevator=floor.locator('.facility-elevator rect');
      const stairsBounds=await stair.evaluate(node=>({x:Number(node.getAttribute('x')),width:Number(node.getAttribute('width')),y:Number(node.getAttribute('y'))}));
      const elevatorBounds=await elevator.evaluate(node=>({x:Number(node.getAttribute('x')),y:Number(node.getAttribute('y'))}));
      expect(stairsBounds.x+stairsBounds.width).toBeLessThan(elevatorBounds.x);
      expect(stairsBounds.y).toBe(elevatorBounds.y);
      await passage.scrollIntoViewIfNeeded();
      await expect.poll(()=>passage.evaluate(node=>{
        const bounds=(node as SVGGraphicsElement).getBBox();
        const left=node.parentNode!.querySelector<SVGRectElement>('[data-space-id="classroom-1-2"] rect')!.getBBox();
        const right=node.parentNode!.querySelector<SVGRectElement>('[data-space-id="classroom-1-3"] rect')!.getBBox();
        return bounds.width>0 && bounds.x>=left.x+left.width && bounds.x+bounds.width<=right.x;
      })).toBe(true);
    }
    for (const region of await teachingFloors.locator('.floor-plan').all()) {
      if(building==='new' && await region.locator('..').getAttribute('data-floor')==='2') {
        const top=await region.locator('.facility-stairs[data-source-y="0"] rect').evaluate(node=>Number(node.getAttribute('y'))+Number(node.getAttribute('height')));
        expect(top).toBe(await region.locator('.plan-corridor').evaluate(node=>Number(node.getAttribute('y'))));
        const stairs=region.locator('.facility-stairs[data-source-x="1131"] line');
        expect(await stairs.evaluateAll(nodes=>nodes.every(node=>node.getAttribute('x1')===node.getAttribute('x2') && node.getAttribute('y1')!==node.getAttribute('y2')))).toBe(true);
      }
      if(building==='new') {
        const targets=await region.locator('..').getAttribute('data-floor')==='2'?['1131','1299']:['1131'];
        for(const x of targets) {
          const lines=region.locator(`.facility-stairs[data-source-x="${x}"] line`);
          await expect(lines).toHaveCount(5);
          expect(await lines.evaluateAll(nodes=>nodes.every(node=>node.getAttribute('x1')===node.getAttribute('x2') && node.getAttribute('y1')!==node.getAttribute('y2')))).toBe(true);
        }
      }
      if(!(building==='main' && await region.locator('..').getAttribute('data-floor')==='2')) {
        const widths=await region.locator('a.plan-room rect').evaluateAll(nodes=>nodes.map(node=>Number(node.getAttribute('width'))));
        expect(Math.max(...widths)-Math.min(...widths)).toBeLessThan(.01);
      }
      await expect(region.locator('.facility-stairs text')).toHaveCount(0);
      for(const stair of await region.locator('.facility-stairs').all()) await expect(stair.locator('line')).toHaveCount(5);
      const elevatorHeight=await region.locator('.facility-elevator rect').evaluate(node=>Number(node.getAttribute('height')));
      for(const stair of await region.locator('.facility-stairs rect').all()) expect(await stair.evaluate(node=>Number(node.getAttribute('height')))).toBeCloseTo(elevatorHeight,5);
      expect(await region.evaluate(node=>node.scrollWidth<=node.clientWidth)).toBe(true);
      const cells=await region.locator('.plan-room[data-source-y="166"] rect').evaluateAll(nodes=>nodes.map(node=>({x:Number(node.getAttribute('x')),y:Number(node.getAttribute('y'))})));
      expect(new Set(cells.map(cell=>cell.y)).size).toBeLessThanOrEqual(1);
      const svg=(await region.locator('svg').boundingBox())!;
      const strip=region.locator('..').locator('.floor-topics');
      expect((await strip.boundingBox())!.y).toBeGreaterThanOrEqual(svg.y+svg.height-1);
    }
    await expect(page.locator('svg .room-topic')).toHaveCount(0);
    await expect(page.locator('.floor-relocation')).toHaveCount(0);
    for(const room of await page.locator('a.plan-relocated').all()) await expect(room.locator('.room-name')).toContainText('📍');
    for (const room of await page.locator('a.plan-public').all()) {
      const id=await room.getAttribute('data-space-id');
      const lesson=getPublicLessons().find(item=>item.spaceIds.includes(id!))!;
      const topic=page.locator(`.floor-topic[data-lesson-ids~="${lesson.id}"] p`);
      await expect(topic).toHaveCount(1);
      await expect(topic).toHaveText(lesson.topic??'자료 업로드 예정입니다.');
      expect(await topic.evaluate(node=>parseFloat(getComputedStyle(node).fontSize))).toBeGreaterThanOrEqual(16);
      const rect=(await room.locator('rect').boundingBox())!;
      expect(rect.width).toBeGreaterThan(0);expect(rect.height).toBeGreaterThanOrEqual(44);
      await expect(room.locator('.room-name')).toBeVisible();
      expect(await room.evaluate(node=>{
        const r=node.querySelector('rect')!.getBBox();
        return [...node.querySelectorAll('text')].every(text=>{const b=text.getBBox();return b.x>=r.x&&b.y>=r.y&&b.x+b.width<=r.x+r.width&&b.y+b.height<=r.y+r.height;});
      })).toBe(true);
    }
    const picker=page.locator('.floor-room-picker').first();
    await picker.locator('summary').click();
    for(const choice of await picker.locator('.button').all()){
      const bounds=(await choice.boundingBox())!;
      expect(bounds.width).toBeGreaterThanOrEqual(44);expect(bounds.height).toBeGreaterThanOrEqual(44);
    }
  }
  await page.goto('/guide/main');await page.reload();
  await expect(page.locator('.building-floor')).toHaveCount(4);
  await page.screenshot({path:`test-results/${test.info().project.name}-building-overview.png`,fullPage:true});
  await page.goto('/register');
  await expect(page.locator('.lesson-choice')).toHaveCount(14);
  await expect(page.locator('.lesson-choice strong').last()).toHaveText('유치원');
  await page.goto('/lessons/lesson-kindergarten-joint');
  await expect(page.getByRole('heading',{level:1})).toHaveText('자료 업로드 예정입니다.');
  await expect(page.locator('.pdf-placeholder')).toHaveText('자료 업로드 예정');
});
