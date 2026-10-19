import { describe, expect, it, vi } from "vitest";
import { catalog, getPublicLessons } from "../src/data/catalog";
import { createRegistrationApi, publicLessons, registrationRow, validateRegistration, type ApiRequest, type RegistrationRecord } from "../functions/src/registrations";
import { appendRegistration, readSheetsConfig, sheetRange, type AppendRequest } from "../functions/src/sheets";
import { interestOptions } from '../functions/src/interest-options';

const valid = { city: "안성시", school: "시험학교", assignment: "교사", name: "시험교사", lessonIds: ["lesson-3-1"], isTest: true, consent: true, question: "" };
const req = (body: unknown = valid): ApiRequest => ({ method: "POST", path: "/api/registrations", contentType: "application/json; charset=utf-8", body, bodyBytes: 300 });
const record: RegistrationRecord = { ...valid, registrationId: "test-uuid", submittedAt: "2026-10-16T00:00:00.000Z" };
const config = { spreadsheetId: "test_sheet_id", tabName: "시험'신청" };
const ack = { data: { spreadsheetId: config.spreadsheetId, updates: { updatedRows: 1, updatedCells: 11, updatedRange: "'시험''신청'!A2:K2" } } };

describe("registration validation uses the converted public lessons", () => {
  it('omits locations from sheet preferences while retaining class and subject names', () => {
    for (const [id, label] of [['lesson-1-1', '1-1'], ['lesson-1-3', '1-3 수석교사 일반'], ['lesson-3-1', '3-1 과학'], ['lesson-4-5', '4-5 과학'], ['lesson-6-1', '6-1 영어'], ['grade-3', '3학년']]) {
      const row = registrationRow({ ...record, lessonIds: [id] });
      expect(row[7]).toBe(id);
      expect(row[8]).toBe(label);
    }
    for (const lesson of publicLessons) expect(registrationRow({ ...record, lessonIds: [lesson.id] })[8]).not.toMatch(/ · |[본후신]관|\d층/);
  });
  it.each([undefined, false, "true", 1, null])("requires explicit boolean consent: %s", consent => {
    const result = validateRegistration({ ...valid, consent });
    expect(result.valid).toBe(false);
    if (!result.valid) expect(result.fieldErrors.consent).toBeTruthy();
  });

  it("accepts optional multiline questions and preserves literal text", () => {
    for (const question of [undefined, "", "수업 문의\n둘째 줄\r\n탭\t내용", "가".repeat(2000), '=HYPERLINK("x")']) {
      const result = validateRegistration({ ...valid, question });
      expect(result.valid).toBe(true);
      if (result.valid) expect(result.value.question).toBe(question ?? "");
    }
  });

  it.each([null, 123, [], "가".repeat(2001), "문자\u0000", "문자\u000b", "문자\u001b", "문자\u007f", "문자\u0085"])("rejects invalid question %j", question => {
    const result = validateRegistration({ ...valid, question });
    expect(result.valid).toBe(false);
    if (!result.valid) expect(result.fieldErrors.question).toBeTruthy();
  });
  it('groups every public lesson once, keeping senior and subject teachers outside grades', () => {
    expect(interestOptions.map(option => option.label).slice(0, 7)).toEqual(['수석교사 · 1-3', '1학년', '2학년', '3학년', '4학년', '5학년', '6학년']);
    const ids = interestOptions.flatMap(option => option.lessonIds);
    expect(ids).toHaveLength(28);
    expect(new Set(ids).size).toBe(28);
    expect([...ids].sort()).toEqual(publicLessons.map(lesson => lesson.id).sort());
    expect(interestOptions.find(option => option.id === 'grade-1')!.lessonIds).toEqual(['lesson-1-1', 'lesson-1-2']);
    expect(interestOptions.find(option => option.id === 'grade-5')!.lessonIds).not.toContain('lesson-5-1');
    for (const id of ['lesson-3-1', 'lesson-4-5', 'lesson-6-1']) {
      expect(interestOptions.findIndex(option => option.id === id)).toBeGreaterThan(6);
      expect(interestOptions.filter(option => option.id.startsWith('grade-')).flatMap(option => option.lessonIds)).not.toContain(id);
    }
  });

  it('validates and stores grade interests as selected, without expanding into class-level choices', () => {
    for (const option of interestOptions) expect(validateRegistration({ ...valid, lessonIds: [option.id] }).valid).toBe(true);
    const row = registrationRow({ ...record, lessonIds: ['grade-6', 'grade-2'] });
    expect(row.slice(7, 9)).toEqual(['grade-2 / grade-6', '2학년 / 6학년']);
    for (const lessonIds of [['grade-7'], ['grade-1', 'grade-1'], ['grade-1', 'grade-2', 'grade-3']]) expect(validateRegistration({ ...valid, lessonIds }).valid).toBe(false);
    expect(registrationRow({ ...record, lessonIds: ['grade-4', 'lesson-1-3'] })[7]).toBe('lesson-1-3 / grade-4');
  });
  it("matches the guide list including special and multicultural lessons, excluding kindergarten", () => {
    expect(publicLessons.map(item => item.id)).toEqual(getPublicLessons(catalog).map(item => item.id));
    expect(publicLessons).toHaveLength(28);
    for (const id of ["lesson-1-3", "lesson-3-1", "lesson-4-5", "lesson-6-1", "lesson-multicultural-red"]) {
      expect(validateRegistration({ ...valid, lessonIds: [id] }).valid).toBe(true);
    }
    expect(interestOptions.some(option=>option.id==='lesson-kindergarten-joint')).toBe(false);
    expect(validateRegistration({ ...valid, lessonIds:['lesson-kindergarten-joint'] }).valid).toBe(false);
  });

  it.each(["city", "school", "assignment", "name"])("rejects missing, blank and non-text %s", key => {
    for (const value of [undefined, " ", null, 1, [], "a".repeat(121), "잘못된\n입력"]) {
      const result = validateRegistration({ ...valid, [key]: value });
      expect(result.valid).toBe(false);
      if (!result.valid) expect(result.fieldErrors[key as keyof typeof result.fieldErrors]).toBeTruthy();
    }
  });

  it.each([undefined, ["lesson-1-1", "lesson-1-2", "lesson-1-3"], ["lesson-3-1", "lesson-3-1"],
    ["lesson-5-1"], ["korean-instructor-1"], ["unknown"], [5], "lesson-3-1", null].map(lessonIds => ({ lessonIds })))("rejects invalid preference input $lessonIds", ({ lessonIds }) => {
    expect(validateRegistration({ ...valid, lessonIds }).valid).toBe(false);
  });

  it.each([[], ["lesson-3-1"], ["lesson-3-1", "lesson-4-5"]].map(lessonIds => ({ lessonIds })))("accepts zero, one or two preferences $lessonIds", ({ lessonIds }) => {
    const result = validateRegistration({ ...valid, lessonIds });
    expect(result.valid).toBe(true);
    if (result.valid) expect(result.value.lessonIds).toEqual(lessonIds);
  });

  it("trims fields and accepts one or two distinct lessons without changing literal formula text", () => {
    const result = validateRegistration({ ...valid, city: " 안성시 ", name: '=HYPERLINK("x")', lessonIds: ["lesson-3-1", "lesson-4-5"] });
    expect(result.valid).toBe(true);
    if (result.valid) {
      expect(result.value.city).toBe("안성시");
      expect(result.value.name).toBe('=HYPERLINK("x")');
    }
    expect(validateRegistration(null).valid).toBe(false);
    expect(validateRegistration({ ...valid, isTest: "true" }).valid).toBe(false);
  });
});

describe("API response reflects storage, never a mock fallback", () => {
  it('writes Korea-local date and minute without seconds, preserving the original columns and appending consent and question', () => {
    const row=registrationRow({...record,submittedAt:'2026-10-18T15:03:59.999Z'});
    expect(row[0]).toBe('2026-10-19 00:03');
    expect(row).toHaveLength(11);
    expect(row[1]).toBe(record.registrationId);
  });
  it("saves a registration with no preferences and leaves H:I empty in an eleven-cell row", async () => {
    const append = vi.fn(async (saved: RegistrationRecord) => {
      const row = registrationRow(saved);
      expect(row).toHaveLength(11);
      expect(row.slice(7, 9)).toEqual(["", ""]);
      expect(row[6]).toBe(valid.name);
    });
    const api = createRegistrationApi({ isConfigured: () => true, append });
    expect(await api(req({ ...valid, lessonIds: [] }))).toMatchObject({ status: 201, body: { ok: true, status: "saved" } });
    expect(append).toHaveBeenCalledOnce();
    expect(append.mock.calls[0][0].lessonIds).toEqual([]);
  });
  it("waits for storage confirmation before returning 201", async () => {
    let finish!: () => void;
    const append = vi.fn(() => new Promise<void>(resolve => { finish = resolve; }));
    const api = createRegistrationApi({ isConfigured: () => true, append, id: () => "receipt", now: () => new Date(record.submittedAt) });
    let settled = false;
    const pending = api(req()).then(value => { settled = true; return value; });
    await Promise.resolve();
    expect(append).toHaveBeenCalledOnce();
    expect(settled).toBe(false);
    finish();
    expect(await pending).toEqual({ status: 201, body: { ok: true, status: "saved", registrationId: "receipt", submittedAt: record.submittedAt } });
  });

  it("stores repeated submissions as separate rows with new receipt IDs", async () => {
    const append = vi.fn(async () => {});
    const api = createRegistrationApi({ isConfigured: () => true, append });
    expect((await api(req())).status).toBe(201);
    expect((await api(req())).status).toBe(201);
    expect(append).toHaveBeenCalledTimes(2);
    expect(append.mock.calls[0][0].registrationId).not.toBe(append.mock.calls[1][0].registrationId);
  });

  it("rejects invalid input without attempting storage", async () => {
    const append = vi.fn(async () => {});
    const api = createRegistrationApi({ isConfigured: () => true, append });
    expect((await api(req({ ...valid, lessonIds: ["lesson-5-1"] }))).status).toBe(400);
    expect(append).not.toHaveBeenCalled();
  });

  it("never stores an unconsented registration", async () => {
    const append = vi.fn(async () => {});
    const api = createRegistrationApi({ isConfigured: () => true, append });
    expect(await api(req({ ...valid, consent: false }))).toMatchObject({ status: 400, body: { fieldErrors: { consent: expect.any(String) } } });
    expect(append).not.toHaveBeenCalled();
  });

  it("returns 503 when configuration is missing", async () => {
    const append = vi.fn(async () => {});
    const api = createRegistrationApi({ isConfigured: () => false, append });
    expect(await api(req())).toMatchObject({ status: 503, body: { ok: false, code: "NOT_CONFIGURED", retryable: true } });
    expect(append).not.toHaveBeenCalled();
  });

  it("returns a retryable failure without exposing submitted fields or provider errors", async () => {
    const append = vi.fn(async () => { throw new Error("provider credentials and submitted name: " + valid.name); });
    const logFailure = vi.fn();
    const api = createRegistrationApi({ isConfigured: () => true, append, logFailure, id: () => "opaque-id" });
    const result = await api(req());
    expect(result).toMatchObject({ status: 503, body: { ok: false, code: "SAVE_NOT_CONFIRMED", retryable: true } });
    expect(JSON.stringify(result)).not.toContain(valid.name);
    expect(logFailure).toHaveBeenCalledWith("registration_save_not_confirmed", "opaque-id");
    expect(append).toHaveBeenCalledOnce();
  });

  it.each([
    [{ method: "GET" }, 405], [{ path: "/api/other" }, 404],
    [{ contentType: "text/plain" }, 415], [{ bodyBytes: 8193 }, 413],
  ])("handles unsupported requests without storing input", async (overrides, status) => {
    const append = vi.fn(async () => {});
    const api = createRegistrationApi({ isConfigured: () => true, append });
    expect((await api({ ...req(), ...overrides })).status).toBe(status);
    expect(append).not.toHaveBeenCalled();
  });
});

describe("Sheets append adapter", () => {
  it("writes RAW values, escapes tab names, marks trial rows and disables retries", async () => {
    const request = vi.fn(async (_request: AppendRequest) => ack);
    await appendRegistration(config, { ...record, name: '=HYPERLINK("x")', question: '=HYPERLINK("x")\n문의\t내용' }, request);
    const options = request.mock.calls[0][0];
    expect(options.params).toEqual({ valueInputOption: "RAW", insertDataOption: "INSERT_ROWS", includeValuesInResponse: false });
    expect(options.retry).toBe(false);
    expect(options.timeout).toBe(15_000);
    expect(sheetRange(config.tabName)).toBe("'시험''신청'!A:K");
    expect(decodeURIComponent(options.url)).toContain("'시험''신청'!A:K:append");
    expect(options.data.values).toHaveLength(1);
    expect(options.data.values[0][2]).toBe("시험");
    expect(options.data.values[0][6]).toBe('=HYPERLINK("x")');
    expect(options.data.values[0][8]).toBe("3-1 과학");
    expect(options.data.values[0].slice(9)).toEqual(['동의', '=HYPERLINK("x")\n문의\t내용']);
  });

  it("uses a canonical preference order without assigning ranks", () => {
    const a = registrationRow({ ...record, lessonIds: ["lesson-4-5", "lesson-3-1"] });
    const b = registrationRow({ ...record, lessonIds: ["lesson-3-1", "lesson-4-5"] });
    expect(a).toEqual(b);
    expect(registrationRow({ ...record, isTest: false })[2]).toBe("실제");
  });

  it.each([{}, { spreadsheetId: "other", updates: ack.data.updates },
    { spreadsheetId: config.spreadsheetId, updates: { updatedRows: 0, updatedCells: 11, updatedRange: "A2:K2" } },
    { spreadsheetId: config.spreadsheetId, updates: { updatedRows: 1, updatedCells: 9, updatedRange: "A2:I2" } },
    { spreadsheetId: config.spreadsheetId, updates: { updatedRows: 1, updatedCells: 11 } }])("rejects incomplete storage acknowledgement %j", async data => {
    await expect(appendRegistration(config, record, async () => ({ data }))).rejects.toThrow();
  });

  it("does not retry provider/network failure", async () => {
    const request = vi.fn(async () => { throw new Error("network timeout"); });
    await expect(appendRegistration(config, record, request)).rejects.toThrow("network timeout");
    expect(request).toHaveBeenCalledOnce();
  });

  it("requires server configuration", () => {
    expect(readSheetsConfig({})).toBeNull();
    expect(readSheetsConfig({ SHEETS_SPREADSHEET_ID: "https://bad", SHEETS_TAB_NAME: "registrations" })).toBeNull();
    expect(readSheetsConfig({ SHEETS_SPREADSHEET_ID: "abc-123", SHEETS_TAB_NAME: " 신청 " })).toEqual({ spreadsheetId: "abc-123", tabName: "신청" });
  });
});
