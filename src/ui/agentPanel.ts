import { PROVIDERS, maskApiKey } from '../agent/settingsStore.ts';
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
}

export type AgentNoticeTone = 'success' | 'warning' | 'error';

export interface AgentPanelController {
  setSettings(settings: AiSettings | null): void;
  setEnabled(enabled: boolean): void;
  setBusy(busy: boolean): void;
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

export function initAgentPanel({ onGenerate, onCancel }: AgentPanelHandlers): AgentPanelController {
  const panel = byId('agent-panel');
  const providerStatus = byId('agent-provider-status');
  const focusSelect = byId<HTMLSelectElement>('agent-focus');
  const difficultySelect = byId<HTMLSelectElement>('agent-difficulty');
  const generateButton = byId<HTMLButtonElement>('btn-generate');
  const cancelButton = byId<HTMLButtonElement>('btn-generate-cancel');
  const progress = byId('agent-progress');

  fillSelect<ChallengeFocus>(focusSelect, FOCUS_LABELS, 'livre');
  fillSelect<ChallengeDifficulty>(difficultySelect, DIFFICULTY_LABELS, 'intermediario');

  let enabled = false;
  let busy = false;
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

  return {
    setSettings(settings) {
      providerStatus.innerHTML = settings
        ? `<span class="inline-block size-1.5 rounded-full bg-violet-400 align-middle"></span>
           <span class="text-slate-300">${escapeHtml(PROVIDERS[settings.provider].label)}</span>
           · <span class="font-mono">${escapeHtml(settings.model)}</span>
           · <span class="font-mono text-slate-600">${escapeHtml(maskApiKey(settings.apiKey))}</span>`
        : '<span class="inline-block size-1.5 rounded-full bg-slate-500 align-middle"></span> Modo offline (templates locais). Use <span class="text-slate-300">⚙ Configurar IA</span> no topo para conectar uma LLM.';
    },
    setEnabled(value) {
      enabled = value;
      syncButtons();
    },
    setBusy(value) {
      busy = value;
      syncButtons();
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
