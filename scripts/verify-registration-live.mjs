// Explicitly writes TWO marked test registrations, then reads them back via ADC.
import assert from "node:assert/strict";
import { createRequire } from "node:module";
import { parseArgs } from "node:util";

const { values } = parseArgs({ options: {
  url: { type: "string" }, "sheet-id": { type: "string" }, tab: { type: "string" },
} });

if (!values.url || !values["sheet-id"] || !values.tab) {
  console.error("사용법: npm.cmd run verify:registration -- --url <신청 API 전체 주소> --sheet-id <시트 ID> --tab registrations");
  process.exit(1);
}
const endpoint = new URL(values.url);
if (endpoint.protocol !== "https:" && !(endpoint.protocol === "http:" && ["127.0.0.1", "localhost"].includes(endpoint.hostname))) {
  throw new Error("HTTPS 또는 로컬 에뮬레이터 주소를 사용해 주세요.");
}

const require = createRequire(new URL("../functions/package.json", import.meta.url));
const { GoogleAuth } = require("google-auth-library");
const { publicLessons, registrationRow } = await import("../functions/lib/registrations.js");
const auth = new GoogleAuth({ scopes: ["https://www.googleapis.com/auth/spreadsheets.readonly"] });
const tab = `'${values.tab.replaceAll("'", "''")}'`;
const expectedHeaders = ["제출시각", "접수ID", "구분", "지역", "소속교", "직위", "이름", "희망수업ID", "희망수업표시", "동의 여부", "문의 내용"];

try {
  const client = await auth.getClient();
  const read = async range => (await client.request({
    url: `https://sheets.googleapis.com/v4/spreadsheets/${encodeURIComponent(values["sheet-id"])}/values/${encodeURIComponent(range)}`,
    method: "GET", timeout: 15_000, retry: false,
  })).data.values ?? [];
  // Check reader credentials, selected sheet and header before any registration.
  assert.deepEqual((await read(`${tab}!A1:K1`))[0], expectedHeaders);
  const ids = [];
  for (const count of [1, 2]) {
    const input = { city: "연결시험", school: "연결시험(집계 제외)", assignment: "연결시험", name: `시험-${Date.now()}-${count}`,
      lessonIds: publicLessons.slice(0, count).map(lesson => lesson.id), consent: true, question: "연결시험 문의\n집계 제외", isTest: true };
    const response = await fetch(endpoint, {
      method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(input), signal: AbortSignal.timeout(35_000),
    });
    const body = await response.json();
    assert.equal(response.status, 201);
    assert.equal(body.ok, true);
    assert.equal(body.status, "saved");
    assert.equal(typeof body.registrationId, "string");
    // Log only receipt IDs, never credentials or registration fields.
    console.log(JSON.stringify({ trialReceipt: body.registrationId, preferences: count }));
    const idRows = await read(`${tab}!B:B`);
    const rowIndex = idRows.findIndex(row => row[0] === body.registrationId);
    assert.ok(rowIndex >= 1, "접수 ID가 시트에 없습니다.");
    const row = (await read(`${tab}!A${rowIndex + 1}:K${rowIndex + 1}`))[0];
    assert.deepEqual(row, registrationRow({ ...input, registrationId: body.registrationId, submittedAt: body.submittedAt }));
    assert.equal(row[1], body.registrationId);
    assert.equal(row[2], "시험");
    assert.deepEqual(row.slice(3, 7), [input.city, input.school, input.assignment, input.name]);
    assert.deepEqual(row[7].split(" / "), input.lessonIds);
    assert.ok(row[8]);
    ids.push(body.registrationId);
  }
  console.log(JSON.stringify({ verifiedInActualSheet: true, trialRows: 2, receiptIds: ids }));
} catch {
  console.error("실제 저장 검증 실패. 시트 설정·ADC 인증·권한과 접수 결과를 확인해 주세요. 자동 재제출하지 않았습니다. 이미 표시된 접수 ID가 있다면 시트에서 확인해 주세요.");
  process.exitCode = 1;
}
