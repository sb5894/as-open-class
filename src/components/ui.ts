import { catalog, type Lesson } from '../data/catalog';
export function el<K extends keyof HTMLElementTagNameMap>(tag: K, text?: string, cls?: string) {
  const node = document.createElement(tag);
  if (text) node.textContent = text;
  if (cls) node.className = cls;
  return node;
}
export function link(text: string, href: string, cls = 'button') {
  const node = el('a', text, cls); node.href = href; return node;
}
export function lessonName(lesson: Lesson) {
  return catalog.classes.find(item => item.id === lesson.classId)!.name + (lesson.subject ? ` · ${lesson.subject}` : '');
}
export function location(lesson: Lesson) {
  return '📍 ' + lesson.spaceIds.map(id => {
    const room = catalog.spaces.find(item => item.id === id)!;
    return `${catalog.buildings.find(item => item.id === room.buildingId)!.name} ${room.floor}층 ${room.name}`;
  }).join(' · ') + (lesson.locationStatus === 'provisional' ? ' (가안)' : '');
}


