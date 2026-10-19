import { GoogleAuth } from "google-auth-library";
import { registrationRow, type RegistrationRecord } from "./registrations.js";

export const SHEETS_SCOPE = "https://www.googleapis.com/auth/spreadsheets";
export interface SheetsConfig { spreadsheetId: string; tabName: string }

export function readSheetsConfig(env: NodeJS.ProcessEnv = process.env): SheetsConfig | null {
  const spreadsheetId = env.SHEETS_SPREADSHEET_ID?.trim();
  const tabName = env.SHEETS_TAB_NAME?.trim();
  if (!spreadsheetId || !/^[A-Za-z0-9_-]+$/.test(spreadsheetId) || !tabName || tabName.length > 100 || /[\u0000-\u001f]/.test(tabName)) return null;
  return { spreadsheetId, tabName };
}

export function sheetRange(tabName: string): string {
  return `'${tabName.replaceAll("'", "''")}'!A:K`;
}

export interface AppendRequest {
  url: string;
  method: "POST";
  params: { valueInputOption: "RAW"; insertDataOption: "INSERT_ROWS"; includeValuesInResponse: false };
  data: { majorDimension: "ROWS"; values: string[][] };
  retry: false;
  timeout: number;
}
type AppendAck = { spreadsheetId?: string; updates?: { updatedRows?: number; updatedCells?: number; updatedRange?: string } };
export type SheetsRequest = (request: AppendRequest) => Promise<{ data: AppendAck }>;

/** One append attempt. No automatic retries after an ambiguous network failure. */
export async function appendRegistration(config: SheetsConfig, record: RegistrationRecord, request: SheetsRequest): Promise<void> {
  const row = registrationRow(record);
  const response = await request({
    url: `https://sheets.googleapis.com/v4/spreadsheets/${encodeURIComponent(config.spreadsheetId)}/values/${encodeURIComponent(sheetRange(config.tabName))}:append`,
    method: "POST",
    params: { valueInputOption: "RAW", insertDataOption: "INSERT_ROWS", includeValuesInResponse: false },
    data: { majorDimension: "ROWS", values: [row] },
    retry: false,
    timeout: 15_000,
  });
  const ack = response.data;
  if (ack.spreadsheetId !== config.spreadsheetId || ack.updates?.updatedRows !== 1
      || ack.updates.updatedCells !== row.length || !ack.updates.updatedRange) {
    throw new Error("Sheets did not acknowledge one complete registration row");
  }
}

// Application Default Credentials: runtime identity in Firebase, ADC locally.
// Authentication is lazy so missing local credentials cannot create fake success.
const auth = new GoogleAuth({ scopes: [SHEETS_SCOPE] });
export const authenticatedSheetsRequest: SheetsRequest = async options => {
  const client = await auth.getClient();
  return client.request<AppendAck>(options);
};
