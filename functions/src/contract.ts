export interface RegistrationInput {
  city: string;
  school: string;
  assignment: string;
  name: string;
  /** Optional interest: up to two grade/special option IDs. Legacy public lesson IDs remain valid. */
  lessonIds: string[];
  consent: boolean;
  question?: string;
  /** Only marks the row; test submissions still write to the actual sheet. */
  isTest?: boolean;
}

export type RegistrationField = keyof RegistrationInput;
export type RegistrationResponse = {
  ok: true;
  status: "saved";
  registrationId: string;
  submittedAt: string;
} | {
  ok: false;
  code: "INVALID_INPUT" | "NOT_CONFIGURED" | "SAVE_NOT_CONFIRMED" | "METHOD_NOT_ALLOWED" | "NOT_FOUND" | "UNSUPPORTED_MEDIA_TYPE" | "PAYLOAD_TOO_LARGE";
  message: string;
  fieldErrors?: Partial<Record<RegistrationField, string>>;
  retryable: boolean;
};
