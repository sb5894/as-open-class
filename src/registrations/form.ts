import { getPublicLessons } from '../data/catalog';
import { createMaterialText } from '../components/placeholders';
import { el, link } from '../components/ui';
import { interestOptions } from '../../functions/src/interest-options';
import { createRegistrationSubmission } from './client';
import { createEventSchedule } from '../components/event-schedule';

export function mountRegistration(main: HTMLElement) {
  main.append(el('h1', '참관 신청'), el('p', '신청 기한: 2026. 10. 28.(수) 16:00까지', 'note registration-deadline'), createEventSchedule());
  const form = el('form', undefined, 'card');
  form.noValidate = true;
  const fields = el('fieldset'); fields.append(el('legend', '신청자 정보'));
  const inputs: Record<string, HTMLInputElement> = {};
  const errors: Record<string, HTMLParagraphElement> = {};
  for (const [key, label, max, hint] of [['city', '지역(시)', 80, '예: 안성시'], ['school', '소속교', 120, '예: 안성초등학교'], ['assignment', '직위', 120, '예: 교사, 교감, 교장, 장학사 등'], ['name', '성함', 80, '신청자 성함']] as const) {
    const wrapper = el('div', undefined, 'field');
    const labelNode = el('label', label); labelNode.htmlFor = `registration-${key}`;
    const input = el('input'); input.name = key; input.required = true; input.maxLength = max; input.placeholder = hint;
    input.id = labelNode.htmlFor;
    input.autocomplete = key === 'name' ? 'name' : 'off'; input.pattern = '.*\\S.*';
    const error = el('p', undefined, 'error field-error'); error.id = `${input.id}-error`; error.hidden = true;
    inputs[key] = input; errors[key] = error; wrapper.append(labelNode, input, error); fields.append(wrapper);
    input.addEventListener('input', () => {
      if (input.hasAttribute('aria-invalid')) setFieldError(key, fieldError(input));
    });
  }
  function fieldError(input: HTMLInputElement) {
    if (!input.value.trim()) return '필수 입력 항목입니다. 내용을 입력해 주세요.';
    if (input.value.trim().length > input.maxLength || /[\u0000-\u001f\u007f]/.test(input.value)) return `1~${input.maxLength}자의 한 줄 텍스트를 입력해 주세요.`;
    return '';
  }
  function setFieldError(key: string, message: string) {
    const input = inputs[key]; const error = errors[key];
    error.textContent = message; error.hidden = !message;
    if (message) { input.setAttribute('aria-invalid', 'true'); input.setAttribute('aria-describedby', error.id); }
    else { input.removeAttribute('aria-invalid'); input.removeAttribute('aria-describedby'); }
  }
  function focusFirstError() {
    const input = form.querySelector<HTMLElement>('[aria-invalid="true"]');
    if (!input) return false;
    input.focus({ preventScroll: true }); input.scrollIntoView({ block: 'center' }); return true;
  }
  const choices = el('fieldset', undefined, 'registration-preferences'); choices.append(el('legend', '관심있는 수업 (선택, 최대 2개)'));
  const help = el('p', '수요조사를 위한 문항이며, 공개보고회에서는 전체 수업을 자유롭게 참관 가능합니다.', 'note preference-help');
  help.id = 'preference-help'; choices.setAttribute('aria-describedby', help.id); choices.append(help);
  const count = el('p', '선택 0 / 2', 'note'); count.id = 'preference-count'; count.setAttribute('aria-live', 'polite'); choices.append(count);
  const disclosure = el('details', undefined, 'preference-disclosure');
  const toggle = el('summary', '수업 목록 보기 · 선택 0/2');
  const selectionSummary = el('p', '선택한 수업: 없음', 'note'); selectionSummary.setAttribute('aria-live', 'polite');
  disclosure.append(toggle); choices.append(selectionSummary, disclosure);
  const checks: HTMLInputElement[] = [];
  const lessons = getPublicLessons();
  // Presentation changes keep the deployed API's stable interest IDs intact.
  const displayedOptions = interestOptions.filter(option => option.id !== 'lesson-1-3')
    .map(option => option.id === 'lesson-5-1' ? { ...option, label: '도덕 전담 · 5-1' } : option);
  const senior = interestOptions.find(option => option.id === 'lesson-1-3');
  if (senior) displayedOptions.splice(displayedOptions.findIndex(option => option.id === 'lesson-multicultural-blue') + 1, 0, senior);
  for (const option of displayedOptions) {
    const label = el('label', undefined, 'lesson-choice');
    const input = el('input'); input.type = 'checkbox'; input.name = 'lessonIds'; input.value = option.id; input.setAttribute('aria-describedby', count.id); checks.push(input);
    const topics = [...new Set(lessons.filter(lesson => option.lessonIds.includes(lesson.id)).map(lesson => lesson.topic).filter((topic): topic is string => !!topic))];
    const text = el('span'); text.append(el('strong', option.label), createMaterialText(topics.length ? topics.join(' / ') : null));
    label.append(input, text); disclosure.append(label);
  }
  const additional = el('fieldset', undefined, 'registration-additional'); additional.append(el('legend', '문의 및 개인정보 동의'));
  const questionField = el('div', undefined, 'field');
  const questionLabel = el('label', '연구학교 운영과 관련하여 궁금한 점이 있으신가요? (선택, 최대 2,000자)');
  const question = el('textarea'); question.id = 'registration-question'; question.name = 'question'; question.maxLength = 2000; question.rows = 4;
  questionLabel.htmlFor = question.id;
  const questionError = el('p', undefined, 'error field-error'); questionError.id = `${question.id}-error`; questionError.hidden = true;
  questionField.append(questionLabel, question, questionError);
  const privacy = el('details', undefined, 'privacy-disclosure');
  privacy.append(el('summary', '개인정보 수집·이용'));
  privacy.append(el('p', '‘안성초 정책연구학교 공개보고회’ 운영을 위해 신청자의 소속과 직위, 성명 등을 수집하고자 합니다. 개인정보 수집 및 이용에 동의하십니까?'));
  const privacyItems = el('ul');
  for (const [title, value] of [
    ['수집·이용 목적', '2026년 안성초 다문화 정책연구학교 공개보고회 운영'],
    ['수집 항목', '지역, 소속, 직위, 성명, 문의 내용(선택)'],
    ['보유·이용 기간', '2026. 11. 11.(수)까지'],
    ['동의 거부권 및 불이익', '동의를 거부할 수 있으며, 동의하지 않으면 참관 신청을 제출할 수 없습니다.'],
  ]) {
    const item = el('li'); item.append(el('strong', `${title}: ${value}`)); privacyItems.append(item);
  }
  privacy.append(privacyItems);
  const consentLabel = el('label', undefined, 'privacy-consent');
  const consent = el('input'); consent.type = 'checkbox'; consent.id = 'registration-consent'; consent.name = 'consent'; consent.required = true;
  consentLabel.append(consent, el('span', '개인정보 수집·이용에 동의합니다. (필수)'));
  const consentError = el('p', undefined, 'error field-error'); consentError.id = `${consent.id}-error`; consentError.hidden = true;
  additional.append(questionField, privacy, consentLabel, consentError);
  function setAdditionalError(key: 'question' | 'consent', message: string) {
    const input = key === 'question' ? question : consent;
    const error = key === 'question' ? questionError : consentError;
    error.textContent = message; error.hidden = !message;
    if (message) { input.setAttribute('aria-invalid', 'true'); input.setAttribute('aria-describedby', error.id); }
    else { input.removeAttribute('aria-invalid'); input.removeAttribute('aria-describedby'); }
  }
  function questionErrorMessage() {
    return question.value.length > question.maxLength || /[\u0000-\u0008\u000b\u000c\u000e-\u001f\u007f-\u009f]/.test(question.value) ? '2,000자 이내의 문의 내용을 입력해 주세요.' : '';
  }
  question.addEventListener('input', () => { if (question.hasAttribute('aria-invalid')) setAdditionalError('question', questionErrorMessage()); });
  consent.addEventListener('change', () => { if (consent.hasAttribute('aria-invalid')) setAdditionalError('consent', consent.checked ? '' : '개인정보 수집·이용에 동의해야 신청할 수 있습니다.'); });
  const status = el('div', undefined, 'submission-status'); status.setAttribute('role', 'status'); status.tabIndex = -1;
  const submit = el('button', '신청 제출'); submit.type = 'submit';
  const submission = createRegistrationSubmission(state => {
    const busy = state.phase === 'submitting';
    fields.disabled = busy || state.phase === 'saved'; choices.disabled = busy || state.phase === 'saved';
    additional.disabled = busy || state.phase === 'saved';
    submit.disabled = busy || state.phase === 'saved';
    submit.textContent = busy ? '저장 중…' : state.phase === 'error' ? '다시 제출' : '신청 제출';
    form.setAttribute('aria-busy', String(busy)); status.replaceChildren();
    if (busy) status.append(el('p', '신청을 저장하고 있습니다.'));
    else if (state.response?.ok) {
      const title=el('h1','신청이 완료되었습니다.');
      const thanks=el('p',undefined,'note');
      thanks.append(el('small','안성초 공개보고회에 관심을 가져주셔서 감사합니다.'));
      const actions=el('div',undefined,'actions');
      actions.append(link('메인 화면','/','button secondary'),link('보고회 둘러보기','/guide'));
      status.className='card submission-status';
      status.append(title,thanks,actions);
      main.replaceChildren(status); status.focus();
    } else if (state.response) {
      status.append(el('p', state.response.message, 'error'));
      for (const [key, message] of Object.entries(state.response.fieldErrors ?? {})) {
        if (inputs[key]) setFieldError(key, message);
        else if (key === 'question' || key === 'consent') setAdditionalError(key, message);
        else status.append(el('p', message, 'error'));
      }
      if (!focusFirstError()) status.focus();
    }
  });
  checks.forEach(input => input.addEventListener('change', () => {
    const selected = checks.filter(item => item.checked).length;
    count.textContent = `선택 ${selected} / 2${selected === 2 ? ' — 최대 2개까지 선택할 수 있어요. 바꾸려면 선택한 수업을 먼저 해제하세요.' : ''}`;
    updateDisclosure();
    selectionSummary.textContent = selected ? `선택한 수업: ${displayedOptions.filter(option => checks.some(item => item.checked && item.value === option.id)).map(option => option.label).join(' / ')}` : '선택한 수업: 없음';
    checks.forEach(item => { item.disabled = selected >= 2 && !item.checked; });
  }));
  function updateDisclosure() {
    toggle.textContent = `${disclosure.open ? '수업 목록 접기' : '수업 목록 보기'} · 선택 ${checks.filter(item => item.checked).length}/2`;
  }
  disclosure.addEventListener('toggle', updateDisclosure);
  const orderedInputs = Object.values(inputs);
  orderedInputs.forEach((input, index) => {
    input.enterKeyHint = 'next';
    input.addEventListener('keydown', event => {
      if (event.key !== 'Enter' && event.code !== 'NumpadEnter') return;
      event.preventDefault();
      if (event.isComposing || event.keyCode === 229) return;
      (orderedInputs[index + 1] ?? toggle).focus();
    });
  });
  form.addEventListener('submit', event => {
    event.preventDefault();
    if (submission.getState().phase === 'submitting' || submission.getState().phase === 'saved') return;
    Object.entries(inputs).forEach(([key, input]) => setFieldError(key, fieldError(input)));
    setAdditionalError('question', questionErrorMessage());
    setAdditionalError('consent', consent.checked ? '' : '개인정보 수집·이용에 동의해야 신청할 수 있습니다.');
    if (focusFirstError()) {
      status.replaceChildren(el('p', '입력 내용을 확인해 주세요.', 'error')); return;
    }
    const lessonIds = checks.filter(item => item.checked).map(item => item.value);
    if (lessonIds.length > 2) {
      status.replaceChildren(el('p', '관심있는 수업은 최대 2개까지 선택해 주세요.', 'error')); status.focus(); return;
    }
    void submission.submit({ city: inputs.city.value, school: inputs.school.value, assignment: inputs.assignment.value, name: inputs.name.value, lessonIds, question: question.value, consent: true });
  });
  form.append(fields, choices, additional, status, submit); main.append(form);
}

