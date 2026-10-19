import { el } from './ui';

/** Confirmed schedule from 1차피드백(1019).pdf. Shared by home and registration. */
export function createEventSchedule() {
  const section = el('section', undefined, 'card event-schedule');
  section.append(el('h2', '공개보고회 일정'));
  const table = el('table');
  const caption = el('caption', '2026년 11월 11일 공개보고회 일정');
  const head = el('thead');
  const headings = el('tr');
  for (const title of ['구분', '시간', '주요 내용', '장소']) {
    const cell = el('th', title); cell.scope = 'col'; headings.append(cell);
  }
  head.append(headings);
  const body = el('tbody');
  const rows = [
    ['등록', '12:50~13:10', '참관자 등록 및 안내자료 배부', '본관 1층 중앙현관'],
    ['1부\n(수업공개)', '13:10~13:50', '언어·문화적 다양성을 배움으로 잇는 교과 수업 공개', '각 교실 및 특별학급'],
    ['2부\n(성과나눔 및 자유관람)', '14:00~14:40', '상호문화적 이중언어교육 운영 모델 및 실천 성과 공유', '본관 4층 시청각실'],
    ['', '14:50~15:30', '공개수업 및 연구학교 운영 관련 협의', '본관 4층 지정 장소'],
    ['', '15:30~16:00', '학생맞춤형 지원 및 학년별 교육과정 실천 사례 관람', '본관 4층 소모임실 및 복도'],
  ];
  rows.forEach(([phase, time, content, venue], index) => {
    const row = el('tr');
    if (phase) {
      const cell = el('th', phase); cell.scope = index === 2 ? 'rowgroup' : 'row';
      if (index === 2) cell.rowSpan = 3;
      row.append(cell);
    }
    const timeCell = el('td', undefined, 'schedule-time');
    const [start, end] = time.split('~');
    timeCell.append(el('span', `${start}~`), el('wbr'), el('span', end));
    row.append(timeCell, el('td', content), el('td', venue)); body.append(row);
  });
  table.append(caption, head, body); section.append(table);
  return section;
}
