import { describe, expect, it } from "vitest";
import { catalog, getLessonPlan, getLessonsAtSpace, getPublicLessons, getRelocatedLessonsFromSpace } from "./catalog";

describe("guide and preference data use the same public lessons", () => {
  it("includes 29 lessons, three multicultural classes and one kindergarten lesson", () => {
    const lessons = getPublicLessons();
    expect(lessons).toHaveLength(29);
    expect(lessons.filter(item => item.kind === "kindergarten")).toHaveLength(1);
    expect(lessons.filter(item => item.kind === "multicultural")).toHaveLength(3);
    expect(lessons.some(item => item.classId === "3-1")).toBe(false);
    expect(getLessonsAtSpace("classroom-3-1")).toEqual([]);
    expect(getRelocatedLessonsFromSpace("classroom-3-1")).toEqual([]);
    expect(getLessonsAtSpace("korean-instructor-1")).toEqual([]);
    expect(getLessonsAtSpace("korean-instructor-2")).toEqual([]);
  });

  it.each([
    ["5-1", "classroom-5-1", "science-1"],
    ["4-5", "classroom-4-5", "science-2"],
    ["6-1", "classroom-6-1", "english"],
  ])("routes %s from its origin classroom to its actual room", (classId, origin, actual) => {
    expect(getLessonsAtSpace(origin)).toEqual([]);
    expect(getRelocatedLessonsFromSpace(origin).map(item => item.classId)).toEqual([classId]);
    expect(getLessonsAtSpace(actual).map(item => item.classId)).toEqual([classId]);
    expect(getRelocatedLessonsFromSpace(actual)).toEqual([]);
  });

  it("keeps 1-3 in its own classroom and does not offer an unnecessary move", () => {
    expect(getLessonsAtSpace("classroom-1-3").map(item => item.classId)).toEqual(["1-3"]);
    expect(getRelocatedLessonsFromSpace("classroom-1-3")).toEqual([]);
  });

  it("preserves source kindergarten rooms and connects its provided PDF without inventing text", () => {
    for (const id of ["kindergarten-saemmul", "kindergarten-haetsal", "kindergarten-pullip"]) {
      expect(getLessonsAtSpace(id)).toEqual([]);
      expect(getRelocatedLessonsFromSpace(id)).toEqual([]);
      expect(catalog.spaces.some(space => space.id === id)).toBe(true);
    }
    expect(catalog.classes.find(item=>item.id==='kindergarten-joint')?.isPublic).toBe(true);
    const lessons = getLessonsAtSpace('kindergarten-public');
    expect(lessons).toHaveLength(1);
    const lesson = lessons[0];
    expect(lesson.classId).toBe('kindergarten-joint');
    expect(lesson.locationStatus).toBe('confirmed');
    expect(lesson.topic).toBe('함께 가을 열매를 수확하는 협동 게임.');
    for (const key of ['context', 'observation', 'support'] as const) expect(lesson[key]).toBeNull();
    expect(lesson.lenses).toEqual([]);
    expect(getLessonPlan(lesson)?.url).toBe('/pdfs/kindergarten.pdf');
    expect(catalog.spaces.find(space => space.id === 'kindergarten-public')).toMatchObject({name:'유치원', buildingId:'main', floor:1});
    expect(catalog.lessonPlans.some(item=>item.id==='kindergarten')).toBe(true);
  });

  it("provides no PDF request target for missing separate plans", () => {
    for (const classId of ["1-3", "5-1", "4-5", "6-3", "multicultural-green"]) {
      const lesson = catalog.lessons.find(item => item.classId === classId)!;
      expect(lesson.lessonPlanId).toBeNull();
      expect(getLessonPlan(lesson)).toBeNull();
    }
    const regular = catalog.lessons.find(item => item.classId === "3-2")!;
    expect(getLessonPlan(regular)?.url).toBe("/pdfs/grade-3.pdf");
  });

  it('connects all ten explicitly provided plans only to their intended classes', () => {
    expect(catalog.lessonPlans).toHaveLength(10);
    const mappings: Record<string, string[]> = {
      'grade-1': ['1-1', '1-2'], 'grade-2': ['2-1', '2-2', '2-3', '2-4'],
      'grade-3': ['3-2', '3-3', '3-4'], 'grade-4': ['4-1', '4-2', '4-3', '4-4'],
      'grade-5': ['5-2', '5-3', '5-4', '5-5'], 'grade-6-245': ['6-2', '6-4', '6-5'],
      'special-6-1': ['6-1'], 'multicultural-red': ['multicultural-red'],
      'multicultural-blue': ['multicultural-blue'], kindergarten: ['kindergarten-joint'],
    };
    for (const [planId, classIds] of Object.entries(mappings)) {
      expect(catalog.lessons.filter(lesson => lesson.lessonPlanId === planId).map(lesson => lesson.classId)).toEqual(classIds);
      for (const classId of classIds) expect(getLessonPlan(catalog.lessons.find(lesson => lesson.classId === classId)!)?.url).toBe(`/pdfs/${planId}.pdf`);
    }
  });

  it('keeps the new moral lesson separate from old science and grade-wide materials', () => {
    const lesson = getLessonsAtSpace('science-1')[0];
    expect(lesson).toMatchObject({id:'lesson-5-1', subject:'도덕', kind:'special', spaceIds:['science-1']});
    for (const key of ['gradeTheme', 'topic', 'designFocus', 'commonObservation', 'lessonPlanId'] as const) expect(lesson[key]).toBeNull();
    expect(lesson.observation).toBe('모국어로 의견 작성, 또래 번역가를 통한 토의');
    expect(lesson.support).toBe('활동지 번역 자료, 필요 시 또래 번역가');
    expect(lesson.lenses).toEqual(['표현', '강점']);
    expect(lesson.source).toEqual({classRow:null, gradeRow:null, supplementalClassRow:{sheet:'공개수업(학급, 전담, 특별학급)', row:55, fields:['context','observation','support','lenses']}});
  });

  it('updates changed class text from the new workbook and records changed fields only', () => {
    const red = catalog.lessons.find(lesson => lesson.classId === 'multicultural-red')!;
    expect(red.observation).toBe('학생이 자신의 강점을 활용해 소개할 내용을 구체화하고, 그림·핵심 낱말·한국어 문장을 연결하여 생각을 표현하는 모습');
    expect(red.source.supplementalClassRow).toMatchObject({row:62, fields:['context','observation','support']});
    expect(catalog.lessons.filter(lesson => lesson.source.supplementalClassRow)).toHaveLength(14);
    expect(catalog.sources.supplementalWorkbook?.path).toBe('materials/original/curriculum/1020-additions/2026 공개보고회 준비(공개수업, 예산).xlsx');
    expect(catalog.lessons.find(lesson => lesson.classId === '1-3')?.context).toBeNull();
  });

  it("keeps missing values separate from presentation wording", () => {
    expect(catalog.lessons.find(item => item.classId === "1-3")?.topic).toBeNull();
    expect(JSON.stringify(catalog)).not.toContain("자료 업로드 예정");
  });

  it('uses the exact user topics per class and keeps the English class context on one line', () => {
    expect(catalog.lessons.find(lesson => lesson.classId === 'multicultural-red')?.topic).toBe('우리 반을 글과 그림으로 소개하기');
    expect(catalog.lessons.find(lesson => lesson.classId === 'multicultural-blue')?.topic).toBe('자신의 경험을 그림일기로 표현하기');
    expect(catalog.lessons.find(lesson => lesson.classId === 'multicultural-green')?.topic).toBeNull();
    expect(catalog.lessons.find(lesson => lesson.classId === '6-1')?.context).toBe('다문화 학생은 없으나 영어 과제 수행의 실력 차이가 있는 학급');
  });

  it('uses the new first-grade common text without applying it to separate lessons', () => {
    for (const classId of ['1-1', '1-2']) {
      const lesson = catalog.lessons.find(item => item.classId === classId)!;
      expect(lesson.topic).toBe('여러 나라 말과 몸짓으로 인사하며 알뜰 시장 놀이하기');
      expect(lesson.designFocus).toBe('배운 인사말을 시장 놀이에 활용하고, 친구에게 인사말을 배우며 말·카드·몸짓으로 참여하기');
      expect(lesson.commonObservation).toBe('서로 다른 말을 배우고, 말과 몸짓으로 반갑고 고마운 마음을 주고받으며 함께 놀이하기');
      expect(lesson.source.supplementalGradeRow).toEqual({sheet:'공개수업(학년)', row:7, fields:['topic','designFocus','commonObservation']});
    }
    expect(catalog.lessons.filter(lesson => lesson.source.supplementalGradeRow)).toHaveLength(2);
    for (const classId of ['1-3', '5-1', '4-5', '6-1']) {
      const lesson = catalog.lessons.find(item => item.classId === classId)!;
      for (const field of ['topic', 'designFocus', 'commonObservation'] as const) expect(lesson[field]).toBeNull();
    }
  });
});
