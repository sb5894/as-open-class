import type { RegistrationInput, RegistrationResponse } from "../../functions/src/contract.js";

export type SubmissionState = {
  phase: "idle" | "submitting" | "saved" | "error";
  input: RegistrationInput | null;
  response: RegistrationResponse | null;
};

const uncertain: RegistrationResponse = {
  ok: false, code: "SAVE_NOT_CONFIRMED", retryable: true,
  message: "저장 완료를 확인하지 못했습니다. 입력 내용을 유지한 채 다시 시도해 주세요. 재시도 시 중복 신청될 수 있습니다.",
};

function isResponse(value: unknown): value is RegistrationResponse {
  if (!value || typeof value !== "object") return false;
  const body = value as Record<string, unknown>;
  if (body.ok === true) {
    return body.status === "saved" && typeof body.registrationId === "string" && !!body.registrationId
      && typeof body.submittedAt === "string" && !Number.isNaN(Date.parse(body.submittedAt));
  }
  return body.ok === false && typeof body.code === "string" && typeof body.message === "string" && typeof body.retryable === "boolean";
}

/** UI step 4 binds button.disabled to phase==='submitting'. No automatic retry. */
export function createRegistrationSubmission(
  onChange: (state: SubmissionState) => void = () => {},
  fetcher: typeof fetch = fetch,
) {
  let state: SubmissionState = { phase: "idle", input: null, response: null };
  function update(next: SubmissionState) {
    state = next;
    onChange(structuredClone(state));
  }
  return {
    getState: () => structuredClone(state),
    async submit(input: RegistrationInput): Promise<RegistrationResponse | null> {
      if (state.phase === "submitting") return null;
      const snapshot = structuredClone(input);
      update({ phase: "submitting", input: snapshot, response: null });
      let result: RegistrationResponse;
      try {
        const response = await fetcher("/api/registrations", {
          method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(snapshot),
        });
        const body: unknown = await response.json();
        result = isResponse(body) && ((response.status === 201 && body.ok) || (!response.ok && !body.ok)) ? body : uncertain;
      } catch {
        result = uncertain;
      }
      update({ phase: result.ok ? "saved" : "error", input: snapshot, response: result });
      return result;
    },
  };
}
