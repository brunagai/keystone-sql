import { PROVIDERS } from '../agent/settingsStore.ts';
import {
  DIFFICULTY_LABELS,
  FOCUS_LABELS,
  type AiSettings,
  type ChallengeDifficulty,
  type ChallengeFocus,
} from '../agent/types.ts';
import { byId } from './dom.ts';
import { escapeHtml, formatInline } from './format.ts';

export interface AgentPanelHandlers {
  onGenerate: (focus: ChallengeFocus, difficulty: ChallengeDifficulty) => void;
  onCancel: () => void;
  onOpenAiSettings: () => void;
  onOpen?: () => void;
}

export type AgentNoticeTone = 'success' | 'warning' | 'error';

export interface AgentPanelController {
  setSettings(settings: AiSettings | null): void;
  setEnabled(enabled: boolean): void;
  setBusy(busy: boolean): void;
  setDifficulty(difficulty: ChallengeDifficulty): void;
  showProgress(message: string): void;
  showNotice(tone: AgentNoticeTone, message: string): void;
  clearProgress(): void;
}

const NOTICE_STYLE: Record<AgentNoticeTone, string> = {
  success: 'border-emerald-500/50 bg-emerald-950/40 text-emerald-300',
  warning: 'border-amber-500/50 bg-amber-950/40 text-amber-300',
  error: 'border-rose-500/50 bg-rose-950/40 text-rose-300',
};

const fillSelect = <T extends string>(select: HTMLSelectElement, labels: Record<T, string>, selected: T): void => {
  select.innerHTML = (Object.keys(labels) as T[])
    .map((key) => `<option value="${key}"${key === selected ? ' selected' : ''}>${escapeHtml(labels[key])}</option>`)
    .join('');
};

export function initAgentPanel({ onGenerate, onCancel, onOpenAiSettings, onOpen }: AgentPanelHandlers): AgentPanelController {
  const panel = byId('agent-panel');
  const providerStatus = byId('agent-provider-status');
  const focusSelect = byId<HTMLSelectElement>('agent-focus');
  const difficultySelect = byId<HTMLSelectElement>('agent-difficulty');
  const generateButton = byId<HTMLButtonElement>('btn-generate');
  const cancelButton = byId<HTMLButtonElement>('btn-generate-cancel');
  const progress = byId('agent-progress');
  const drawer = byId('agent-drawer');
  const openButton = byId<HTMLButtonElement>('btn-agent');
  const closeButton = byId<HTMLButtonElement>('btn-agent-close');
  const backdrop = byId('agent-backdrop');
  const settingsButton = byId<HTMLButtonElement>('btn-ai-settings');
  const settingsIndicator = byId('ai-key-indicator');

  fillSelect<ChallengeFocus>(focusSelect, FOCUS_LABELS, 'livre');
  fillSelect<ChallengeDifficulty>(difficultySelect, DIFFICULTY_LABELS, 'intermediario');

  let enabled = false;
  let busy = false;
  const setOpen = (open: boolean): void => {
    drawer.hidden = !open;
    openButton.setAttribute('aria-expanded', String(open));
  };
  setOpen(false);
  openButton.addEventListener('click', () => {
    onOpen?.();
    setOpen(true);
  });
  closeButton.addEventListener('click', () => {
    if (!busy) setOpen(false);
  });
  backdrop.addEventListener('click', () => {
    if (!busy) setOpen(false);
  });
  document.addEventListener('keydown', (event) => {
    if (event.key !== 'Escape' || drawer.hidden || busy || document.querySelector('dialog[open]')) return;
    setOpen(false);
  });

  const syncButtons = (): void => {
    generateButton.disabled = !enabled || busy;
    cancelButton.hidden = !busy;
    focusSelect.disabled = busy;
    difficultySelect.disabled = busy;
    panel.setAttribute('aria-busy', String(busy));
  };

  generateButton.addEventListener('click', () =>
    onGenerate(focusSelect.value as ChallengeFocus, difficultySelect.value as ChallengeDifficulty),
  );
  cancelButton.addEventListener('click', onCancel);
  settingsButton.addEventListener('click', onOpenAiSettings);

  return {
    setSettings(settings) {
      if (settingsIndicator) {
        settingsIndicator.className = `inline-block size-1.5 shrink-0 rounded-full ${settings ? 'bg-emerald-400' : 'bg-slate-500'}`;
      }
      if (settingsButton) {
        settingsButton.title = settings
          ? `Chave ${PROVIDERS[settings.provider].label} salva (modelo ${settings.model})`
          : 'Nenhuma chave salva: agente em modo offline';
        settingsButton.setAttribute('aria-label', settingsButton.title);
      }
      if (!providerStatus) return;
      providerStatus.className = 'mt-3 text-xs leading-relaxed text-slate-400';
      providerStatus.innerHTML = settings
        ? `<span class="text-emerald-400" aria-hidden="true">●</span>
           Conectado ao provedor <span class="font-medium text-slate-200">${escapeHtml(PROVIDERS[settings.provider].label)}</span>
           (<span class="font-medium text-slate-200">${escapeHtml(settings.model)}</span>)
           — desafios formulados em tempo real via IA.`
        : `<span class="text-slate-400" aria-hidden="true">○</span>
           Modo offline ativo — desafios gerados a partir do catálogo local homologado.`;
    },
    setEnabled(value) {
      enabled = value;
      syncButtons();
    },
    setBusy(value) {
      busy = value;
      syncButtons();
    },
    setDifficulty(difficulty) {
      if (difficulty in DIFFICULTY_LABELS) difficultySelect.value = difficulty;
    },
    showProgress(message) {
      progress.innerHTML = `
        <div class="flex items-center gap-2 text-[11px] text-violet-200">
          <span class="size-3 shrink-0 animate-spin rounded-full border-2 border-violet-900 border-t-violet-300"></span>
          ${escapeHtml(message)}
        </div>`;
    },
    showNotice(tone, message) {
      progress.innerHTML = `<p class="rounded border px-2 py-1.5 text-[11px] leading-relaxed ${NOTICE_STYLE[tone]}">${formatInline(message)}</p>`;
    },
    clearProgress() {
      progress.innerHTML = '';
    },
  };
}
