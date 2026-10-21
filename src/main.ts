import './styles.css';
import { catalog, getPublicLessons, getLessonPlan, getRelocatedLessonsFromSpace, type Lesson } from './data/catalog';
import './home.css';
import '@fontsource/noto-sans-kr/400.css';
import '@fontsource/noto-sans-kr/600.css';
import '@fontsource/noto-sans-kr/700.css';
import { event } from './data/event';
import { createMaterialText, createPdfPlaceholder } from './components/placeholders';
import { el, link, lessonName, location } from './components/ui';
import { mountRegistration } from './registrations/form';
import { createLenses } from './components/lenses';
import { createSchoolMap } from './components/school-map';
import { mountFloorGuide, mountParkingGuide } from './components/floor-guide';
import { spaceHref } from './data/floor-plans';
import { createEventSchedule } from './components/event-schedule';
import { createModelTwo } from './components/model-two';
import { createGradeFocus, createLessonGradeFocus } from './components/grade-focus';

function card(title: string) {
  const node = el('section', undefined, 'card'); node.append(el('h2', title)); return node;
}
const app = document.querySelector<HTMLDivElement>('#app')!;
let dispose: (() => void) | undefined;
let version = 0;
function invitation(main: HTMLElement) {
  main.classList.add('page-home');
  const hero = el('section', undefined, 'home-hero');
  hero.setAttribute('aria-labelledby', 'invitation-title');
  const art = el('div', undefined, 'home-hero-art'); art.setAttribute('aria-hidden', 'true');
  for (const position of ['a', 'b', 'c']) art.append(el('div', undefined, `home-orbit ${position}`));
  const heroContent = el('div', undefined, 'home-wrap');
  const eventName = el('p', undefined, 'home-event-name');
  eventName.append(el('span', '2026 안성초등학교'), document.createTextNode('다문화교육 정책연구학교 공개보고회'));
  const title = el('h1'); title.id = 'invitation-title';
  title.append(document.createTextNode('서로의 언어와 문화가,'), el('br'), document.createTextNode('함께의 배움으로'));
  const copy = el('p', undefined, 'home-hero-copy');
  copy.append(el('span', '다양한 언어와 문화가 배움의 자원이 되고,'), el('span', '모두의 강점이 함께 자라는 교실.'));
  const invitationText = el('p', '안성초의 연구와 실천을 나누는 자리에 초대합니다.', 'home-invitation');
  function action(text: string, href: string, variant: string, arrow: string) {
    const button = link(text, href, `home-button ${variant}`);
    const icon = el('span', arrow, 'home-arrow'); icon.setAttribute('aria-hidden', 'true');
    button.append(icon); return button;
  }
  const actions = el('div', undefined, 'home-actions');
  actions.append(action('참관 신청하기', '/register', 'home-apply', '↗'), action('학교·수업 안내', '/guide', 'home-guide', '→'));
  heroContent.append(eventName, title, copy, invitationText, actions,
    el('p', '신청 전에도 수업 안내와 지도안을 자유롭게 볼 수 있습니다.', 'home-footnote'));
  hero.append(art, heroContent);
  const essentials = el('dl', undefined, 'home-essentials home-wrap'); essentials.setAttribute('aria-label', '행사 핵심 정보');
  for (const [label, value, detail] of [
    ['행사 일시', '2026. 11. 11. 수', '12:50–16:00'],
    ['행사 장소', '안성초등학교', '경기도 안성시 혜산로 13'],
    ['참관 신청 마감', '10. 28. 수 · 16:00까지', ''],
  ]) {
    const item = el('div', undefined, 'home-essential');
    const description = el('dd', value); if (detail) description.append(el('small', detail));
    item.append(el('dt', label), description); essentials.append(item);
  }
  const intro = card('행사 소개'); intro.id = 'event';
  const research = el('p');
  const theme = el('strong');
  theme.append(document.createTextNode('「상호문화적 ('), link('만남·배움·어울림', '#model-two', 'model-two-link'), document.createTextNode(') 이중언어 교육 프로그램 운영을 통한 미래 핵심역량 함양」'));
  research.append(document.createTextNode('안성초등학교는 '), theme, document.createTextNode('을 주제로 정책연구학교를 운영하고 있습니다.'));
  const facts = el('ul', undefined, 'event-facts note');
  for (const [text, bold] of [
    ['일시: 2026. 11. 11.(수) 12:50~16:00', true],
    ['장소: 안성초등학교 (등록: 본관 1층 중앙현관)', false],
    ['내용: 공개수업 → 전체보고 → 사후협의', false],
    ['신청 기한: 2026. 10. 28.(수) 16:00까지', true],
  ] as const) {
    const item = el('li'); item.append(bold ? el('strong', text) : document.createTextNode(text)); facts.append(item);
  }
  intro.append(research, el('p', '그동안의 연구 성과와 교육과정 운영 사례를 공유하는 공개보고회에 교육 관계자 여러분을 초대합니다.'), facts,
    el('p', '※ 참석 신청을 해주신 분의 소속 기관으로 출장 협조 공문을 보내 드릴 예정입니다.', 'note'));
  const content = el('div', undefined, 'home-content');
  content.append(intro, createEventSchedule(), createModelTwo(), createGradeFocus());
  const dock = el('aside', undefined, 'home-mobile-dock'); dock.setAttribute('aria-label', '참관 신청 바로가기');
  const deadline = el('div', '참관 신청 마감', 'home-dock-deadline'); deadline.append(el('strong', '10. 28. 수 · 16:00'));
  dock.append(deadline, action('참관 신청하기', '/register', 'home-dock-apply', '↗'));
  main.append(hero, essentials, content, dock);
}
function guide(main: HTMLElement) {
  main.classList.add('page-guide');
  main.append(createSchoolMap());
}
async function detail(main: HTMLElement, lesson: Lesson, current: number) {
  const from = new URLSearchParams(window.location.search).get('from');
  const validFrom = from && (lesson.spaceIds.includes(from) || getRelocatedLessonsFromSpace(from).some(item => item.id === lesson.id));
  const space = catalog.spaces.find(item => item.id === (validFrom ? from : lesson.spaceIds[0]))!;
  const building = catalog.buildings.find(item => item.id === space.buildingId)!;
  main.append(link(`← ${building.name} ${space.floor}층`, spaceHref(space.id), 'text-link'), el('p', lessonName(lesson), 'eyebrow'), el('h1', lesson.topic ?? '자료 업로드 예정입니다.'), el('p', location(lesson), 'location'));
  const gradeFocus = createLessonGradeFocus(lesson); if (gradeFocus) main.append(gradeFocus);
  if (!lesson.spaceIds.includes(space.id)) {
    const notice = el('p', undefined, 'map-notice');
    notice.append(document.createTextNode(`${space.name}에서는 진행하지 않습니다.`), el('br'), document.createTextNode('실제 수업 장소는 '), el('strong', location(lesson).replace(/^📍 /, '')), document.createTextNode('입니다.'));
    main.append(notice);
  }
  const info = card('수업 이야기');
  for (const [label, value] of [['수업 주제', lesson.topic], ['학급 맥락', lesson.context], ['참관 포인트', lesson.observation], ['지원인력·환경', lesson.support]]) {
    if (lesson.kind === 'kindergarten' && label !== '수업 주제') continue;
    if (label === '지원인력·환경' && !value?.trim()) continue;
    info.append(el('h3', label!), createMaterialText(value ?? null));
  }
  if (lesson.kind !== 'kindergarten') info.append(el('h3', '중점 렌즈'), createLenses(lesson.lenses));
  const pdf = card('수업 지도안'); main.append(info, pdf);
  const plan = getLessonPlan(lesson);
  if (!plan) { pdf.append(createPdfPlaceholder()); return; }
  const slot = el('div', undefined, 'pdf-viewer-slot pdf-loading');
  slot.setAttribute('aria-live', 'polite'); pdf.append(slot);
  async function load() {
    slot.replaceChildren(el('p', '지도안을 불러오고 있습니다…'));
    try {
      const viewer = await import('./components/pdf-viewer');
      if (current === version) dispose = viewer.mountPdfViewer(slot, plan!.url);
    } catch {
      if (current !== version) return;
      const retry = el('button', '다시 시도'); retry.onclick = () => { void load(); };
      const original = link('PDF 새 탭에서 열기', plan!.url, 'button secondary'); original.target = '_blank'; original.rel = 'noopener';
      slot.replaceChildren(el('p', 'PDF 도구를 불러오지 못했습니다.', 'error'), retry, original);
    }
  }
  await load();
}
function render() {
  dispose?.(); dispose = undefined; const current = ++version;
  const path = window.location.pathname.replace(/\/$/, '') || '/';
  const nav = el('nav', undefined, 'site-nav'); nav.setAttribute('aria-label', '주 메뉴');
  const brand=link('','/','brand');
  const logo=el('img'); logo.src='/assets/brand/anseong-logo-64.webp'; logo.alt=''; logo.width=24; logo.height=24;
  const name = el('span', '안성초등학교'); name.append(el('small', '2026 정책연구학교 공개보고회'));
  brand.append(logo, name);
  nav.append(brand, link('신청하기', '/register', 'nav-link'), link('둘러보기', '/guide', 'nav-link'));
  const main = el('main', undefined, 'page'); main.id = 'main'; main.tabIndex = -1;
  const skip = link('본문 바로가기', '#main', 'skip-link');
  app.replaceChildren(skip, nav, main);
  const floorRoute = path.match(/^\/guide\/(main|rear|new)(?:\/([1-4]))?$/);
  const lesson = getPublicLessons().find(item => path === `/lessons/${item.id}`);
  if (path === '/') invitation(main);
  else if (path === '/guide') guide(main);
  else if (path === '/guide/parking') mountParkingGuide(main);
  else if (floorRoute) dispose = mountFloorGuide(main, floorRoute[1], floorRoute[2] ? Number(floorRoute[2]) : undefined, new URLSearchParams(window.location.search).get('space') ?? undefined);
  else if (path === '/register') mountRegistration(main);
  else if (lesson) void detail(main, lesson, current);
  else main.append(el('h1', '페이지를 찾을 수 없습니다.'), link('둘러보기로 이동', '/guide'));
  document.title = `${path === '/register' ? '참관 신청' : path.startsWith('/guide') ? '둘러보기' : lesson ? `${lessonName(lesson)} 수업 안내` : event.name} | 안성초등학교`;
  main.focus({ preventScroll: true });
}
document.addEventListener('click', event => {
  const anchor = (event.target as Element).closest('a[href]');
  if (!anchor || event.button !== 0 || event.metaKey || event.ctrlKey || event.shiftKey || event.altKey || anchor.getAttribute('target')) return;
  const target = new URL(anchor.getAttribute('href')!, window.location.href);
  if (anchor.classList.contains('model-two-link')) {
    const description = document.getElementById('model-two');
    if (description) {
      event.preventDefault();
      if (window.location.hash !== target.hash) history.pushState(null, '', target.href);
      description.focus({ preventScroll: true });
      description.scrollIntoView({ behavior: window.matchMedia('(prefers-reduced-motion: reduce)').matches ? 'instant' : 'smooth', block: 'start' });
      return;
    }
  }
  if (target.origin !== window.location.origin || target.hash) return;
  event.preventDefault(); history.pushState(null, '', target.href); window.scrollTo(0, 0); render();
});
window.addEventListener('popstate', render);
render();

