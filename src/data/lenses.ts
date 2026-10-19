import type { Lens } from './catalog';

/** [모델 3] 교실의 특성을 반영하는 수업 실행 렌즈 — user-provided wording. */
export const lensDescriptions: Record<Lens, { summary: string; question: string }> = {
  발견: { summary: '학생을 새롭게 보기', question: '무엇을 알고 있고, 어디서 막히는가?' },
  참여: { summary: '활동에 들어오게 하기', question: '활동 밖에 머무는 학생은 없는가?' },
  강점: { summary: '가진 것을 배움에 쓰기', question: '학생의 언어·경험이 배움에 기여하는가?' },
  협력: { summary: '서로 다른 강점 연결하기', question: '역할과 강점이 실제 협력으로 이어지는가?' },
  표현: { summary: '생각을 여러 방식으로 드러내기', question: '말·글·그림·몸짓·모국어로 표현할 수 있는가?' },
};
