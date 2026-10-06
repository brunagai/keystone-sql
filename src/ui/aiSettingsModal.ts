import { testConnection } from '../agent/aiService.ts';
import { PROVIDERS, GROQ_MODEL_LABELS, clearAiSettings, isBlockedAiModel, loadAiSettings, saveAiSettings, sanitizeStoredModel } from '../agent/settingsStore.ts';
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
  const modelSelect = byId<HTMLSelectElement>('ai-model');
  const modelCustom = byId<HTMLInputElement>('ai-model-custom');
  const modelCustomHint = document.getElementById('ai-model-custom-hint');
  const keyInput = byId<HTMLInputElement>('ai-key');
  const keyToggle = byId<HTMLButtonElement>('ai-key-toggle');
  const status = byId('ai-settings-status');
  const testButton = byId<HTMLButtonElement>('ai-test');
  const removeButton = byId<HTMLButtonElement>('ai-remove');

  const CUSTOM_MODEL = '__custom__';
  const liveModels: Partial<Record<AiProviderId, readonly string[]>> = {};
  let pointerDownOnBackdrop = false;

  providerSelect.innerHTML = (Object.keys(PROVIDERS) as AiProviderId[])
    .map((id) => `<option value="${id}">${escapeHtml(PROVIDERS[id].label)}</option>`)
    .join('');

  const setStatus = (message: string, tone: StatusTone = 'neutral'): void => {
    status.className = `min-h-5 text-[11px] ${TONE_CLASS[tone]}`;
    status.textContent = message;
  };

  const currentProvider = (): AiProviderId => (providerSelect.value === 'openai' ? 'openai' : 'groq');

  const selectedModel = (): string => {
    if (modelSelect.value === CUSTOM_MODEL) return modelCustom.value.trim();
    return modelSelect.value.trim();
  };

  const showCustomField = (visible: boolean): void => {
    modelCustom.hidden = !visible;
    if (modelCustomHint instanceof HTMLElement) modelCustomHint.hidden = !visible;
    if (visible && dialog.open) modelCustom.focus();
  };

  const uniqueModels = (ids: readonly string[]): string[] => {
    const seen = new Set<string>();
    const out: string[] = [];
    for (const id of ids) {
      if (!id || seen.has(id)) continue;
      seen.add(id);
      out.push(id);
    }
    return out;
  };

  const fillModelOptions = (preferred: string): void => {
    const provider = currentProvider();
    const config = PROVIDERS[provider];
    const known = uniqueModels([
      ...config.suggestedModels,
      ...(liveModels[provider] ?? []).filter((id) => !isBlockedAiModel(id)),
    ]);
    const useCustom = Boolean(preferred) && !known.includes(preferred);
    modelSelect.innerHTML = [
      ...known.map((m) => {
        const label = currentProvider() === 'groq' && GROQ_MODEL_LABELS[m] ? GROQ_MODEL_LABELS[m] : m;
        return `<option value="${escapeHtml(m)}">${escapeHtml(label)}</option>`;
      }),
      `<option value="${CUSTOM_MODEL}">Personalizado…</option>`,
    ].join('');
    modelSelect.disabled = false;
    modelSelect.removeAttribute('readonly');
    modelSelect.classList.remove('pointer-events-none');
    if (useCustom) {
      modelSelect.value = CUSTOM_MODEL;
      modelCustom.value = preferred;
      showCustomField(true);
      return;
    }
    const fallback = known.includes(config.defaultModel) ? config.defaultModel : (known[0] ?? config.defaultModel);
    modelSelect.value = preferred && known.includes(preferred) ? preferred : fallback;
    modelCustom.value = '';
    showCustomField(false);
  };

  const syncProviderHints = (resetModel: boolean): void => {
    const config = PROVIDERS[currentProvider()];
    keyInput.placeholder = `${config.keyPrefix}…`;
    fillModelOptions(resetModel ? config.defaultModel : selectedModel() || config.defaultModel);
  };

  const readForm = (): AiSettings | null => {
    const apiKey = keyInput.value.trim();
    if (!apiKey) return null;
    const provider = currentProvider();
    return { provider, apiKey, model: sanitizeStoredModel(provider, selectedModel() || PROVIDERS[provider].defaultModel) };
  };

  providerSelect.addEventListener('change', () => syncProviderHints(true));
  modelSelect.addEventListener('change', () => {
    showCustomField(modelSelect.value === CUSTOM_MODEL);
  });

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
    if (result.ok && result.models && result.models.length > 0) {
      liveModels[settings.provider] = result.models;
      fillModelOptions(selectedModel() || settings.model);
    }
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

  dialog.addEventListener('mousedown', (event) => {
    pointerDownOnBackdrop = event.target === dialog;
  });
  dialog.addEventListener('click', (event) => {
    const target = event.target;
    if (!(target instanceof Element)) {
      pointerDownOnBackdrop = false;
      return;
    }
    if (target.closest('[data-close-dialog]')) {
      dialog.close();
      pointerDownOnBackdrop = false;
      return;
    }
    if (pointerDownOnBackdrop && target === dialog) dialog.close();
    pointerDownOnBackdrop = false;
  });

  return {
    open() {
      const saved = loadAiSettings();
      providerSelect.value = saved?.provider ?? 'groq';
      keyInput.value = saved?.apiKey ?? '';
      keyInput.type = 'password';
      keyToggle.textContent = 'Mostrar';
      fillModelOptions(saved?.model ?? PROVIDERS[saved?.provider ?? 'groq'].defaultModel);
      keyInput.placeholder = `${PROVIDERS[currentProvider()].keyPrefix}…`;
      setStatus(saved ? 'Chave carregada do localStorage.' : 'Nenhuma chave salva (modo offline).');
      dialog.showModal();
      keyInput.focus();
    },
  };
}
