export const MISSING_TEXT = "자료 업로드 예정입니다.";
export const MISSING_PDF_TEXT = "자료 업로드 예정";

export function createTextPlaceholder(): HTMLParagraphElement {
  const paragraph = document.createElement("p");
  paragraph.className = "text-placeholder";
  paragraph.textContent = MISSING_TEXT;
  return paragraph;
}

/** Data stores null for missing text; only this presentation layer adds wording. */
export function createMaterialText(value: string | null): HTMLParagraphElement {
  if (value === null || value.trim() === "") return createTextPlaceholder();
  const paragraph = document.createElement("p");
  paragraph.textContent = value;
  return paragraph;
}

export function createPdfPlaceholder(): HTMLDivElement {
  const container = document.createElement("div");
  container.className = "pdf-viewer-slot pdf-placeholder";
  container.setAttribute("aria-label", "지도안 자료 업로드 예정");

  const message = document.createElement("p");
  message.textContent = MISSING_PDF_TEXT;
  container.append(message);
  return container;
}

