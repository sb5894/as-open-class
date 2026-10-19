import { readFile } from "node:fs/promises";
import { createHash } from "node:crypto";
import { resolve, relative, isAbsolute } from "node:path";
import { fileURLToPath } from "node:url";

const root = fileURLToPath(new URL("../", import.meta.url));
const records = JSON.parse(await readFile(new URL("../docs/source-manifest.json", import.meta.url), "utf8"));
let checked = 0;
for (const record of records) {
  const target = resolve(root, record.currentPath);
  const rel = relative(root, target);
  if (rel.startsWith("..") || isAbsolute(rel)) {
    throw new Error("Source path is outside the project: " + record.currentPath);
  }
  const bytes = await readFile(target);
  const actual = createHash("sha256").update(bytes).digest("hex").toUpperCase();
  if (actual !== record.sha256 || bytes.byteLength !== record.bytes) {
    throw new Error("Source changed: " + record.currentPath);
  }
  checked += 1;
}
console.log("Original files verified: " + checked);

