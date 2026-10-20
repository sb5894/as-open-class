import lessons from './data/registration-lessons.generated.json' with { type: 'json' };

export interface InterestOption {
  id: string;
  label: string;
  lessonIds: string[];
}

const special = new Set(['lesson-1-3', 'lesson-5-1', 'lesson-4-5', 'lesson-6-1']);
const individual = (id: string, label: string): InterestOption => ({ id, label, lessonIds: [id] });

/** Shared by the form and server. A grade selection is one interest, not individual class bookings. */
export const interestOptions: InterestOption[] = [
  individual('lesson-1-3', '수석교사 · 1-3'),
  ...Array.from({ length: 6 }, (_, index) => {
    const grade = index + 1;
    return {
      id: `grade-${grade}`,
      label: `${grade}학년`,
      lessonIds: lessons.filter(lesson => lesson.id.startsWith(`lesson-${grade}-`) && !special.has(lesson.id)).map(lesson => lesson.id),
    };
  }),
  individual('lesson-multicultural-red', '다문화특별학급 1반 (빨강)'),
  individual('lesson-multicultural-green', '다문화특별학급 2반 (초록)'),
  individual('lesson-multicultural-blue', '다문화특별학급 3반 (파랑)'),
  individual('lesson-5-1', '5-1 도덕'),
  individual('lesson-4-5', '과학 전담 · 4-5'),
  individual('lesson-6-1', '영어 전담 · 6-1'),
  individual('lesson-kindergarten-joint', '유치원'),
];
