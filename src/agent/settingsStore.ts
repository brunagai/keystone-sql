import type { AiProviderId, AiSettings } from './types.ts';

const STORAGE_KEY = 'aml-lab:ai-settings';

export interface ProviderConfig {
  label: string;
  baseUrl: string;
  defaultModel: string;
  suggestedModels: readonly string[];
  keyPrefix: string;
  supportsJsonSchema: boolean;
}

export const PROVIDERS: Record<AiProviderId, ProviderConfig> = {
  groq: {
    label: 'Groq',
    baseUrl: 'https://api.groq.com/openai/v1',
    defaultModel: 'llama-3.3-70b-versatile',
    suggestedModels: ['llama-3.3-70b-versatile', 'openai/gpt-oss-120b', 'llama-3.1-8b-instant'],
    keyPrefix: 'gsk_',
    supportsJsonSchema: false,
  },
  openai: {
    label: 'OpenAI',
    baseUrl: 'https://api.openai.com/v1',
    defaultModel: 'gpt-4o-mini',
    suggestedModels: ['gpt-4o-mini', 'gpt-4o', 'gpt-4.1-mini'],
    keyPrefix: 'sk-',
    supportsJsonSchema: true,
  },
};

const isProvider = (value: unknown): value is AiProviderId => value === 'groq' || value === 'openai';

export function loadAiSettings(): AiSettings | null {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return null;
    const parsed: unknown = JSON.parse(raw);
    if (typeof parsed !== 'object' || parsed === null) return null;
    const { provider, model, apiKey } = parsed as Record<string, unknown>;
    if (!isProvider(provider) || typeof apiKey !== 'string' || !apiKey) return null;
    return { provider, apiKey, model: typeof model === 'string' && model ? model : PROVIDERS[provider].defaultModel };
  } catch {
    return null;
  }
}

export function saveAiSettings(settings: AiSettings): void {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(settings));
}

export function clearAiSettings(): void {
  localStorage.removeItem(STORAGE_KEY);
}

/** Exibe apenas prefixo e sufixo da chave (ex.: `gsk_…9f2c`). */
export function maskApiKey(key: string): string {
  return key.length <= 10 ? '••••' : `${key.slice(0, 4)}…${key.slice(-4)}`;
}
