import { onRequest } from "firebase-functions/v2/https";
import { warn } from "firebase-functions/logger";
import { createRegistrationApi } from "./registrations.js";
import { appendRegistration, authenticatedSheetsRequest, readSheetsConfig } from "./sheets.js";

const api = createRegistrationApi({
  isConfigured: () => readSheetsConfig() !== null,
  append: async record => {
    const config = readSheetsConfig();
    if (!config) throw new Error("Sheets configuration missing");
    await appendRegistration(config, record, authenticatedSheetsRequest);
  },
  logFailure: (event, registrationId) => warn(event, { registrationId }),
});

export const registrations = onRequest({
  region: "asia-northeast3", invoker: "public", cors: false, timeoutSeconds: 30,
  memory: "256MiB", maxInstances: 3,
  ...(process.env.REGISTRATIONS_SERVICE_ACCOUNT ? { serviceAccount: process.env.REGISTRATIONS_SERVICE_ACCOUNT } : {}),
}, async (req, res) => {
  res.set("Cache-Control", "no-store");
  const result = await api({
    method: req.method, path: req.path, contentType: req.get("content-type") ?? "",
    body: req.body, bodyBytes: req.rawBody?.byteLength ?? 0,
  });
  for (const [name, value] of Object.entries(result.headers ?? {})) res.set(name, value);
  res.status(result.status).json(result.body);
});

