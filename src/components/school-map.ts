import positions from '../data/school-map.json';
import { el, link } from './ui';
import { buildingHref } from '../data/floor-plans';

export function createSchoolMap() {
  const section = el('section', undefined, 'card school-guide');
  section.setAttribute('aria-labelledby', 'school-map-title');
  const heading = el('h2', '학교 안내'); heading.id = 'school-map-title';
  const notice = el('p', '등록: 본관 1층 중앙현관 · 주차: 운동장', 'note');
  const control = el('label', undefined, 'map-route-control');
  const toggle = el('input'); toggle.type = 'checkbox'; toggle.checked = true;
  control.append(toggle, document.createTextNode('주차 진입 동선 보기'));
  const frame = el('div', undefined, 'school-map-frame');
  frame.setAttribute('role', 'region');
  frame.setAttribute('aria-label', '학교 안내도');
  const map = el('div', undefined, 'school-map');
  const image = el('img'); image.src = '/assets/maps/school-guide-v2-1024.webp';
  image.srcset = '/assets/maps/school-guide-v2-768.webp 768w, /assets/maps/school-guide-v2-1024.webp 1024w';
  image.sizes = '(max-width: 700px) calc(100vw - 60px), 640px';
  image.width = 1024; image.height = 1536;
  image.alt = '왼쪽 신관, 가운데 본관, 위쪽 후관. 정문에서 회색 진입로를 따라 가운데 운동장에 주차하며, 운동장 아래에 작은 놀이터, 오른쪽에 강당이 있습니다.';
  map.append(image);
  function label(text: string, point: number[], className = '', href?: string) {
    const classes = `school-map-label ${className}${href ? ' school-map-link' : ''}`;
    const node = href ? link(text, href, classes) : el('span', text, classes);
    node.style.left = `${point[0]}%`; node.style.top = `${point[1]}%`;
    map.append(node); return node;
  }
  for (const place of positions.places) {
    const href = ['main', 'rear', 'new'].includes(place.id) ? buildingHref(place.id) : place.id === 'parking' ? '/guide/parking' : undefined;
    const building=['main','rear','new'].includes(place.id);
    const node=label(place.id === 'parking' ? '운동장\n주차장' : place.label, place.point, building?'school-map-building':place.id === 'parking' ? 'map-parking-label' : 'school-map-static', href);
    if(building) node.setAttribute('aria-label',place.label);
  }
  label('등록 장소:\n본관 1층 중앙현관', positions.entrance.point, 'map-entrance-label');
  label('시청각실\n공개보고회장', [35, 32], 'map-auditorium-label', '/guide/main/4');
  label('교직원 전용\n주차장', [16, 83], 'school-map-static map-staff-label');
  const ns = 'http://www.w3.org/2000/svg';
  const route = document.createElementNS(ns, 'svg');
  route.classList.add('school-map-route'); route.setAttribute('viewBox', '0 0 100 100');
  route.setAttribute('preserveAspectRatio', 'none'); route.setAttribute('aria-hidden', 'true');
  const path = document.createElementNS(ns, 'path');
  path.setAttribute('d', positions.parkingRoute.points.map(([x, y], index) => `${index ? 'L' : 'M'}${x} ${y}`).join(' '));
  const arrow = document.createElementNS(ns, 'polygon');
  arrow.setAttribute('points', '54.8,63 57,60 59.2,63');
  arrow.classList.add('route-arrow');
  route.append(path, arrow); map.append(route);
  const routeLabel = label('주차 진입', [57, 91], 'map-route-label');
  toggle.addEventListener('change', () => { route.toggleAttribute('hidden', !toggle.checked); routeLabel.hidden = !toggle.checked; });
  frame.append(map);
  section.append(heading, notice, frame, control);
  return section;
}
