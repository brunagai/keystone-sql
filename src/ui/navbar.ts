import { allScenarios, onScenariosChange } from '../challenges/registry.ts';
import { getCompletedChallenges, PROGRESS_UPDATED_EVENT } from '../services/progressService.ts';
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

function progressSnapshot(): { done: number; total: number; pct: number } {
  const catalog = allScenarios();
  const known = new Set(catalog.map((s) => s.id));
  const done = getCompletedChallenges().filter((id) => known.has(id)).length;
  const total = catalog.length;
  const pct = total === 0 ? 0 : Math.round((done / total) * 100);
  return { done, total, pct };
}

function paintProgress(root: HTMLElement): void {
  const { done, total, pct } = progressSnapshot();
  const desktop = root.querySelector<HTMLElement>('[data-progress-desktop]');
  const compact = root.querySelector<HTMLElement>('[data-progress-compact]');
  const bar = root.querySelector<HTMLElement>('[data-progress-bar]');
  if (desktop) desktop.textContent = `Progresso: ${done}/${total} (${pct}%)`;
  if (compact) compact.textContent = `${done}/${total}`;
  if (bar) bar.style.width = `${pct}%`;
  root.setAttribute('aria-valuenow', String(pct));
  root.setAttribute('aria-valuemin', '0');
  root.setAttribute('aria-valuemax', '100');
  root.setAttribute('aria-label', `Progresso da trilha: ${done} de ${total} desafios (${pct}%)`);
}

function createProgressMeter(): HTMLElement {
  const root = document.createElement('div');
  root.id = 'lab-progress';
  root.setAttribute('role', 'progressbar');
  root.className = 'flex min-w-0 max-w-full shrink-0 items-center gap-2';
  root.innerHTML = `
    <span data-progress-desktop class="hidden whitespace-nowrap text-[11px] text-slate-400 md:inline">Progresso: 0/0 (0%)</span>
    <span class="inline-flex items-center gap-1 text-[11px] font-medium text-emerald-300 md:hidden">
      <span aria-hidden="true">✓</span>
      <span data-progress-compact>0/0</span>
    </span>
    <div class="hidden h-1.5 w-24 overflow-hidden rounded-full bg-slate-800 md:block" aria-hidden="true">
      <div data-progress-bar class="h-full rounded-full bg-emerald-500 transition-[width] duration-300" style="width: 0%"></div>
    </div>`;
  paintProgress(root);
  window.addEventListener(PROGRESS_UPDATED_EVENT, () => paintProgress(root));
  onScenariosChange(() => paintProgress(root));
  return root;
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
  const progress = createProgressMeter();

  if (header && brand && tools && nav && header.querySelectorAll(':scope > div, :scope > nav').length >= 3) {
    const row1 = wrapRow(
      'navbar-primary',
      'flex w-full min-h-10 shrink-0 flex-wrap items-center gap-2 md:w-auto md:flex-nowrap',
      [brand, progress, nav],
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
  } else if (header) {
    header.append(progress);
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
