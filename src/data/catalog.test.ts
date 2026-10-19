import { describe, expect, it } from "vitest";
import { catalog, getLessonPlan, getLessonsAtSpace, getPublicLessons, getRelocatedLessonsFromSpace } from "./catalog";

describe("guide and preference data use the same public lessons", () => {
  it("includes 28 lessons and three multicultural classes; kindergarten is excluded", () => {
    const lessons = getPublicLessons();
    expect(lessons).toHaveLength(28);
    expect(lessons.filter(item => item.kind === "kindergarten")).toHaveLength(0);
    expect(lessons.filter(item => item.kind === "multicultural")).toHaveLength(3);
    expect(lessons.some(item => item.classId === "5-1")).toBe(false);
    expect(getLessonsAtSpace("classroom-5-1")).toEqual([]);
    expect(getLessonsAtSpace("korean-instructor-1")).toEqual([]);
    expect(getLessonsAtSpace("korean-instructor-2")).toEqual([]);
  });

  it.each([
    ["3-1", "classroom-3-1", "science-1"],
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

  it("retains kindergarten space records without public lessons or PDF targets", () => {
    for (const id of ["kindergarten-saemmul", "kindergarten-haetsal", "kindergarten-pullip"]) {
      expect(getLessonsAtSpace(id)).toEqual([]);
    }
    expect(catalog.classes.find(item=>item.id==='kindergarten-joint')?.isPublic).toBe(false);
    expect(catalog.lessonPlans.some(item=>item.id==='kindergarten')).toBe(false);
  });

  it("provides no PDF request target for missing separate plans", () => {
    for (const classId of ["1-3", "3-1", "4-5", "6-1"]) {
      const lesson = catalog.lessons.find(item => item.classId === classId)!;
      expect(lesson.lessonPlanId).toBeNull();
      expect(getLessonPlan(lesson)).toBeNull();
    }
    const regular = catalog.lessons.find(item => item.classId === "3-2")!;
    expect(getLessonPlan(regular)?.url).toBe("/pdfs/grade-3.pdf");
  });

  it("keeps missing values separate from presentation wording", () => {
    expect(catalog.lessons.find(item => item.classId === "1-1")?.topic).toBeNull();
    expect(JSON.stringify(catalog)).not.toContain("자료 업로드 예정");
  });
});
