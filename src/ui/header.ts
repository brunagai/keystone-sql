import { byId } from './dom.ts';

export type ConnectionState = 'loading' | 'ready' | 'error';

const STATUS_VIEW: Record<ConnectionState, { dot: string; ping: boolean; label: string; text: string }> = {
  loading: { dot: 'bg-amber-400', ping: true, label: 'Carregando', text: 'text-amber-300' },
  ready: { dot: 'bg-emerald-400', ping: false, label: 'Online', text: 'text-emerald-400' },
  error: { dot: 'bg-rose-500', ping: false, label: 'Offline', text: 'text-rose-300' },
};

export interface HeaderController {
  setConnectionState(state: ConnectionState): void;
}

export function initHeader(): HeaderController {
  const status = byId('wasm-status');

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
  };
}
