import { describe, expect, it } from 'vitest';
import { catalog } from './catalog';
import { getFloorPlan, getFloorTopics } from './floor-plans';

const topics: Record<string, string> = {
  '1-3': '‘시장놀이’를 하기 위한 인사말 배우기',
  '5-1': '개인의 자유와 전체의 평등 중 무엇이 옳은지 생각하기',
  '5-2': '언어 전문가 부스에서 만나는 다양한 말과 소통',
  '5-3': '언어 전문가 부스에서 만나는 다양한 말과 소통',
  '5-4': '언어 전문가 부스에서 만나는 다양한 말과 소통',
  '5-5': '언어 전문가 부스에서 만나는 다양한 말과 소통',
};

describe('November 2 topics extracted from uploaded lesson plans', () => {
  it.each(Object.entries(topics))('uses the actual PDF learning topic for %s', (classId, topic) => {
    expect(catalog.lessons.find(lesson => lesson.classId === classId)?.topic).toBe(topic);
  });
  it('uses the senior-teacher plan checked participation and expression lenses', () => {
    expect(catalog.lessons.find(lesson => lesson.classId === '1-3')?.lenses).toEqual(['참여', '표현']);
  });
  it('fills only the missing senior context and observation from the supplied reference image', () => {
    const lesson = catalog.lessons.find(lesson => lesson.classId === '1-3')!;
    expect(lesson.context).toBe('다양한 나라의 인사말(안녕하세요, 감사합니다)을 놀이를 통해 배우는 수업');
    expect(lesson.observation).toBe('다른 언어로 활동에 참여해보려고 노력하고, 친구를 배려하며 함께 놀이에 참여하는 모습');
    expect(lesson.support).toBeNull();
  });
  it('orders main 2F topics red, green, blue, moral, science without changing physical room order', () => {
    expect(getFloorTopics(getFloorPlan('main', 2)!).map(group => group.classIds)).toEqual([
      ['multicultural-red'], ['multicultural-green'], ['multicultural-blue'], ['5-1'], ['4-5'],
    ]);
  });
  it('keeps all four fifth-grade Korean classes together and moral separate', () => {
    const group = getFloorTopics(getFloorPlan('main', 3)!).find(group => group.classIds.includes('5-2'))!;
    expect(group.classIds).toEqual(['5-2', '5-3', '5-4', '5-5']);
    expect(group.topic).toBe(topics['5-2']);
    expect(group.classIds).not.toContain('5-1');
  });
});
