import { randomUUID } from "node:crypto";
import lessons from "./data/registration-lessons.generated.json" with { type: "json" };
import type { RegistrationField, RegistrationInput, RegistrationResponse } from "./contract.js";
import { interestOptions } from './interest-options.js';

export const publicLessons: ReadonlyArray<{ id: string; label: string }> = lessons;
// Legacy class IDs stay valid; new grade IDs are stored without expanding a grade into class choices.
const lessonLabels = new Map([...publicLessons, ...interestOptions.filter(option => option.id.startsWith('grade-'))].map(lesson => [lesson.id, lesson.label]));
const orderedIds = [...new Set([...interestOptions.map(option => option.id), ...publicLessons.map(lesson => lesson.id)])];
const textLimits = { city: 80, school: 120, assignment: 120, name: 80 } as const;

export function validateRegistration(body: unknown):
  { valid: true; value: RegistrationInput } |
  { valid: false; fieldErrors: Partial<Record<RegistrationField, string>> } {
  const fieldErrors: Partial<Record<RegistrationField, string>> = {};
  const value: RegistrationInput = { city: "", school: "", assignment: "", name: "", lessonIds: [], consent: false, question: "" };
  const input = body !== null && typeof body === "object" && !Array.isArray(body)
    ? body as Record<string, unknown> : {};
  for (const [key, limit] of Object.entries(textLimits) as [keyof typeof textLimits, number][]) {
    const raw = input[key];
    if (typeof raw !== "string" || !raw.trim() || raw.trim().length > limit || /[\u0000-\u001f\u007f]/.test(raw)) {
      fieldErrors[key] = `1~${limit}자의 한 줄 텍스트를 입력해 주세요.`;
    } else {
      value[key] = raw.trim();
    }
  }
  if (input.consent !== true) {
    fieldErrors.consent = "개인정보 수집·이용에 동의해 주세요.";
  } else {
    value.consent = true;
  }
  const question = input.question === undefined ? "" : input.question;
  if (typeof question !== "string" || question.length > 2000 || /[\u0000-\u0008\u000b\u000c\u000e-\u001f\u007f-\u009f]/.test(question)) {
    fieldErrors.question = "문의 내용은 2000자 이내로 입력해 주세요.";
  } else {
    value.question = question;
  }
  const ids = input.lessonIds;
  if (!Array.isArray(ids) || ids.length > 2
      || ids.some(id => typeof id !== "string" || !lessonLabels.has(id))
      || new Set(ids).size !== ids.length) {
    fieldErrors.lessonIds = "관심있는 수업은 선택하지 않거나, 서로 다른 선택지를 최대 2개까지 선택해 주세요.";
  } else {
    value.lessonIds = ids as string[];
  }
  if (input.isTest !== undefined && typeof input.isTest !== "boolean") {
    fieldErrors.isTest = "시험 신청 구분 값이 올바르지 않습니다.";
  } else {
    value.isTest = input.isTest === true;
  }
  return Object.keys(fieldErrors).length ? { valid: false, fieldErrors } : { valid: true, value };
}

export interface RegistrationRecord extends RegistrationInput {
  registrationId: string;
  submittedAt: string;
}

/** Must match the A:K header order documented in docs/신청 저장 연결.md. */
export function registrationRow(record: RegistrationRecord): string[] {
  // Preference order has no rank; normalize by the canonical public lesson order.
  const selected = orderedIds.filter(id => record.lessonIds.includes(id));
  const parts = Object.fromEntries(new Intl.DateTimeFormat('sv-SE', {
    timeZone: 'Asia/Seoul', year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit', hourCycle: 'h23',
  }).formatToParts(new Date(record.submittedAt)).map(part=>[part.type,part.value]));
  const submittedAt = `${parts.year}-${parts.month}-${parts.day} ${parts.hour}:${parts.minute}`;
  return [submittedAt, record.registrationId, record.isTest ? "시험" : "실제", record.city,
    record.school, record.assignment, record.name, selected.join(" / "),
    selected.map(id => lessonLabels.get(id)!.split(' · ')[0]).join(" / "), record.consent ? "동의" : "", record.question ?? ""];
}

export interface ApiRequest { method: string; path: string; contentType: string; body: unknown; bodyBytes: number }
export interface ApiResult { status: number; body: RegistrationResponse; headers?: Record<string, string> }
export interface RegistrationDependencies {
  isConfigured: () => boolean;
  append: (record: RegistrationRecord) => Promise<void>;
  now?: () => Date;
  id?: () => string;
  /** Receives only a fixed event name and opaque ID, never an exception or input. */
  logFailure?: (event: string, registrationId: string) => void;
}

export function createRegistrationApi(deps: RegistrationDependencies) {
  return async (request: ApiRequest): Promise<ApiResult> => {
    if (request.path !== "/api/registrations" && request.path !== "/") {
      return { status: 404, body: { ok: false, code: "NOT_FOUND", message: "요청한 주소를 찾을 수 없습니다.", retryable: false } };
    }
    if (request.method !== "POST") {
      return { status: 405, headers: { Allow: "POST" }, body: { ok: false, code: "METHOD_NOT_ALLOWED", message: "POST 요청만 지원합니다.", retryable: false } };
    }
    if (request.bodyBytes > 8192) {
      return { status: 413, body: { ok: false, code: "PAYLOAD_TOO_LARGE", message: "입력 내용이 너무 깁니다.", retryable: false } };
    }
    if (request.contentType.split(";")[0].trim().toLowerCase() !== "application/json") {
      return { status: 415, body: { ok: false, code: "UNSUPPORTED_MEDIA_TYPE", message: "JSON 형식으로 제출해 주세요.", retryable: false } };
    }
    const validation = validateRegistration(request.body);
    if (!validation.valid) {
      return { status: 400, body: { ok: false, code: "INVALID_INPUT", message: "입력 내용을 확인해 주세요.", fieldErrors: validation.fieldErrors, retryable: false } };
    }
    if (!deps.isConfigured()) {
      return { status: 503, body: { ok: false, code: "NOT_CONFIGURED", message: "신청 접수 연결을 준비 중입니다. 잠시 후 다시 시도해 주세요.", retryable: true } };
    }
    const record: RegistrationRecord = { ...validation.value, registrationId: (deps.id ?? randomUUID)(), submittedAt: (deps.now ?? (() => new Date()))().toISOString() };
    try {
      await deps.append(record);
    } catch {
      deps.logFailure?.("registration_save_not_confirmed", record.registrationId);
      return { status: 503, body: { ok: false, code: "SAVE_NOT_CONFIRMED", message: "저장 완료를 확인하지 못했습니다. 입력 내용을 유지한 채 다시 시도해 주세요. 재시도 시 중복 신청될 수 있으며 담당자가 정리합니다.", retryable: true } };
    }
    return { status: 201, body: { ok: true, status: "saved", registrationId: record.registrationId, submittedAt: record.submittedAt } };
  };
}
