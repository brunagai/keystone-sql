import { byId } from './dom.ts';
import { escapeHtml } from './format.ts';

const STORAGE_KEY = 'aml-lab:onboarding-seen';
const CARD_WIDTH = 320;
const VIEW_PAD = 12;
const GAP = 16;
const SPOTLIGHT = 'tour-spotlight';

type TourPlacement = 'right' | 'left' | 'below';

interface TourStep {
  targetId: string;
  placement: TourPlacement;
  title: string;
  body: string;
}

const STEPS: readonly TourStep[] = [
  {
    targetId: 'mission-card',
    placement: 'right',
    title: 'A Missão',
    body: 'Aqui está o que você precisa descobrir, em uma frase. As abas abaixo abrem a dica de SQL, o dossiê e as colunas da resposta.',
  },
  {
    targetId: 'editor-container',
    placement: 'left',
    title: 'O Editor',
    body: 'Escreva a consulta neste espaço. Os comentários do rascunho indicam de onde vêm os dados, o que filtrar e o que mostrar.',
  },
  {
    targetId: 'action-buttons-group',
    placement: 'below',
    title: 'Executar e validar',
    body: 'Executar Consulta mostra a tabela. Validar Resposta compara o resultado com o gabarito da esteira.',
  },
];

let teardownActive: (() => void) | null = null;

function markSeen(): void {
  try {
    localStorage.setItem(STORAGE_KEY, '1');
  } catch {
    /* quota / modo privado */
  }
}

function alreadySeen(): boolean {
  try {
    return localStorage.getItem(STORAGE_KEY) === '1';
  } catch {
    return false;
  }
}

function clamp(value: number, min: number, max: number): number {
  return Math.min(Math.max(value, min), max);
}

function placeCard(card: HTMLElement, target: HTMLElement, placement: TourPlacement): void {
  const rect = target.getBoundingClientRect();
  const cardRect = card.getBoundingClientRect();
  const width = cardRect.width || CARD_WIDTH;
  const height = cardRect.height || 200;
  const maxLeft = window.innerWidth - width - VIEW_PAD;
  const maxTop = window.innerHeight - height - VIEW_PAD;

  let left = rect.left;
  let top = rect.top;
  if (placement === 'right') {
    left = rect.right + GAP;
    top = rect.top;
  } else if (placement === 'left') {
    left = rect.left - GAP - width;
    top = rect.top + 48;
  } else {
    left = rect.left + rect.width / 2 - width / 2;
    top = rect.bottom + GAP;
  }

  card.style.left = `${clamp(left, VIEW_PAD, Math.max(VIEW_PAD, maxLeft))}px`;
  card.style.top = `${clamp(top, VIEW_PAD, Math.max(VIEW_PAD, maxTop))}px`;
  card.style.maxWidth = `${Math.min(CARD_WIDTH, window.innerWidth - VIEW_PAD * 2)}px`;
}

function placeHole(hole: HTMLElement, target: HTMLElement): void {
  const rect = target.getBoundingClientRect();
  const pad = 6;
  hole.style.top = `${rect.top - pad}px`;
  hole.style.left = `${rect.left - pad}px`;
  hole.style.width = `${rect.width + pad * 2}px`;
  hole.style.height = `${rect.height + pad * 2}px`;
}

function renderCard(index: number): string {
  const step = STEPS[index];
  if (!step) return '';
  const isLast = index === STEPS.length - 1;
  const isFirst = index === 0;
  return `
    <div class="flex items-start gap-2">
      <p class="text-[11px] font-semibold uppercase tracking-wider text-emerald-400">Passo ${index + 1} de ${STEPS.length}</p>
      <button type="button" data-tour="skip" aria-label="Pular tour"
        class="ml-auto rounded-md px-1.5 text-slate-500 hover:bg-slate-800 hover:text-slate-200">✕</button>
    </div>
    <h2 id="onboarding-title" class="mt-2 text-base font-semibold text-slate-50">${escapeHtml(step.title)}</h2>
    <p class="mt-2 text-sm leading-relaxed text-slate-300">${escapeHtml(step.body)}</p>
    <div class="mt-5 flex items-center gap-2">
      <button type="button" data-tour="skip" class="rounded-lg px-2 py-1.5 text-xs text-slate-500 hover:bg-slate-800 hover:text-slate-300">Pular Tour</button>
      <div class="ml-auto flex gap-2">
        <button type="button" data-tour="back" ${isFirst ? 'disabled' : ''}
          class="rounded-lg border border-slate-700 px-3 py-1.5 text-xs text-slate-300 hover:bg-slate-800 disabled:cursor-not-allowed disabled:opacity-40">
          ← Voltar
        </button>
        <button type="button" data-tour="next"
          class="rounded-lg bg-sky-600 px-3.5 py-1.5 text-xs font-semibold text-white hover:bg-sky-500">
          ${isLast ? 'Começar a Investigar' : 'Próximo →'}
        </button>
      </div>
    </div>`;
}

export function startOnboardingTour(options?: { force?: boolean }): void {
  if (!options?.force && alreadySeen()) return;
  teardownActive?.();

  const backdrop = document.createElement('div');
  backdrop.id = 'onboarding-backdrop';
  backdrop.className = 'fixed inset-0 z-[55]';

  const hole = document.createElement('div');
  hole.id = 'onboarding-hole';
  hole.setAttribute('aria-hidden', 'true');
  hole.className = 'pointer-events-none fixed z-[60] rounded-xl ring-4 ring-emerald-500/70';
  hole.style.boxShadow = '0 0 0 9999px rgb(2 6 23 / 0.72)';

  const card = document.createElement('div');
  card.id = 'onboarding-card';
  card.setAttribute('role', 'dialog');
  card.setAttribute('aria-modal', 'true');
  card.setAttribute('aria-labelledby', 'onboarding-title');
  card.className =
    'fixed z-[80] w-[20rem] rounded-2xl border border-slate-700 bg-zinc-950 p-4 text-slate-200 shadow-2xl shadow-black/70';

  document.body.append(backdrop, hole, card);

  let index = 0;
  let highlighted: HTMLElement | null = null;
  let placeTimer: ReturnType<typeof setTimeout> | undefined;

  const clearHighlight = (): void => {
    highlighted?.classList.remove(SPOTLIGHT);
    highlighted = null;
  };

  const teardown = (): void => {
    window.removeEventListener('resize', schedulePlace);
    window.removeEventListener('scroll', schedulePlace, true);
    document.removeEventListener('keydown', onKey);
    clearTimeout(placeTimer);
    clearHighlight();
    hole.remove();
    card.remove();
    backdrop.remove();
    teardownActive = null;
  };

  const finish = (): void => {
    markSeen();
    teardown();
  };

  const schedulePlace = (): void => {
    const step = STEPS[index];
    if (!step) return;
    const target = document.getElementById(step.targetId);
    if (!target) return;
    placeHole(hole, target);
    placeCard(card, target, step.placement);
  };

  const paint = (): void => {
    const step = STEPS[index];
    if (!step) return;
    clearHighlight();
    card.innerHTML = renderCard(index);
    const target = document.getElementById(step.targetId);
    if (!target) {
      finish();
      return;
    }
    highlighted = target;
    target.classList.add(SPOTLIGHT);
    target.scrollIntoView({ behavior: 'smooth', block: 'nearest', inline: 'nearest' });
    clearTimeout(placeTimer);
    schedulePlace();
    placeTimer = setTimeout(schedulePlace, 320);
  };

  const onKey = (event: KeyboardEvent): void => {
    if (event.key === 'Escape') {
      event.preventDefault();
      finish();
    }
  };

  card.addEventListener('click', (event) => {
    const action = (event.target as HTMLElement).closest<HTMLElement>('[data-tour]')?.dataset['tour'];
    if (action === 'skip' || (action === 'next' && index >= STEPS.length - 1)) {
      finish();
      return;
    }
    if (action === 'next') {
      index += 1;
      paint();
      return;
    }
    if (action === 'back' && index > 0) {
      index -= 1;
      paint();
    }
  });

  window.addEventListener('resize', schedulePlace);
  window.addEventListener('scroll', schedulePlace, true);
  document.addEventListener('keydown', onKey);

  teardownActive = teardown;
  paint();
}

export function initLabGuide(): void {
  const dialog = byId<HTMLDialogElement>('lab-help-dialog');
  const openButton = byId<HTMLButtonElement>('btn-lab-help');

  openButton.addEventListener('click', () => {
    if (dialog.open) dialog.close();
    startOnboardingTour({ force: true });
  });
  dialog.addEventListener('click', (event) => {
    const target = event.target as HTMLElement;
    if (target === dialog || target.closest('[data-close-dialog]')) {
      dialog.close();
      return;
    }
    if (target.closest('[data-start-tour]')) {
      dialog.close();
      startOnboardingTour({ force: true });
    }
  });
}
