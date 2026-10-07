import { allScenarios, onScenariosChange } from '../challenges/registry.ts';
import { getCompletedChallenges, PROGRESS_UPDATED_EVENT, resetProgress } from '../services/progressService.ts';

const FLOATING_MENU_IDS = ['history-panel', 'export-menu'] as const;

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
  const cluster = document.createElement('div');
  cluster.id = 'lab-progress';
  cluster.className = 'flex min-w-0 max-w-full shrink items-center gap-1.5';

  const meter = document.createElement('div');
  meter.setAttribute('role', 'progressbar');
  meter.className = 'flex min-w-0 items-center gap-2';
  meter.innerHTML = `
    <span data-progress-desktop class="hidden whitespace-nowrap text-[11px] text-slate-400 xl:inline">Progresso: 0/0 (0%)</span>
    <span class="inline-flex items-center gap-1 text-[11px] font-medium text-emerald-300 xl:hidden">
      <span aria-hidden="true">✓</span>
      <span data-progress-compact>0/0</span>
    </span>
    <div class="hidden h-1.5 w-24 overflow-hidden rounded-full bg-slate-800 xl:block" aria-hidden="true">
      <div data-progress-bar class="h-full rounded-full bg-emerald-500 transition-[width] duration-300" style="width: 0%"></div>
    </div>`;

  const reset = document.createElement('button');
  reset.type = 'button';
  reset.title = 'Zerar trilha';
  reset.setAttribute('aria-label', 'Zerar progresso da trilha');
  reset.className =
    'shrink-0 rounded px-1.5 py-0.5 text-xs text-slate-400 hover:bg-slate-800/80 hover:text-rose-400';
  reset.textContent = 'Zerar';
  reset.addEventListener('click', () => {
    if (!window.confirm('Deseja realmente zerar o seu progresso na trilha de desafios?')) return;
    resetProgress();
  });

  const refresh = (): void => paintProgress(meter);
  refresh();
  window.addEventListener(PROGRESS_UPDATED_EVENT, refresh);
  onScenariosChange(refresh);

  cluster.append(meter, reset);
  return cluster;
}

/**
 * Seletor `#scenario-select` (preenchido em `investigationPanel`):
 * trilha 0–5 em <optgroup>; Iniciante = 0–1, Intermediário = 2–3, Avançado = 4–5.
 * No mobile: linha 1 (marca + ações) e linha 2 (categorias + dropdown do caso).
 */
export function initNavbar(): void {
  hideFloatingMenus();

  const header = document.getElementById('app-header');
  const brand = header?.querySelector<HTMLElement>(':scope > div:first-child');
  const trail = document.getElementById('trail-bands');
  const tools = document.getElementById('case-picker') ?? trail?.parentElement;
  const nav = header?.querySelector('nav');
  const select = document.getElementById('scenario-select');
  const progress = createProgressMeter();

  if (header && brand && tools && nav && header.querySelectorAll(':scope > div, :scope > nav').length >= 3) {
    const row1 = wrapRow(
      'navbar-primary',
      'flex min-w-0 max-w-full flex-wrap items-center gap-2',
      [brand, progress, nav],
    );
    const row2 = wrapRow(
      'navbar-cases',
      'flex min-h-0 min-w-0 w-full max-w-full flex-1 items-stretch overflow-hidden sm:max-w-[320px] lg:max-w-[380px]',
      [tools],
    );
    header.replaceChildren(row1, row2);
    header.classList.add(
      'w-full',
      'max-w-full',
      'overflow-x-hidden',
      'flex',
      'flex-wrap',
      'items-center',
      'justify-between',
      'gap-2',
      'px-3',
      'sm:px-4',
      'h-auto',
    );
    header.classList.remove('h-16', 'overflow-x-auto', 'overflow-hidden');
    nav.classList.add('flex-wrap', 'min-w-0');
    nav.classList.remove('shrink-0', 'ml-auto');
    tools.classList.add('min-w-0', 'w-full', 'max-w-full');
    tools.classList.remove('overflow-x-auto', 'flex-wrap', 'flex-1');
  } else if (header) {
    header.append(progress);
  }

  if (trail) {
    trail.classList.add('min-w-0', 'max-w-full', 'flex-wrap');
    trail.classList.remove('shrink-0', 'overflow-x-auto');
  }

  if (select instanceof HTMLSelectElement) {
    select.classList.add('min-w-0', 'w-full', 'max-w-full', 'truncate');
    select.classList.remove('shrink-0', 'min-w-[240px]', 'flex-1');
  }

  for (const id of ['btn-prev-scenario', 'btn-next-scenario'] as const) {
    document.getElementById(id)?.classList.add('shrink-0');
    document.getElementById(id)?.classList.remove('min-w-[38px]', 'min-h-[38px]');
  }
}
