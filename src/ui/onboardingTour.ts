import { byId } from './dom.ts';
import { escapeHtml } from './format.ts';

const STORAGE_KEY = 'aml-lab:onboarding-seen';

interface TourStep {
  kicker: string;
  title: string;
  body: string;
}

const STEPS: readonly TourStep[] = [
  {
    kicker: 'Passo 1 de 3',
    title: 'Escolha o caso',
    body: 'No topo, abra Nível / Trilha e selecione um desafio. A tela principal fica só com a missão e o editor — o resto aparece quando você pedir.',
  },
  {
    kicker: 'Passo 2 de 3',
    title: 'Leia a missão',
    body: 'À esquerda está o que você precisa descobrir, em uma frase. As abas abrem a dica de SQL, o dossiê policial e as colunas da resposta.',
  },
  {
    kicker: 'Passo 3 de 3',
    title: 'Escreva e valide',
    body: 'No editor, complete o rascunho. Executar Consulta mostra a tabela. Validar Resposta compara o resultado com o gabarito da esteira.',
  },
];

function renderStep(index: number): string {
  const step = STEPS[index];
  if (!step) return '';
  const isLast = index === STEPS.length - 1;
  return `
    <p class="text-[11px] font-semibold uppercase tracking-wider text-sky-400">${escapeHtml(step.kicker)}</p>
    <h2 id="onboarding-title" class="mt-1 text-lg font-semibold text-slate-50">${escapeHtml(step.title)}</h2>
    <p class="mt-3 text-sm leading-relaxed text-slate-300">${escapeHtml(step.body)}</p>
    <div class="mt-6 flex items-center gap-2">
      <button type="button" data-tour="skip" class="rounded-lg px-2 py-1.5 text-xs text-slate-500 hover:bg-slate-800 hover:text-slate-300">Pular</button>
      <div class="ml-auto flex gap-2">
        ${
          index > 0
            ? '<button type="button" data-tour="back" class="rounded-lg border border-slate-700 px-3 py-1.5 text-xs text-slate-300 hover:bg-slate-800">Voltar</button>'
            : ''
        }
        <button type="button" data-tour="next"
          class="rounded-lg bg-sky-600 px-3.5 py-1.5 text-xs font-semibold text-white hover:bg-sky-500">
          ${isLast ? 'Começar a investigar' : 'Próximo'}
        </button>
      </div>
    </div>`;
}

function markSeen(): void {
  try {
    localStorage.setItem(STORAGE_KEY, '1');
  } catch {
    /* quota / modo privado: o tour pode reaparecer */
  }
}

function alreadySeen(): boolean {
  try {
    return localStorage.getItem(STORAGE_KEY) === '1';
  } catch {
    return false;
  }
}

/** Modal de 3 passos. Com `force`, reabre mesmo após a primeira visita. */
export function startOnboardingTour(options?: { force?: boolean }): void {
  if (!options?.force && alreadySeen()) return;
  document.getElementById('onboarding-dialog')?.remove();

  const dialog = document.createElement('dialog');
  dialog.id = 'onboarding-dialog';
  dialog.setAttribute('aria-labelledby', 'onboarding-title');
  dialog.className =
    'w-[min(28rem,calc(100vw-2rem))] rounded-2xl border border-slate-700 bg-zinc-950 p-6 text-slate-200 shadow-2xl shadow-black/70 backdrop:bg-slate-950/75';

  let index = 0;
  const paint = (): void => {
    dialog.innerHTML = renderStep(index);
  };

  const finish = (): void => {
    markSeen();
    if (dialog.open) dialog.close();
    dialog.remove();
  };

  dialog.addEventListener('click', (event) => {
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

  dialog.addEventListener('close', () => {
    markSeen();
    dialog.remove();
  });

  paint();
  document.body.appendChild(dialog);
  dialog.showModal();
}

export function initLabGuide(): void {
  const dialog = byId<HTMLDialogElement>('lab-help-dialog');
  const openButton = byId<HTMLButtonElement>('btn-lab-help');

  openButton.addEventListener('click', () => dialog.showModal());
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
