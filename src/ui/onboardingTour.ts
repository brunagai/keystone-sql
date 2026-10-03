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
    title: 'A Missão (Painel 3)',
    body: 'À direita está o dossiê do caso. Comece pelo bloco 🎯 Sua Missão: uma frase diz o que você precisa descobrir. O contexto policial fica recolhido até você quiser ler mais.',
  },
  {
    kicker: 'Passo 2 de 3',
    title: 'O Editor guiado (Painel 2)',
    body: 'No centro você escreve SQL. Os comentários numerados no rascunho indicam de onde vêm os dados, o que filtrar no WHERE e quais colunas mostrar. Use ▶ Executar Query para ver a tabela.',
  },
  {
    kicker: 'Passo 3 de 3',
    title: 'A Validação da esteira',
    body: 'Quando a consulta parecer certa, clique em Validar Desafio. O laboratório compara seu resultado com o gabarito da esteira PLD/AML e aponta o que ainda falta ajustar.',
  },
];

function renderStep(index: number): string {
  const step = STEPS[index];
  if (!step) return '';
  const isLast = index === STEPS.length - 1;
  return `
    <p class="text-[10px] font-semibold uppercase tracking-wider text-sky-400">${escapeHtml(step.kicker)}</p>
    <h2 id="onboarding-title" class="mt-1 text-base font-semibold text-slate-50">${escapeHtml(step.title)}</h2>
    <p class="mt-2 text-sm leading-relaxed text-slate-300">${escapeHtml(step.body)}</p>
    <div class="mt-5 flex items-center gap-2">
      <button type="button" data-tour="skip" class="rounded px-2 py-1 text-xs text-slate-500 hover:bg-slate-800 hover:text-slate-300">Pular</button>
      <div class="ml-auto flex gap-2">
        ${
          index > 0
            ? '<button type="button" data-tour="back" class="rounded border border-slate-700 px-2.5 py-1 text-xs text-slate-300 hover:bg-slate-800">Voltar</button>'
            : ''
        }
        <button type="button" data-tour="next"
          class="rounded bg-sky-600 px-3 py-1 text-xs font-semibold text-white hover:bg-sky-500">
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

/** Modal de 3 passos na primeira visita. Idempotente se o tour já foi visto. */
export function startOnboardingTour(): void {
  if (alreadySeen() || document.getElementById('onboarding-dialog')) return;

  const dialog = document.createElement('dialog');
  dialog.id = 'onboarding-dialog';
  dialog.setAttribute('aria-labelledby', 'onboarding-title');
  dialog.className =
    'w-[min(28rem,calc(100vw-2rem))] rounded-xl border border-slate-700 bg-zinc-950 p-5 text-slate-200 shadow-2xl shadow-black/70 backdrop:bg-slate-950/70';

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
