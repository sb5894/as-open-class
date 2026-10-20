import { describe, expect, it } from 'vitest';
import { catalog, getPublicLessons, getLessonsAtSpace, getRelocatedLessonsFromSpace } from './catalog';
import { floorPlans, getFloorPlan, getBuildingFloorPlans, getFloorTopics, roomStatus, spaceHref } from './floor-plans';
import { interestOptions } from '../../functions/src/interest-options';

describe('floor-plan coverage and source placement', () => {
  it('shows each common topic once, preserving the distinct grade-six topics and special lessons', () => {
    const fourth=getFloorTopics(getFloorPlan('rear',3)!);
    expect(fourth).toHaveLength(1);
    expect(fourth[0].label).toBe('4학년 공개수업');
    expect(fourth[0].classIds).toEqual(['4-1','4-2','4-3','4-4']);
    expect(fourth[0].topic).toBe(catalog.lessons.find(lesson=>lesson.classId==='4-1')!.topic);
    const sixth=getFloorTopics(getFloorPlan('main',4)!);
    expect(sixth.find(group=>group.classIds.includes('6-2'))!.classIds).toEqual(['6-2','6-4','6-5']);
    expect(sixth.find(group=>group.classIds.includes('6-3'))!.classIds).toEqual(['6-3']);
    expect(sixth.find(group=>group.classIds.includes('6-1'))!.topic).toBeNull();
    expect(sixth).toHaveLength(3);
  });
  it('covers every actual public lesson exactly once in the topic strips without including relocated origin rooms', () => {
    const ids=catalog.buildings.flatMap(building=>getBuildingFloorPlans(building.id)).flatMap(plan=>getFloorTopics(plan).flatMap(group=>group.lessonIds));
    expect(ids.sort()).toEqual(getPublicLessons().map(lesson=>lesson.id).sort());
    expect(getFloorTopics(getFloorPlan('new',3)!).flatMap(group=>group.classIds)).not.toContain('3-1');
    expect(getFloorTopics(getFloorPlan('main',2)!).flatMap(group=>group.classIds)).toContain('5-1');
    expect(getFloorTopics(getFloorPlan('main',3)!).flatMap(group=>group.classIds)).not.toContain('5-1');
    expect(getFloorTopics(getFloorPlan('rear',1)!)).toEqual([]);
  });
  it('covers all ten catalog floors and every room exactly once at its actual building/floor', () => {
    expect(floorPlans).toHaveLength(10);
    for (const building of catalog.buildings) for (const floor of building.floors) expect(getFloorPlan(building.id, floor)).toBeDefined();
    for (const space of catalog.spaces) {
      const matches = floorPlans.flatMap(plan => plan.rooms.filter(room => room.spaceId === space.id).map(room => ({ plan, room })));
      expect(matches, space.id).toHaveLength(1);
      expect(matches[0].plan.buildingId).toBe(space.buildingId);
      expect(matches[0].plan.floor).toBe(space.floor);
      expect(matches[0].room.width).toBeGreaterThanOrEqual(44);
      expect(matches[0].room.height).toBeGreaterThanOrEqual(44);
    }
  });
  it('makes all 29 public lessons reachable in building overviews and shares exactly the registration lesson set', () => {
    const publicIds = getPublicLessons().map(lesson => lesson.id).sort();
    const mapped = new Set(catalog.buildings.flatMap(building=>getBuildingFloorPlans(building.id)).flatMap(plan => plan.rooms.flatMap(room => room.spaceId ? getLessonsAtSpace(room.spaceId).map(lesson => lesson.id) : [])));
    expect([...mapped].sort()).toEqual(publicIds);
    expect([...new Set(interestOptions.flatMap(option => option.lessonIds))].sort()).toEqual(publicIds);
    for (const lesson of getPublicLessons()) for (const id of lesson.spaceIds) expect(spaceHref(id)).not.toBe('/guide');
    expect(getBuildingFloorPlans('main').map(item=>item.floor)).toEqual([4,3,2,1]);
    expect(getBuildingFloorPlans('rear').map(item=>item.floor)).toEqual([3,2]);
    expect(getBuildingFloorPlans('new').map(item=>item.floor)).toEqual([3,2]);
  });
  it('preserves intervening facilities, classroom order and north/south bands from the PDF', () => {
    const main4 = getFloorPlan('main', 4)!;
    const at = (id: string) => main4.rooms.find(room => room.spaceId === id)!;
    expect(at('classroom-6-2').y).toBe(at('classroom-6-3').y);
    expect(main4.rooms.find(room => room.label.includes('소모임실'))!.x).toBeGreaterThan(at('classroom-6-2').x);
    expect(main4.rooms.find(room => room.label.includes('소모임실'))!.x).toBeLessThan(at('classroom-6-3').x);
    const main2 = getFloorPlan('main', 2)!;
    const korean = main2.rooms.filter(room => room.spaceId?.startsWith('korean-'));
    expect(korean.map(room => room.spaceId)).toEqual(['korean-red','korean-instructor-1','korean-instructor-2','korean-green']);
    expect(korean.every(room => room.y < 120)).toBe(true);
    const blue = main2.rooms.find(room => room.spaceId === 'multicultural-blue')!;
    const principal = main2.rooms.find(room => room.label === '교장실')!;
    expect(principal.x + principal.width).toBe(blue.x);
    for (const [building, floor, ids] of [
      ['new',3,['classroom-3-4','classroom-3-3','classroom-3-2','classroom-3-1']],
      ['rear',3,['classroom-4-1','classroom-4-2','classroom-4-3','classroom-4-4','classroom-4-5']],
      ['main',1,['kindergarten-saemmul','kindergarten-haetsal','kindergarten-pullip']],
    ] as const) {
      const plan = getFloorPlan(building, floor)!;
      const rooms = ids.map(id => plan.rooms.find(room => room.spaceId === id)!);
      expect(rooms.map(room => room.x)).toEqual(rooms.map(room => room.x).sort((a,b)=>a-b));
      expect(rooms.every(room => room.y >= 166)).toBe(true);
    }
  });
  it('retains elevators on all floors and source-specific stairs/toilets instead of assuming identical facilities', () => {
    for (const plan of floorPlans) {
      expect(plan.rooms.some(room => room.kind === 'elevator')).toBe(true);
      expect(plan.rooms.some(room => room.kind === 'toilet')).toBe(true);
    }
    expect(getFloorPlan('main',1)!.rooms.filter(room=>room.kind==='stairs')).toHaveLength(0);
    expect(getFloorPlan('main',4)!.rooms.filter(room=>room.kind==='stairs')).toHaveLength(3);
    expect(getFloorPlan('rear',1)!.rooms.filter(room=>room.kind==='stairs')).toHaveLength(0);
    expect(getFloorPlan('rear',2)!.rooms.filter(room=>room.kind==='stairs')).toHaveLength(2);
    expect(getFloorPlan('new',2)!.rooms.filter(room=>room.kind==='stairs')).toHaveLength(4);
  });
  it('keeps non-public rooms and relocated origins distinct from missing public materials', () => {
    for (const id of ['classroom-3-1','korean-instructor-1','korean-instructor-2']) {
      expect(roomStatus(id)).toBe('closed'); expect(getLessonsAtSpace(id)).toEqual([]);
    }
    expect(roomStatus()).toBe('general');
    for (const [origin, actual, classId] of [['classroom-5-1','science-1','5-1'],['classroom-4-5','science-2','4-5'],['classroom-6-1','english','6-1']]) {
      expect(roomStatus(origin)).toBe('relocated');
      expect(getRelocatedLessonsFromSpace(origin)[0].spaceIds).toEqual([actual]);
      expect(getLessonsAtSpace(actual)[0].classId).toBe(classId);
    }
    expect(roomStatus('classroom-1-3')).toBe('public');
    expect(getRelocatedLessonsFromSpace('classroom-1-3')).toEqual([]);
    expect(roomStatus('classroom-1-1')).toBe('public');
  });
});
