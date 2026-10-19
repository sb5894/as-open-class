import { defineConfig, loadEnv } from "vite";

export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), "");
  // Root .env.local contains only this public project ID, never Sheets credentials.
  const project = env.FIREBASE_PROJECT_ID || "demo-as-open-class";
  if (!/^[a-z][a-z0-9-]+$/.test(project)) throw new Error("Invalid FIREBASE_PROJECT_ID");
  const emulator = env.REGISTRATIONS_EMULATOR === "true" || project.startsWith("demo-");
  const proxy = {
    "/api": {
      target: emulator ? "http://127.0.0.1:5001" : `https://asia-northeast3-${project}.cloudfunctions.net`,
      changeOrigin: true,
      rewrite: (path: string) => emulator ? `/${project}/asia-northeast3/registrations${path}` : `/registrations${path}`,
    },
  };
  return {
    server: { proxy },
    preview: { proxy },
  };
});
