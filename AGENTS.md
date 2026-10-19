# Project instructions

## Root and sources of truth

- Work in this repository: C:\Users\user\Projects\as-open-class.
- Before implementing a task, read README.md, 개발 계획.md, docs/결정 기록.md, and docs/진행 현황.md.
- For the current task, read the corresponding step in 작업 순서와 모델별 요청문.md.
- Latest explicit user instructions override these documents. Confirm material conflicts rather than silently choosing.
- Use the existing TypeScript/Vite/Firebase structure. Do not recreate the project or introduce a framework without a concrete requirement.

## Scope

- Mobile web, Firebase Hosting, Google Sheets registration through a server endpoint.
- No accounts, reservation limits, admin dashboard, PWA, offline cache, or survey feature in v1.
- Survey must wait for a separate user instruction.
- Follow the requested step; do not automatically execute all later steps.
- No automatic model delegation or parallel file edits. Model handoff is user-directed.
- Firebase project selection, external writes, and deployment happen in the scope of the user's requested implementation step. Never claim a live integration was verified with mock data alone.

## Materials and data

- Preserve originals under materials/original and docs/requirements. Derive code/data/images separately.
- New materials arrive in materials/incoming. Record versions and update docs/자료 목록.md.
- Do not add materials/original to public or dist. Only selected web assets belong in public.
- A lesson's class and its actual room are distinct. Read docs/결정 기록.md for all room exceptions.
- Normalize Excel date-formatted class labels to grade-class strings.
- Never invent missing lesson content or use an unrelated PDF as a fallback.

## Missing material presentation

- Missing text: exactly "자료 업로드 예정입니다."
- Missing PDF: a gray box occupying the normal PDF viewer area, with exactly "자료 업로드 예정" centered.
- Use the common component in src/components/placeholders.ts and the shared pdf-viewer-slot layout.
- Missing files must not create a download link or failed network request.
- A real loading error is not missing material; show an error and a retry path.

## Checks and handoff

- For code changes run npm.cmd run check and npm.cmd run build.
- Add meaningful tests for data mapping and registration behavior when those features are implemented. Do not add tests that only repeat trivial markup.
- Use npm.cmd test only once real test cases exist; no empty-test success claims.
- Check relevant mobile interactions in a browser. Label emulator-only or unperformed device checks honestly.
- Update docs/진행 현황.md with changes, actual checks, remaining issues, and the next step.
- Keep secrets in ignored local/server configuration, never frontend VITE_ variables or source-controlled files.
- Use the project-local npm tools and lockfile. Do not modify global Node/npm settings.

