import { catalog, getLessonsAtSpace, getRelocatedLessonsFromSpace } from './catalog';

/** Traced from original floor-plan PDF page 1; x preserves the room order and
 * intervening facilities. Widths are schematic, not measurements. North is the
 * top of the supplied diagram, not a surveyed geographic orientation. */
export interface PlanRoom {
  label: string;
  x: number; y: number; width: number; height: number;
  spaceId?: string;
  kind: 'room' | 'stairs' | 'elevator' | 'toilet' | 'entrance' | 'outdoor';
}
export interface FloorPlan { buildingId: string; floor: number; rooms: PlanRoom[]; corridor: [number, number]; }
type Cell = [rightEdge: number, label: string, spaceId?: string];
const plans: FloorPlan[] = [];
function plan(buildingId: string, floor: number, corridor: [number, number] = [58, 537]) {
  const result: FloorPlan = { buildingId, floor, rooms: [], corridor };
  plans.push(result);
  function box(left: number, right: number, label: string, y = 166, height = 134, spaceId?: string) {
    const kind = label.includes('화장실') ? 'toilet' : label === '계단' ? 'stairs' : label === '엘리베이터' ? 'elevator' : label.includes('현관') ? 'entrance' : label.includes('필로티') ? 'outdoor' : 'room';
    result.rooms.push({ label, x: (left - 26) * 3, y, width: (right - left) * 3, height, spaceId, kind });
  }
  function row(left: number, cells: Cell[], y = 166, height = 134) {
    for (const [right, label, spaceId] of cells) { box(left, right, label, y, height, spaceId); left = right; }
  }
  return { box, row };
}

{
  const p = plan('main', 4);
  p.row(58, [[72,'화장실'],[100,'미술실'],[117,'계단'],[157,'6-1','classroom-6-1'],[197,'6-2','classroom-6-2'],[237,'공간드림\n(소모임실)'],[277,'6-3','classroom-6-3'],[317,'6-4','classroom-6-4'],[357,'6-5','classroom-6-5'],[374,'화장실'],[413,'영어실','english'],[433,'계단'],[467,'음악실'],[501,'음악준비실'],[537,'당구실']]);
  p.box(191,274,'시청각실',40,80); p.box(274,294,'계단',40,80); p.box(313,337,'6학년\n연구실',40,80); p.box(126,151,'엘리베이터',70,50);
}
{
  const p = plan('main', 3);
  p.row(58, [[72,'화장실'],[100,'미술실'],[117,'계단'],[157,'5-1','classroom-5-1'],[197,'5-2','classroom-5-2'],[237,'공간드림\n(발표실)'],[277,'이중언어\n센터'],[317,'5-3','classroom-5-3'],[357,'5-4','classroom-5-4'],[374,'화장실'],[413,'5-5','classroom-5-5'],[433,'계단'],[537,'도서실']]);
  p.row(191, [[215,'통합\n연구실'],[238,'5학년\n연구실'],[262,'수석실'],[286,'교과\n전담실'],[304,'계단'],[325,'미표기\n공간'],[348,'인쇄실']],40,80);
  p.box(126,151,'엘리베이터',70,50);
}
{
  const p = plan('main', 2);
  p.row(58, [[72,'화장실'],[100,'2컴퓨터실'],[117,'계단'],[154,'Wee Class'],[172,'교직원\n화장실'],[253,'회의실'],[279,'교무실'],[297,'교장실'],[325,'파랑반','multicultural-blue'],[357,'교과교실'],[374,'화장실'],[413,'미래교실'],[433,'계단'],[467,'과학준비실'],[502,'1과학실','science-1'],[537,'2과학실','science-2']]);
  p.row(194, [[215,'빨강반','korean-red'],[236,'강사용\n교실 1','korean-instructor-1'],[257,'강사용\n교실 2','korean-instructor-2'],[278,'초록반','korean-green'],[296,'계단'],[324,'연결통로\n안성갤러리']],30,90);
  p.box(126,151,'엘리베이터',70,50);
}
{
  const p = plan('main', 1);
  p.row(58, [[66,'필로티'],[78,'물탱크실'],[98,'역사관'],[118,'현관'],[155,'풍물실'],[172,'화장실'],[281,'공간드림\n(놀이마루)'],[303,'현관'],[334,'보건실'],[366,'행정실'],[386,'화장실'],[417,'유치원\n다우리'],[436,'현관'],[470,'샘물반','kindergarten-saemmul'],[503,'햇살반','kindergarten-haetsal'],[537,'풀잎반','kindergarten-pullip']]);
  p.box(190,281,'1컴퓨터실',20,45); p.box(190,258,'서고',65,55);
  p.box(281,303,'현관',40,80); p.box(303,334,'당직실',40,80);
  p.row(436, [[470,'세면대'],[503,'유치원\n연구실'],[537,'주방']],40,80);
  p.box(126,151,'엘리베이터',70,50);
  // Aggregate public kindergarten marker; the three original classroom records remain above.
  p.box(503,537,'유치원',120,180,'kindergarten-public');
}
{
  const p = plan('rear', 3, [57,502]);
  p.box(29,57,'화장실',120,180);
  p.row(57, [[74,'교구실'],[99,'계단'],[163,'돌봄3'],[224,'4-1','classroom-4-1'],[280,'4-2','classroom-4-2'],[306,'4학년\n연구실'],[371,'4-3','classroom-4-3'],[443,'4-4','classroom-4-4'],[502,'4-5','classroom-4-5']]);
  p.box(332,374,'엘리베이터',70,50);
}
{
  const p = plan('rear', 2, [57,502]);
  p.box(29,57,'화장실',120,180);
  p.row(57, [[74,'서고'],[96,'계단'],[129,'꿈자람\n교실'],[163,'1학년\n연구실'],[224,'1-1','classroom-1-1'],[280,'1-2','classroom-1-2'],[306,'계단'],[372,'늘봄1'],[443,'늘봄2'],[502,'1-3','classroom-1-3']]);
  p.box(338,374,'엘리베이터',70,50); p.box(418,502,'식생활교육실',40,80);
}
{
  const p = plan('rear', 1, [57,502]);
  p.box(29,57,'화장실',120,180);
  p.row(57, [[74,'녹색물품'],[99,'현관'],[134,'학부모\n상주실'],[195,'돌봄2'],[280,'활동실'],[306,'현관'],[372,'돌봄1'],[443,'식당\n준비실'],[502,'전기실']]);
  p.box(338,374,'엘리베이터',70,50); p.row(408,[[440,'영양실'],[502,'급식조리실']],40,80);
}
for (const floor of [2,3]) {
  const p = plan('new',floor,[29,459]);
  const grade = floor === 3 ? 3 : 2;
  p.row(29, [[65,'계단'],[135,`${grade}-4`,`classroom-${grade}-4`],[205,`${grade}-3`,`classroom-${grade}-3`],[234,`${grade}학년\n교사연구실`],[318,`${grade}-2`,`classroom-${grade}-2`],[403,`${grade}-1`,`classroom-${grade}-1`]]);
  p.row(205,[[234,'여 화장실'],[275,'세면대'],[313,'남 화장실']],40,80);
  p.box(430,459,'엘리베이터',166,44); p.box(403,459,'계단',210,90);
  if (floor === 2) {
    p.box(100,135,'계단',0,80); p.box(430,459,'현관',120,46);
    p.box(459,523,'계단',120,46); p.box(459,523,'캐노피',166,134);
  }
}
{
  const p = plan('new',1,[187,459]);
  p.box(29,65,'계단'); p.box(65,231,'필로티 (야외)'); p.box(135,170,'계단',0,80);
  p.row(231,[[269,'여 화장실'],[313,'남 화장실']],40,80);
  p.row(231,[[313,'통합지원1'],[397,'통합지원2']]);
  p.box(430,459,'엘리베이터',166,44); p.box(397,459,'계단',210,90);
}
export const floorPlans = plans;
export function buildingHref(buildingId: string) { return `/guide/${buildingId}`; }
/** Main 1F provides registration guidance; rear/new 1F remain excluded. */
export function getBuildingFloorPlans(buildingId: string) {
  return floorPlans.filter(plan => plan.buildingId === buildingId && (plan.floor !== 1 || buildingId === 'main'))
    .sort((a, b) => b.floor - a.floor);
}
export function getFloorPlan(buildingId: string, floor: number) {
  return floorPlans.find(item => item.buildingId === buildingId && item.floor === floor);
}
export function floorHref(buildingId: string, floor: number, spaceId?: string) {
  return `/guide/${buildingId}/${floor}${spaceId ? `?space=${encodeURIComponent(spaceId)}` : ''}`;
}
export function spaceHref(spaceId: string) {
  const space = catalog.spaces.find(item => item.id === spaceId);
  return space ? floorHref(space.buildingId, space.floor, space.id) : '/guide';
}
export function classroomHref(spaceId: string) {
  const lesson = getLessonsAtSpace(spaceId)[0] ?? getRelocatedLessonsFromSpace(spaceId)[0];
  return lesson ? `/lessons/${lesson.id}?from=${encodeURIComponent(spaceId)}` : spaceHref(spaceId);
}
export function roomStatus(spaceId?: string): 'public' | 'relocated' | 'closed' | 'general' {
  if (!spaceId) return 'general';
  if (getLessonsAtSpace(spaceId).length) return 'public';
  if (getRelocatedLessonsFromSpace(spaceId).length) return 'relocated';
  return 'closed';
}

/** Common topics belong below the intact classroom row; exceptions stay separate. */
export function getFloorTopics(plan: FloorPlan) {
  const groups = new Map<string, { label: string; topic: string | null; lessonIds: string[]; classIds: string[] }>();
  const lessons = [...new Map(plan.rooms.flatMap(room => room.spaceId ? getLessonsAtSpace(room.spaceId).map(lesson => [lesson.id, lesson] as const) : [])).values()];
  for (const lesson of lessons) {
    const schoolClass = catalog.classes.find(item => item.id === lesson.classId)!;
    const key = lesson.kind === 'homeroom' ? `grade-${schoolClass.grade}:${lesson.topic}` : lesson.kind === 'multicultural' ? `multicultural:${lesson.topic}` : lesson.id;
    let group = groups.get(key);
    if (!group) {
      const multipleTopics = lesson.kind === 'homeroom' && new Set(lessons.filter(item=>item.kind==='homeroom' && catalog.classes.find(entry=>entry.id===item.classId)?.grade===schoolClass.grade).map(item=>item.topic)).size > 1;
      group = { label: lesson.kind === 'homeroom' ? `${schoolClass.grade}학년${multipleTopics ? '' : ' 공개수업'}` : lesson.kind === 'multicultural' ? '다문화특별학급' : lesson.kind === 'kindergarten' ? '유치원' : `${lesson.classId} ${lesson.subject ?? ''}`.trim(), topic: lesson.topic, lessonIds: [], classIds: [] };
      groups.set(key, group);
    }
    group.lessonIds.push(lesson.id); group.classIds.push(lesson.classId);
  }
  for (const group of groups.values()) {
    if (/^\d학년$/.test(group.label)) group.label += ` · ${group.classIds.join('·')}`;
  }
  return [...groups.values()];
}
