import { el } from './ui';

/** Model 2 wording and images provided by the school on 2026-10-20. */
export function createModelTwo() {
  const section = el('section', undefined, 'card model-two');
  section.append(el('h2', '만남·배움·어울림이란?'), el('p', '모델 2 | 상호문화를 잇는 교육과정 설계', 'note'));
  for (const [name, asset, summary, observation] of [
    ['만남', 'meeting', '차이를 알아차리고 관계 시작', '낯선 언어·문화에 관심을 갖고 질문하기'],
    ['배움', 'learning', '서로의 언어·경험으로 이해 넓히기', '비교·탐구하며 경험을 배움에 활용하기'],
    ['어울림', 'together', '서로의 강점을 연결해 함께 만들기', '역할을 나누고 공동의 결과 만들기'],
  ]) {
    const step = el('article', undefined, 'model-two-step'); step.setAttribute('aria-label', name);
    const image = el('img'); image.src = `/assets/model2/${asset}.png`; image.alt = name; image.loading = 'lazy'; image.width = 183; image.height = 110;
    const description = el('dl');
    description.append(el('dt', '한눈에 보면'), el('dd', summary), el('dt', '참관자가 볼 장면'), el('dd', observation));
    step.append(image, description); section.append(step);
  }
  return section;
}
