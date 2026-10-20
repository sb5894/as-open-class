import generated from "./catalog.generated.json";

export interface Building {
  id: string;
  name: string;
  planLabel: string;
  campusPosition: "center" | "top" | "left";
  floors: number[];
}

export interface Space {
  id: string;
  name: string;
  buildingId: string;
  floor: number;
  kind: "classroom" | "subject" | "multicultural" | "staff" | "kindergarten";
  /** Relative order among included rooms, not measured SVG coordinates. */
  planPosition: { band: "north" | "south"; orderFromLeft: number };
  planLabel: string;
  subdivision: { part: number; total: number } | null;
}

export interface SchoolClass {
  id: string;
  name: string;
  kind: "homeroom" | "multicultural" | "kindergarten";
  grade: number | null;
  homeSpaceIds: string[];
  isPublic: boolean;
}

export interface FileSource { path: string; sha256: string }
export interface RowSource { sheet: string; row: number }
export type Lens = "참여" | "강점" | "협력" | "표현" | "발견";

export interface Lesson {
  id: string;
  classId: string;
  kind: SchoolClass["kind"] | "special";
  subject: string | null;
  spaceIds: string[];
  locationStatus: "confirmed" | "provisional";
  gradeTheme: string | null;
  topic: string | null;
  designFocus: string | null;
  commonObservation: string | null;
  context: string | null;
  observation: string | null;
  support: string | null;
  lenses: Lens[];
  lessonPlanId: string | null;
  source: { classRow: RowSource | null; gradeRow: RowSource | null;
    supplementalClassRow?: RowSource & { fields: string[] }; supplementalGradeRow?: RowSource & { fields: string[] } };
}

export interface LessonPlan { id: string; url: string; source: FileSource }
export interface Catalog {
  schemaVersion: number;
  sources: { workbook: FileSource; floorPlan: FileSource; decisions: string; supplementalWorkbook?: FileSource };
  event: { name: string | null; date: string; time: string | null; address: string | null };
  buildings: Building[];
  spaces: Space[];
  classes: SchoolClass[];
  lessons: Lesson[];
  lessonPlans: LessonPlan[];
  excludedClasses: { classId: string; reason: string }[];
}

// The converter validates IDs and relationships before writing this file.
export const catalog = generated as Catalog;

/** Single list for later guide and preference options. No closed classes. */
export function getPublicLessons(data: Catalog = catalog): Lesson[] {
  const publicIds = new Set(data.classes.filter(item => item.isPublic).map(item => item.id));
  return data.lessons.filter(lesson => publicIds.has(lesson.classId));
}

/** Actual room only: an origin classroom must not host a relocated lesson. */
export function getLessonsAtSpace(spaceId: string, data: Catalog = catalog): Lesson[] {
  return getPublicLessons(data).filter(lesson => lesson.spaceIds.includes(spaceId));
}

/** Used later to offer directions from the original classroom to its actual room. */
export function getRelocatedLessonsFromSpace(spaceId: string, data: Catalog = catalog): Lesson[] {
  const classIds = new Set(data.classes.filter(item => item.homeSpaceIds.includes(spaceId)).map(item => item.id));
  return getPublicLessons(data).filter(lesson => classIds.has(lesson.classId) && !lesson.spaceIds.includes(spaceId));
}

/** null means missing material; callers show createPdfPlaceholder, never fetch a fallback. */
export function getLessonPlan(lesson: Lesson, data: Catalog = catalog): LessonPlan | null {
  return data.lessonPlans.find(plan => plan.id === lesson.lessonPlanId) ?? null;
}
