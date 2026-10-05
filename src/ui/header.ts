import { PROVIDERS } from '../agent/settingsStore.ts';
import type { AiSettings } from '../agent/types.ts';
import { byId } from './dom.ts';
import { formatInteiro } from './format.ts';
import { bindPopover } from './popover.ts';

export type ConnectionState = 'loading' | 'ready' | 'error';

const STATUS_VIEW: Record<ConnectionState, { dot: string; ping: boolean; label: string; text: string }> = {
  loading: { dot: 'bg-amber-400', ping: true, label: 'Carregando', text: 'text-amber-300' },
  ready: { dot: 'bg-emerald-400', ping: false, label: 'Online', text: 'text-emerald-400' },
  error: { dot: 'bg-rose-500', ping: false, label: 'Offline', text: 'text-rose-300' },
};

export interface DatasetCounts {
  contas: number;
  transacoes: number;
}

export interface HeaderController {
  setConnectionState(state: ConnectionState): void;
  setDatasetCounts(counts: DatasetCounts | null): void;
  setResetEnabled(enabled: boolean): void;
  setAiSettings(settings: AiSettings | null): void;
}

export interface HeaderHandlers {
  onReset: () => void;
  onOpenAiSettings: () => void;
}

export function initHeader({ onReset, onOpenAiSettings }: HeaderHandlers): HeaderController {
  const status = byId('wasm-status');
  const meta = byId('dataset-meta');
  const resetButton = byId<HTMLButtonElement>('btn-reset');
  const aiButton = byId<HTMLButtonElement>('btn-ai-settings');
  const aiIndicator = byId('ai-key-indicator');

  resetButton.addEventListener('click', onReset);
  const settingsMenu = bindPopover(byId<HTMLButtonElement>('btn-settings'), byId('settings-menu'));
  aiButton.addEventListener('click', () => {
    settingsMenu.close();
    onOpenAiSettings();
  });

  const badge = (label: string, value: number): string => `
    <span class="flex items-center gap-1.5 rounded-md bg-slate-900 px-2 py-1 text-[11px]">
      <span class="text-slate-500">${label}</span>
      <span class="font-mono tabular-nums text-slate-200">${formatInteiro(value)}</span>
    </span>`;

  return {
    setConnectionState(state) {
      const view = STATUS_VIEW[state];
      status.innerHTML = `
        <span class="relative flex size-2">
          ${view.ping ? `<span class="absolute inline-flex size-full animate-ping rounded-full ${view.dot} opacity-60"></span>` : ''}
          <span class="relative inline-flex size-2 rounded-full ${view.dot}"></span>
        </span>
        <span class="text-[11px] font-medium ${view.text}">${view.label}</span>`;
    },
    setDatasetCounts(counts) {
      meta.innerHTML = counts ? badge('contas', counts.contas) + badge('transações', counts.transacoes) : '';
    },
    setResetEnabled(enabled) {
      resetButton.disabled = !enabled;
    },
    setAiSettings(settings) {
      const description = settings
        ? `Chave ${PROVIDERS[settings.provider].label} salva neste navegador (modelo ${settings.model})`
        : 'Nenhuma chave salva: agente em modo offline';
      aiIndicator.className = `inline-block size-1.5 rounded-full ${settings ? 'bg-emerald-400' : 'bg-slate-500'}`;
      aiButton.title = description;
      aiButton.setAttribute('aria-label', `Configurar IA (Groq / OpenAI). ${description}.`);
    },
  };
}
