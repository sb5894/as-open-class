import { catalog, getPublicLessons, type Lesson } from '../data/catalog';
import { el } from './ui';

/** Grade-group wording from the supplied workbook; separate lessons keep their own content. */
function focusGroups() {
  const groups = new Map<string, Set<number>>();
  for (const lesson of getPublicLessons()) {
    const grade = catalog.classes.find(item => item.id === lesson.classId)?.grade;
    if (grade && lesson.gradeTheme) {
      const grades = groups.get(lesson.gradeTheme) ?? new Set<number>();
      grades.add(grade); groups.set(lesson.gradeTheme, grades);
    }
  }
  return [...groups].map(([text, values]) => {
    const grades = [...values].sort((a, b) => a - b);
    return { text, grades, label: `${grades[0]}~${grades[grades.length - 1]}학년` };
  });
}

export function createGradeFocus() {
  const section = el('section', undefined, 'card grade-focus');
  section.append(el('h2', '공개수업 학년별 중점'));
  const table = el('table');
  const head = el('thead'), row = el('tr');
  for (const text of ['학년', '중점']) { const cell = el('th', text); cell.scope = 'col'; row.append(cell); }
  head.append(row); const body = el('tbody');
  for (const group of focusGroups()) {
    const entry = el('tr'), label = el('th', group.label); label.scope = 'row';
    entry.append(label, el('td', group.text)); body.append(entry);
  }
  table.append(head, body); section.append(table); return section;
}

export function createLessonGradeFocus(lesson: Lesson) {
  const grade = catalog.classes.find(item => item.id === lesson.classId)?.grade;
  const group = focusGroups().find(item => grade && item.grades.includes(grade));
  return group ? el('p', `${group.label} 중점: ${group.text}`, 'note lesson-grade-focus') : null;
}
