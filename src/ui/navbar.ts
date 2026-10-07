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
  const compact = root.querySelector<HTMLElement>('[data-progress-compact]');
  if (compact) compact.textContent = `${done}/${total}`;
  root.setAttribute('aria-valuenow', String(pct));
  root.setAttribute('aria-valuemin', '0');
  root.setAttribute('aria-valuemax', '100');
  root.setAttribute('aria-label', `Progresso da trilha: ${done} de ${total} desafios (${pct}%)`);
}

function createProgressMeter(): HTMLElement {
  const cluster = document.createElement('div');
  cluster.id = 'lab-progress';
  cluster.className = 'flex min-w-0 items-center gap-1';

  const meter = document.createElement('div');
  meter.setAttribute('role', 'progressbar');
  meter.className = 'flex min-w-0 items-center';
  meter.innerHTML = `
    <span class="inline-flex items-center gap-1 text-[11px] font-medium text-emerald-300">
      <span aria-hidden="true">✓</span>
      <span data-progress-compact>0/0</span>
    </span>`;

  const reset = document.createElement('button');
  reset.type = 'button';
  reset.title = 'Zerar trilha';
  reset.setAttribute('aria-label', 'Zerar progresso da trilha');
  reset.className = 'shrink-0 rounded px-1.5 py-0.5 text-[11px] text-slate-500 hover:bg-slate-800/80 hover:text-rose-400';
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

/** Header em uma linha: marca + progresso | seletor sequencial | Agente e guia. */
export function initNavbar(): void {
  hideFloatingMenus();

  const header = document.getElementById('app-header');
  const brand = document.getElementById('navbar-brand') ?? header?.querySelector<HTMLElement>(':scope > div:first-child');
  const nav = header?.querySelector('nav');
  const select = document.getElementById('scenario-select');
  const progress = createProgressMeter();

  if (brand && !document.getElementById('lab-progress')) brand.append(progress);

  header?.classList.add('h-14', 'w-full', 'max-w-full', 'overflow-x-hidden', 'px-4');
  header?.classList.remove('h-16', 'h-auto', 'flex-wrap', 'overflow-x-auto');

  nav?.classList.add('shrink-0', 'gap-2');
  nav?.classList.remove('flex-wrap', 'ml-auto');

  if (select instanceof HTMLSelectElement) {
    select.classList.add('min-w-0', 'truncate', 'max-w-full');
    select.classList.remove('min-w-[240px]');
  }
}
