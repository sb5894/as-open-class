import type { Lens } from '../data/catalog';
import { lensDescriptions } from '../data/lenses';
import { createMaterialText } from './placeholders';
import { el } from './ui';

let instance = 0;
export function createLenses(lenses: Lens[]): HTMLElement {
  if (!lenses.length) return createMaterialText(null);
  const container = el('div', undefined, 'lens-group');
  const buttons = el('div', undefined, 'lens-buttons');
  const explanation = el('div', undefined, 'lens-explanation');
  explanation.id = `lens-explanation-${++instance}`;
  explanation.hidden = true;
  explanation.setAttribute('role', 'region');
  explanation.setAttribute('aria-label', '렌즈 설명');
  let active: Lens | null = null;
  let pinned: Lens | null = null;
  const controls = new Map<Lens, HTMLButtonElement>();
  function show(lens: Lens | null) {
    active = lens;
    controls.forEach((button, name) => button.setAttribute('aria-expanded', String(name === lens)));
    explanation.hidden = lens === null;
    explanation.replaceChildren();
    if (lens) {
      const text = lensDescriptions[lens];
      explanation.append(el('strong', `${lens} · ${text.summary}`), el('p', `참관 질문: ${text.question}`));
    }
  }
  for (const lens of lenses) {
    const button = el('button', lens, 'lens-button');
    button.dataset.lens=lens;
    button.type = 'button';
    button.setAttribute('aria-controls', explanation.id);
    button.setAttribute('aria-expanded', 'false');
    button.addEventListener('pointerenter', event => { if (event.pointerType === 'mouse') show(lens); });
    button.addEventListener('click', () => { pinned = pinned === lens ? null : lens; show(pinned); });
    controls.set(lens, button);
    buttons.append(button);
  }
  container.addEventListener('pointerleave', event => { if (event.pointerType === 'mouse') show(pinned); });
  container.addEventListener('focusout', event => {
    if (!container.contains(event.relatedTarget as Node | null)) { pinned = null; show(null); }
  });
  container.addEventListener('keydown', event => {
    if (event.key === 'Escape' && active) { pinned = null; show(null); event.stopPropagation(); }
  });
  container.append(buttons, explanation);
  return container;
}
