import type { AiProviderId, AiSettings } from './types.ts';

const STORAGE_KEY = 'aml-lab:ai-settings';
const MODEL_STORAGE_KEY = 'keystone_ai_model';

export const GROQ_DEFAULT_MODEL = 'openai/gpt-oss-120b';

export const GROQ_OFFICIAL_MODELS = [
  'openai/gpt-oss-120b',
  'openai/gpt-oss-20b',
  'qwen/qwen3.8-27b',
] as const;

export const GROQ_MODEL_LABELS: Record<string, string> = {
  'openai/gpt-oss-120b': 'openai/gpt-oss-120b (recomendado · SQL e raciocínio)',
  'openai/gpt-oss-20b': 'openai/gpt-oss-20b (ultra-rápido)',
  'qwen/qwen3.8-27b': 'qwen/qwen3.8-27b',
};

const BLOCKED_MODEL = /whisper|orpheus|safeguard|prompt-guard|guard|audio|vision/i;

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
    defaultModel: GROQ_DEFAULT_MODEL,
    suggestedModels: GROQ_OFFICIAL_MODELS,
    keyPrefix: 'gsk_',
    supportsJsonSchema: false,
  },
  openai: {
    label: 'OpenAI',
    baseUrl: 'https://api.openai.com/v1',
    defaultModel: 'gpt-4o-mini',
    suggestedModels: ['gpt-4o-mini', 'gpt-4o'],
    keyPrefix: 'sk-',
    supportsJsonSchema: true,
  },
};

const isProvider = (value: unknown): value is AiProviderId => value === 'groq' || value === 'openai';

/** Modelos de voz, visão ou moderação não servem para gerar desafios SQL. */
export function isBlockedAiModel(id: string): boolean {
  return BLOCKED_MODEL.test(id);
}

export function sanitizeStoredModel(provider: AiProviderId, model: string): string {
  const trimmed = model.trim();
  if (!trimmed || isBlockedAiModel(trimmed)) {
    return PROVIDERS[provider].defaultModel;
  }
  return trimmed;
}

export function loadAiSettings(): AiSettings | null {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return null;
    const parsed: unknown = JSON.parse(raw);
    if (typeof parsed !== 'object' || parsed === null) return null;
    const { provider, model, apiKey } = parsed as Record<string, unknown>;
    if (!isProvider(provider) || typeof apiKey !== 'string' || !apiKey) return null;
    const storedModel = typeof model === 'string' && model ? model : localStorage.getItem(MODEL_STORAGE_KEY);
    const rawModel = storedModel && storedModel.trim() ? storedModel.trim() : '';
    const safeModel = sanitizeStoredModel(provider, rawModel || PROVIDERS[provider].defaultModel);
    const settings: AiSettings = { provider, apiKey, model: safeModel };
    if (safeModel !== rawModel) {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(settings));
      localStorage.setItem(MODEL_STORAGE_KEY, safeModel);
    }
    return settings;
  } catch {
    return null;
  }
}

export function saveAiSettings(settings: AiSettings): void {
  const model = sanitizeStoredModel(settings.provider, settings.model);
  const next: AiSettings = { ...settings, model };
  localStorage.setItem(STORAGE_KEY, JSON.stringify(next));
  localStorage.setItem(MODEL_STORAGE_KEY, next.model);
}

export function clearAiSettings(): void {
  localStorage.removeItem(STORAGE_KEY);
  localStorage.removeItem(MODEL_STORAGE_KEY);
}
