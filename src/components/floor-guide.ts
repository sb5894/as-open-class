import { catalog, getLessonsAtSpace, getRelocatedLessonsFromSpace } from '../data/catalog';
import { buildingHref, classroomHref, floorHref, getBuildingFloorPlans, getFloorPlan, getFloorTopics, roomStatus, type FloorPlan } from '../data/floor-plans';
import { createMaterialText, MISSING_TEXT } from './placeholders';
import { el, link } from './ui';

const ns = 'http://www.w3.org/2000/svg';
function svgEl<K extends keyof SVGElementTagNameMap>(tag: K, attributes: Record<string, string | number>) {
  const node = document.createElementNS(ns, tag);
  for (const [key, value] of Object.entries(attributes)) node.setAttribute(key, String(value));
  return node;
}
/** Simplified ground-floor guide confirmed by the user; source records stay intact. */
function mountRegistrationPlan(region: HTMLElement, plan: FloorPlan, selected?: string) {
  let lastWidth = 0;
  function draw() {
    const width = Math.floor(region.clientWidth);
    if (width < 100 || width === lastWidth) return;
    lastWidth = width;
    const x = (value: number) => 4 + value / 128 * (width - 8);
    const svg = svgEl('svg', { width, height: 174, viewBox: `0 0 ${width} 174`, role: 'group', 'aria-label': '본관 1층 안내도. 등록 장소는 놀이마루와 보건실 사이의 아래쪽 중앙현관입니다.' });
    svg.append(svgEl('rect', { x: 4, y: 80, width: width - 8, height: 24, class: 'plan-corridor' }));
    const corridor = svgEl('text', { x: width / 2, y: 96, 'text-anchor': 'middle', 'font-size': 12 }); corridor.textContent = '복도'; svg.append(corridor);
    const measure = document.createElement('canvas').getContext('2d')!;
    function box(label: string, kind: string, rx: number, ry: number, rw: number, rh: number, registration = false, spaceId?: string) {
      const node = spaceId ? svgEl('a', { href: classroomHref(spaceId), 'data-space-id': spaceId, 'aria-label': `${label} · 공개수업`, tabindex: 0 }) : svgEl('g', {});
      node.setAttribute('class', `plan-room facility-${kind}${registration ? ' plan-registration' : ''}${spaceId ? ' plan-public' : ''}${spaceId && selected === spaceId ? ' plan-selected' : ''}`);
      if (registration) {
        const source = plan.rooms.find(room => room.kind === 'entrance' && room.x === 765 && room.y === 166)!;
        node.setAttribute('data-source-x', String(source.x)); node.setAttribute('data-source-y', String(source.y));
      }
      const title = svgEl('title', {}); title.textContent = registration ? '중앙현관 · 등록 장소' : label.replace(/\n/g, ' '); node.append(title);
      node.append(svgEl('rect', { x: rx, y: ry, width: rw, height: rh }));
      if (kind === 'stairs') {
        for (let step = 1; step <= 5; step++) node.append(svgEl('line', { x1: rx + 1, x2: rx + rw - 1, y1: ry + rh * step / 6, y2: ry + rh * step / 6, class: 'stair-tread' }));
      } else {
        const size = registration ? 13 : 11, lineHeight = size + 3;
        measure.font = `${registration ? '700 ' : ''}${size}px system-ui`;
        const lines: string[] = [];
        for (const segment of label.split('\n')) {
          let current = '';
          for (const character of segment) {
            if (current && measure.measureText(current + character).width > rw - 4) { lines.push(current); current = ''; }
            current += character;
          }
          if (current) lines.push(current);
        }
        if (lines.length && lines.length * lineHeight <= rh - 4) {
          const text = svgEl('text', { x: rx + rw / 2, y: ry + (rh - lines.length * lineHeight) / 2 + size, 'text-anchor': 'middle', 'font-size': size, class: 'room-name' });
          lines.forEach((line, index) => { const span = svgEl('tspan', { x: rx + rw / 2, dy: index ? lineHeight : 0 }); span.textContent = line; text.append(span); });
          node.append(text);
        }
      }
      svg.append(node);
    }
    // Below the corridor: left stair, six confirmed spaces, right stair.
    let cursor = 0;
    for (const [label, units, kind] of [
      ['계단', 8, 'stairs'], ['활동실', 17, 'room'], ['놀이마루', 23, 'room'],
      ['등록\n현관', 21, 'entrance'], ['보건실', 14, 'room'], ['행정실', 14, 'room'],
      ['', 9, 'room'], ['계단', 8, 'stairs'],
    ] as const) {
      box(label, kind, x(cursor), 104, x(cursor + units) - x(cursor), 66, kind === 'entrance'); cursor += units;
    }
    // E/V stays above the left side; the middle stair faces the registration entrance.
    box('E/V', 'elevator', x(8), 36, 28, 44);
    box('1컴퓨터실', 'room', x(26), 36, x(48) - x(26), 44);
    box('계단', 'stairs', (x(48) + x(69)) / 2 - 14, 36, 28, 44);
    box('유치원', 'room', x(cursor), 80, x(128) - x(cursor), 90, false, 'kindergarten-public');
    region.replaceChildren(svg);
  }
  const observer = new ResizeObserver(draw); observer.observe(region); requestAnimationFrame(draw);
  return () => observer.disconnect();
}
export function createSpacePanel(spaceId: string) {
  const space = catalog.spaces.find(item => item.id === spaceId)!;
  const panel = el('section', undefined, 'card space-panel'); panel.id = 'space-detail';
  panel.tabIndex = -1;
  panel.append(link('← 층별 안내도', floorHref(space.buildingId, space.floor), 'text-link'), el('h2', space.name));
  panel.append(el('p', spaceId === 'classroom-5-1' ? '5-1은 비공개 수업입니다.' : '강사용 교실입니다. 공개수업을 연결하지 않습니다.', 'note'));
  return panel;
}
function mountResponsivePlan(region: HTMLElement, plan: FloorPlan, selected?: string) {
  const rooms = plan.rooms.filter(room => room.spaceId || room.kind === 'stairs' || room.kind === 'elevator'
    || (plan.buildingId === 'main' && plan.floor === 2 && ['교무실','회의실'].includes(room.label))
    || (plan.buildingId === 'main' && plan.floor === 3 && room.label === '이중언어\n센터')
    || (plan.buildingId === 'main' && plan.floor === 4 && ['공간드림\n(소모임실)', '시청각실'].includes(room.label)))
    .map(room=>{
      if(plan.buildingId==='main' && plan.floor===2) {
        if(room.label==='회의실') return {...room,label:'자치실'};
        if(room.spaceId?.startsWith('korean-')) return {...room,x:room.x-120};
        if(room.kind==='elevator') return {...room,x:(100-26)*3,width:(117-100)*3};
      }
      if(plan.buildingId==='rear' && plan.floor===2 && room.kind==='stairs' && room.x===(280-26)*3) {
        return {...room,x:(338-26)*3-room.width,y:70,height:50};
      }
      return room;
    });
  const equalClassrooms = !(plan.buildingId==='main' && plan.floor===2);
  const korean = rooms.filter(room=>room.spaceId?.startsWith('korean-'));
  const passage = plan.buildingId === 'rear' && plan.floor === 2
    ? { x: (280-26)*3, width: (443-280)*3, minimum: 36 } : undefined;
  const measure = document.createElement('canvas').getContext('2d')!;
  const elevator = rooms.find(room=>room.kind==='elevator')!;
  const facilityHeight = y(elevator.y+elevator.height)-y(elevator.y);
  function y(value: number) {
    if (value <= 120) return value*.7;
    if (value <= 166) return 84+(value-120)*24/46;
    return 108+(value-166)*72/134;
  }
  function roomY(room: FloorPlan['rooms'][number]) {
    if(plan.buildingId==='new' && plan.floor===2 && room.kind==='stairs' && room.y===0) return y(120)-facilityHeight;
    return room.kind==='stairs' && room.y+room.height<=120 ? y(room.y+room.height)-facilityHeight : y(room.y);
  }
  let lastWidth = 0;
  function draw() {
    const width = Math.floor(region.clientWidth);
    if (width < 100 || width === lastWidth) return;
    lastWidth = width;
    // A shared horizontal projection keeps every source wall/room in place.
    // General spaces narrow first; classroom rows never wrap or become cards.
    const edges = [...new Set([
      (plan.corridor[0] - 26) * 3, (plan.corridor[1] - 26) * 3,
      ...rooms.flatMap(room => [room.x, room.x + room.width]),
      ...(passage ? [passage.x, passage.x + passage.width] : []),
    ])].sort((a,b)=>a-b);
    const reserved = rooms.filter(room=>!equalClassrooms || (!room.spaceId && room.y>=166))
      .map(room=>({x:room.x,width:room.width,minimum:room.spaceId?17:room.kind==='elevator'?28:room.kind==='stairs'?18:44}));
    if (passage) reserved.push(passage);
    const spans = edges.slice(0,-1).map((left,index)=>{
      const right = edges[index+1], middle = (left+right)/2;
      const classroom = rooms.find(room=>room.spaceId && room.x <= middle && middle < room.x + room.width);
      const minimum = Math.max(0,...reserved.filter(room=>room.x<=middle && middle<room.x+room.width).map(room=>(right-left)/room.width*room.minimum));
      const weight=equalClassrooms ? classroom?(right-left)/classroom.width:(right-left)/1600*.8 : (right-left)*(classroom?1:.1);
      return {left,right,weight,minimum:equalClassrooms && classroom?0:minimum};
    });
    const total = spans.reduce((sum,span)=>sum+span.weight,0);
    const remaining = Math.max(0,width-8-spans.reduce((sum,span)=>sum+span.minimum,0));
    const spanWidth = (span: typeof spans[number]) => span.minimum + remaining*span.weight/total;
    function x(value: number) {
      let cumulative = 0;
      for (const span of spans) {
        if (value <= span.right) return 4 + cumulative + Math.max(0,value-span.left)/(span.right-span.left)*spanWidth(span);
        cumulative += spanWidth(span);
      }
      return width-4;
    }
    const top=Math.max(0,Math.min(y(120),...rooms.map(roomY))-4);
    const svg = svgEl('svg', { width, height: 184-top, viewBox: `0 ${top} ${width} ${184-top}`, 'aria-label': `${plan.floor}층 교실 배치도` });
    const [left,right] = plan.corridor;
    svg.append(svgEl('rect',{x:x((left-26)*3),y:y(120),width:x((right-26)*3)-x((left-26)*3),height:y(166)-y(120),class:'plan-corridor'}));
    const corridor=svgEl('text',{x:(x((left-26)*3)+x((right-26)*3))/2,y:100,'text-anchor':'middle','font-size':12});
    corridor.textContent='복도';svg.append(corridor);
    if (passage) {
      const label=svgEl('text',{x:(x(passage.x)+x(passage.x+passage.width))/2,y:137,'text-anchor':'middle','font-size':13,class:'plan-passage'});
      for(const [index,line] of ['본관','통로'].entries()) { const span=svgEl('tspan',{x:label.getAttribute('x')!,dy:index?16:0});span.textContent=line;label.append(span); }
      svg.append(label);
    }
    for (const room of rooms) {
      const status=!room.spaceId && room.kind==='room'?'closed':roomStatus(room.spaceId);
      const lessons=room.spaceId?getLessonsAtSpace(room.spaceId):[];
      const fullName=room.kind==='elevator'?'E/V':room.label.replace(/\n/g,' ');
      const eventSpace = plan.buildingId === 'main' && plan.floor === 4 && ['공간드림\n(소모임실)', '시청각실'].includes(room.label);
      const languageCenter = plan.buildingId === 'main' && plan.floor === 3 && room.label === '이중언어\n센터';
      const purpose = eventSpace ? room.label === '시청각실' ? '공개보고회장' : '자료 전시' : '';
      const state={public:'공개수업',relocated:'장소 이동 안내',closed:'비공개',general:'일반 공간'}[status];
      const accessible=eventSpace ? `${room.label === '시청각실' ? '시청각실' : '소모임실'} · ${purpose}` : languageCenter ? '이중언어센터 · 일반 공간' : `${fullName} · ${state}${lessons.length?' · '+lessons.map(lesson=>lesson.topic??MISSING_TEXT).join(' / '):''}`;
      const node=room.spaceId?svgEl('a',{href:classroomHref(room.spaceId),'data-space-id':room.spaceId}):svgEl('g',{});
      node.setAttribute('class',`plan-room plan-${status} facility-${room.kind}${selected && selected===room.spaceId?' plan-selected':''}${eventSpace ? ' plan-event-space' : ''}${languageCenter ? ' plan-language-center' : ''}`);
      node.setAttribute('data-source-x',String(room.x));node.setAttribute('data-source-y',String(room.y));
      if(room.spaceId)node.setAttribute('aria-label',accessible);
      const title=svgEl('title',{});title.textContent=accessible;node.append(title);
      let rx=x(room.x), rw=x(room.x+room.width)-rx;
      const ry=roomY(room),rh=room.kind==='stairs'?facilityHeight:y(room.y+room.height)-ry;
      if(korean.includes(room)) {
        const start=x(korean[0].x),end=x(korean[korean.length-1].x+korean[korean.length-1].width);
        rw=(end-start)/korean.length;rx=start+korean.indexOf(room)*rw;
      } else if(!room.spaceId && room.kind!=='room' && room.y<166) {
        const minimum=room.kind==='elevator'?28:18;
        rx-=Math.max(0,minimum-rw)/2;rw=Math.max(minimum,rw);
      }
      if(plan.buildingId==='rear' && plan.floor===2 && room.kind==='stairs' && room.y===70) {
        const evLeft=(x(elevator.x)+x(elevator.x+elevator.width))/2-Math.max(28,x(elevator.x+elevator.width)-x(elevator.x))/2;
        rx=evLeft-4-rw;
      }
      if (eventSpace && room.label === '시청각실') {
        const elevatorCenter = (x(elevator.x) + x(elevator.x + elevator.width)) / 2;
        const elevatorWidth = Math.max(28, x(elevator.x + elevator.width) - x(elevator.x));
        const stair = rooms.find(item => item.kind === 'stairs' && item.y === 40)!;
        const stairCenter = (x(stair.x) + x(stair.x + stair.width)) / 2;
        const stairWidth = Math.max(18, x(stair.x + stair.width) - x(stair.x));
        rx = elevatorCenter + elevatorWidth / 2;
        rw = stairCenter - stairWidth / 2 - rx;
      }
      node.append(svgEl('rect',{x:rx,y:ry,width:rw,height:rh}));
      if(room.kind==='stairs') for(let step=1;step<=5;step++) {
        const vertical=plan.buildingId==='new' && (room.x===(403-26)*3 || (plan.floor===2 && room.x===(459-26)*3));
        node.append(svgEl('line',vertical
          ? {x1:rx+rw*step/6,x2:rx+rw*step/6,y1:ry+1,y2:ry+rh-1,class:'stair-tread'}
          : {x1:rx+1,x2:rx+rw-1,y1:ry+rh*step/6,y2:ry+rh*step/6,class:'stair-tread'}));
      }
      const compact=room.spaceId?.startsWith('korean-instructor-')?'':eventSpace && room.label !== '시청각실' ? '소모임실' : fullName;
      const relocated=room.spaceId?getRelocatedLessonsFromSpace(room.spaceId)[0]:undefined;
      const destination=relocated?catalog.spaces.find(space=>space.id===relocated.spaceIds[0]):undefined;
      const label=room.kind==='stairs'?'':compact+(destination?`\n📍${destination.name}`:'')+(purpose ? `\n${purpose}` : '');
      let size=room.spaceId?13:11, lineHeight=size+3;
      function wrapLabel() {
        measure.font=`${room.spaceId?'700 ':''}${size}px system-ui`;
        const lines:string[]=[];let current='';
        const segments = label.split('\n').flatMap(segment => segment === purpose && segment.includes(' ') && measure.measureText(segment).width > rw - 4 ? segment.split(' ') : [segment]);
        for(const segment of segments) {
          for(const char of segment){
            if(current && measure.measureText(current+char).width>rw-4){lines.push(current);current='';}
            current+=char;
          }
          if(current) lines.push(current);current='';
        }
        return lines;
      }
      let lines = wrapLabel();
      // Keep the relocated 6-1 destination readable after adding the exhibition room.
      if (plan.buildingId === 'main' && plan.floor === 4 && destination) {
        while (lines.length * lineHeight > rh - 4 && size > 11) {
          size--; lineHeight = size + 3; lines = wrapLabel();
        }
      }
      if(lines.length && rw>=size+3 && lines.length*lineHeight<=rh-4){
        let purposeStart = lines.length, purposeLength = 0;
        while (purpose && purposeLength < purpose.replace(/\s/g, '').length && purposeStart > 0) purposeLength += lines[--purposeStart].replace(/\s/g, '').length;
        const text=svgEl('text',{x:rx+rw/2,y:ry+(rh-lines.length*lineHeight)/2+size,'text-anchor':'middle','font-size':size,class:'room-name','aria-hidden':'true'});
        lines.forEach((line,index)=>{const span=svgEl('tspan',{x:rx+rw/2,dy:index?lineHeight:0,...(index >= purposeStart ? {class:'room-purpose'} : {})});span.textContent=line;text.append(span);});
        node.append(text);
      }
      svg.append(node);
    }
    const selectedRoom=svg.querySelector('.plan-selected');
    if(selectedRoom) svg.append(selectedRoom);
    region.replaceChildren(svg);
  }
  const observer=new ResizeObserver(draw);observer.observe(region);requestAnimationFrame(draw);
  return ()=>observer.disconnect();
}
export function mountFloorGuide(main: HTMLElement, buildingId: string, floor?: number, selected?: string) {
  const building = catalog.buildings.find(item => item.id === buildingId);
  const plans = getBuildingFloorPlans(buildingId);
  if (!building || (floor !== undefined && !getFloorPlan(buildingId, floor))) { main.append(el('h1', '안내도를 찾을 수 없습니다.'), link('학교 안내도로', '/guide')); return; }
  main.append(link('← 학교 안내도', '/guide', 'text-link'), el('h1', building.name));
  const buildings = el('nav', undefined, 'actions building-tabs'); buildings.setAttribute('aria-label', '건물 선택');
  for (const item of catalog.buildings) {
    const node = link(item.name, buildingHref(item.id), 'button secondary');
    if (item.id === buildingId) node.setAttribute('aria-current', 'true'); buildings.append(node);
  }
  main.append(buildings, el('p', '교실을 선택하면 수업 안내가 열립니다.', 'note'));
  const legend=el('ul',undefined,'note floor-legend');
  for(const [kind,text] of [['public','공개수업 진행'],['relocated','다른 장소에서 공개수업 진행'],['closed','공개수업 미진행'],['stairs','계단'],['elevator','승강기']]) {
    const item=el('li');
    const symbol=svgEl('svg',{width:32,height:24,viewBox:'0 0 32 24','aria-hidden':'true',class:`legend-symbol plan-room plan-${kind}`});
    symbol.append(svgEl('rect',{x:1,y:1,width:30,height:22}));
    if(kind==='stairs') for(let step=1;step<=5;step++) symbol.append(svgEl('line',{x1:2,x2:30,y1:step*22/6+1,y2:step*22/6+1,class:'stair-tread'}));
    if(kind==='elevator') { const label=svgEl('text',{x:16,y:16,'text-anchor':'middle','font-size':11});label.textContent='E/V';symbol.append(label); }
    item.append(symbol,document.createTextNode(text));legend.append(item);
  }
  main.append(legend);
  const dispose: (() => void)[] = [];
  for (const plan of plans) {
    const section = el('section', undefined, 'card building-floor');
    section.id = `floor-${plan.floor}`; section.dataset.floor = String(plan.floor);
    const heading = el('h2', `${plan.floor}층`); heading.id = `${buildingId}-${plan.floor}-heading`;
    section.setAttribute('aria-labelledby', heading.id);
    const region = el('div', undefined, 'floor-plan'); region.setAttribute('role', 'region');
    region.setAttribute('aria-label', `${building.name} ${plan.floor}층 안내도`);
    section.append(heading, region); main.append(section);
    const registrationFloor = buildingId === 'main' && plan.floor === 1;
    dispose.push(registrationFloor ? mountRegistrationPlan(region, plan, selected) : mountResponsivePlan(region, plan, selected));
    if (registrationFloor) {
      section.append(el('p', '등록 장소: 본관 1층 중앙현관', 'note registration-location'));
    }
    const topics = el('div', undefined, 'floor-topics');
    for (const group of getFloorTopics(plan)) {
      const topic = el('div', undefined, 'floor-topic'); topic.dataset.lessonIds = group.lessonIds.join(' ');
      topic.append(el('h3', group.label), createMaterialText(group.topic)); topics.append(topic);
    }
    section.append(topics);
    const picker = el('details',undefined,'floor-room-picker'); picker.append(el('summary','교실·시설 이름 크게 보기'));
    const choices=el('nav',undefined,'actions'); choices.setAttribute('aria-label',`${plan.floor}층 교실 선택`);
    for(const room of plan.rooms.filter(room=>room.spaceId && (!registrationFloor || room.spaceId === 'kindergarten-public'))) choices.append(link(room.label.replace(/\n/g,' '),classroomHref(room.spaceId!),'button secondary'));
    if(choices.childElementCount)picker.append(choices);
    section.append(picker);
    if (!plan.rooms.some(room => room.spaceId && getLessonsAtSpace(room.spaceId).length)) section.append(el('p', '이 층에는 공개수업이 없습니다.', 'note'));
    if (selected && plan.rooms.some(room => room.spaceId === selected)) {
      if (roomStatus(selected) === 'closed') {
        const panel = createSpacePanel(selected); section.append(panel);
        requestAnimationFrame(() => { if (panel.isConnected) { panel.focus({ preventScroll: true }); panel.scrollIntoView({ block: 'start' }); } });
      } else {
        region.tabIndex = -1;
        requestAnimationFrame(() => { if (region.isConnected) { region.focus({ preventScroll: true }); section.scrollIntoView({ block: 'start' }); } });
      }
    }
  }
  if (!selected && floor && floor !== plans[0]?.floor) requestAnimationFrame(() => { if (main.isConnected) main.querySelector(`#floor-${floor}`)?.scrollIntoView({block:'start'}); });
  return () => dispose.forEach(cleanup => cleanup());
}

export function mountParkingGuide(main: HTMLElement) {
  main.append(link('← 학교 안내도', '/guide', 'text-link'), el('h1', '주차 안내'));
  const section = el('section', undefined, 'card');
  section.append(el('h2', '운동장 주차장'), el('p', '정문 → 회색 아스팔트 진입로 → 운동장 주차장'),
    el('p', '주차 후 본관 1층 중앙현관에서 등록해 주세요.', 'note'));
  main.append(section);
}
