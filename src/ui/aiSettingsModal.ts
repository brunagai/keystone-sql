import { testConnection } from '../agent/aiService.ts';
import { PROVIDERS, clearAiSettings, loadAiSettings, saveAiSettings } from '../agent/settingsStore.ts';
import type { AiProviderId, AiSettings } from '../agent/types.ts';
import { byId } from './dom.ts';
import { escapeHtml } from './format.ts';

export interface AiSettingsModalController {
  open(): void;
}

type StatusTone = 'neutral' | 'ok' | 'error' | 'pending';

const TONE_CLASS: Record<StatusTone, string> = {
  neutral: 'text-slate-500',
  ok: 'text-emerald-300',
  error: 'text-rose-300',
  pending: 'text-sky-300',
};

export function initAiSettingsModal(onChange: (settings: AiSettings | null) => void): AiSettingsModalController {
  const dialog = byId<HTMLDialogElement>('ai-settings-dialog');
  const form = byId<HTMLFormElement>('ai-settings-form');
  const providerSelect = byId<HTMLSelectElement>('ai-provider');
  const modelInput = byId<HTMLInputElement>('ai-model');
  const modelOptions = byId<HTMLDataListElement>('ai-model-options');
  const keyInput = byId<HTMLInputElement>('ai-key');
  const keyToggle = byId<HTMLButtonElement>('ai-key-toggle');
  const status = byId('ai-settings-status');
  const testButton = byId<HTMLButtonElement>('ai-test');
  const removeButton = byId<HTMLButtonElement>('ai-remove');

  providerSelect.innerHTML = (Object.keys(PROVIDERS) as AiProviderId[])
    .map((id) => `<option value="${id}">${escapeHtml(PROVIDERS[id].label)}</option>`)
    .join('');

  const setStatus = (message: string, tone: StatusTone = 'neutral'): void => {
    status.className = `min-h-5 text-[11px] ${TONE_CLASS[tone]}`;
    status.textContent = message;
  };

  const currentProvider = (): AiProviderId => (providerSelect.value === 'openai' ? 'openai' : 'groq');

  const syncProviderHints = (resetModel: boolean): void => {
    const config = PROVIDERS[currentProvider()];
    modelOptions.innerHTML = config.suggestedModels.map((m) => `<option value="${escapeHtml(m)}"></option>`).join('');
    keyInput.placeholder = `${config.keyPrefix}…`;
    if (resetModel || !modelInput.value.trim()) modelInput.value = config.defaultModel;
  };

  const readForm = (): AiSettings | null => {
    const apiKey = keyInput.value.trim();
    if (!apiKey) return null;
    const provider = currentProvider();
    return { provider, apiKey, model: modelInput.value.trim() || PROVIDERS[provider].defaultModel };
  };

  providerSelect.addEventListener('change', () => syncProviderHints(true));

  keyToggle.addEventListener('click', () => {
    const show = keyInput.type === 'password';
    keyInput.type = show ? 'text' : 'password';
    keyToggle.textContent = show ? 'Ocultar' : 'Mostrar';
  });

  testButton.addEventListener('click', async () => {
    const settings = readForm();
    if (!settings) {
      setStatus('Informe uma API Key para testar.', 'error');
      return;
    }
    testButton.disabled = true;
    setStatus('Testando conexão…', 'pending');
    const result = await testConnection(settings);
    setStatus(result.message, result.ok ? 'ok' : 'error');
    testButton.disabled = false;
  });

  removeButton.addEventListener('click', () => {
    clearAiSettings();
    keyInput.value = '';
    setStatus('Chave removida deste navegador. O agente usará o gerador offline.', 'ok');
    onChange(null);
  });

  form.addEventListener('submit', (event) => {
    event.preventDefault();
    const settings = readForm();
    if (!settings) {
      setStatus('Informe uma API Key ou use "Remover chave" para o modo offline.', 'error');
      return;
    }
    const prefix = PROVIDERS[settings.provider].keyPrefix;
    saveAiSettings(settings);
    onChange(settings);
    if (!settings.apiKey.startsWith(prefix)) {
      setStatus(`Salvo. Atenção: chaves ${PROVIDERS[settings.provider].label} costumam começar com "${prefix}".`, 'error');
      return;
    }
    dialog.close();
  });

  dialog.addEventListener('click', (event) => {
    const target = event.target as HTMLElement;
    if (target === dialog || target.closest('[data-close-dialog]')) dialog.close();
  });

  return {
    open() {
      const saved = loadAiSettings();
      providerSelect.value = saved?.provider ?? 'groq';
      modelInput.value = saved?.model ?? '';
      keyInput.value = saved?.apiKey ?? '';
      keyInput.type = 'password';
      keyToggle.textContent = 'Mostrar';
      syncProviderHints(false);
      setStatus(saved ? 'Chave carregada do localStorage.' : 'Nenhuma chave salva (modo offline).');
      dialog.showModal();
      keyInput.focus();
    },
  };
}
