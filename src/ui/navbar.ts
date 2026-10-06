import { showMobilePane } from './layout.ts';

const FLOATING_MENU_IDS = ['history-panel', 'export-menu', 'selection-help'] as const;

/** Fecha popovers da chrome antes de qualquer init, para não ficarem soltos se o JS interromper. */
export function hideFloatingMenus(): void {
  for (const id of FLOATING_MENU_IDS) {
    const node = document.getElementById(id);
    if (!node) continue;
    node.hidden = true;
  }
}

function wrapRow(id: string, className: string, nodes: HTMLElement[]): HTMLElement {
  const row = document.createElement('div');
  row.id = id;
  row.className = className;
  for (const node of nodes) row.append(node);
  return row;
}

/**
 * Seletor `#scenario-select` (preenchido em `investigationPanel`):
 * trilha 0–5 em <optgroup>; Iniciante = 0–1, Intermediário = 2–3, Avançado = 4–5.
 * No mobile: linha 1 (marca + ações) e linha 2 (categorias + dropdown do caso).
 */
export function initNavbar(): HTMLSelectElement | null {
  hideFloatingMenus();

  const header = document.getElementById('app-header');
  const brand = header?.querySelector<HTMLElement>(':scope > div:first-child');
  const trail = document.getElementById('trail-bands');
  const tools = trail?.parentElement;
  const nav = header?.querySelector('nav');
  const select = document.getElementById('scenario-select');

  if (header && brand && tools && nav && header.querySelectorAll(':scope > div, :scope > nav').length >= 3) {
    const row1 = wrapRow(
      'navbar-primary',
      'flex w-full min-h-10 shrink-0 flex-wrap items-center gap-2 md:w-auto md:flex-nowrap',
      [brand, nav],
    );
    const row2 = wrapRow(
      'navbar-cases',
      'flex min-h-10 w-full min-w-0 flex-1 flex-wrap items-center gap-2 overflow-x-hidden md:flex-nowrap',
      [tools],
    );
    header.replaceChildren(row1, row2);
    header.classList.add(
      'max-md:h-auto',
      'max-md:min-h-0',
      'max-md:flex-col',
      'max-md:items-stretch',
      'max-md:gap-2',
      'max-md:py-2',
      'max-md:overflow-x-hidden',
      'md:h-16',
      'md:flex-row',
      'md:items-center',
    );
    header.classList.remove('h-16', 'overflow-x-auto');
    nav.classList.add('ml-auto', 'flex-wrap', 'shrink-0');
    tools.classList.add('min-w-0', 'w-full', 'max-w-full', 'flex-1', 'flex-wrap', 'md:flex-nowrap');
    tools.classList.remove('overflow-x-auto');
  }

  if (trail) {
    trail.classList.add('shrink-0', 'max-md:max-w-full', 'overflow-x-auto');
    for (const button of trail.querySelectorAll('button')) {
      button.classList.add('shrink-0', 'min-h-[38px]');
    }
  }

  if (select instanceof HTMLSelectElement) {
    select.classList.add('min-h-[38px]', 'min-w-0', 'w-full', 'max-w-full', 'flex-1', 'truncate');
    select.classList.remove('shrink-0');
  }

  if (nav) {
    for (const button of nav.querySelectorAll('button')) {
      button.classList.add('shrink-0', 'min-h-[38px]');
    }
  }

  document.getElementById('btn-schema')?.addEventListener('click', () => showMobilePane('mission'));

  const selectEl = document.getElementById('scenario-select');
  return selectEl instanceof HTMLSelectElement ? selectEl : null;
}
