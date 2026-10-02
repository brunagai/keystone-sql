import type { Database } from 'sql.js';
import { ChallengeFormatError, GENERATED_CHALLENGE_JSON_SCHEMA, parseGeneratedChallenge } from './challengeSchema.ts';
import { verifyChallenge } from './challengeVerifier.ts';
import { generateOfflineChallenge } from './offlineGenerator.ts';
import { buildSystemPrompt, buildUserPrompt } from './prompt.ts';
import { PROVIDERS } from './settingsStore.ts';
import type { AiSettings, GenerationOutcome, GenerationProgress, GenerationRequest } from './types.ts';

const MAX_ATTEMPTS = 3;
const REQUEST_TIMEOUT_MS = 60_000;

export type AiErrorKind = 'auth' | 'rate_limit' | 'network' | 'http' | 'timeout' | 'aborted' | 'format';

export class AiServiceError extends Error {
  override name = 'AiServiceError';
  constructor(
    message: string,
    readonly kind: AiErrorKind,
  ) {
    super(message);
  }
}

interface ChatMessage {
  role: 'system' | 'user' | 'assistant';
  content: string;
}

function withTimeout(signal: AbortSignal | undefined): AbortSignal {
  const timeout = AbortSignal.timeout(REQUEST_TIMEOUT_MS);
  return signal ? AbortSignal.any([signal, timeout]) : timeout;
}

async function request(settings: AiSettings, path: string, init: RequestInit, signal?: AbortSignal): Promise<unknown> {
  const { baseUrl, label } = PROVIDERS[settings.provider];
  let response: Response;
  try {
    response = await fetch(`${baseUrl}${path}`, {
      ...init,
      headers: { Authorization: `Bearer ${settings.apiKey}`, 'Content-Type': 'application/json' },
      signal: withTimeout(signal),
    });
  } catch (error) {
    if (error instanceof DOMException && error.name === 'TimeoutError') {
      throw new AiServiceError(`${label} não respondeu em ${REQUEST_TIMEOUT_MS / 1000}s.`, 'timeout');
    }
    if (error instanceof DOMException && error.name === 'AbortError') throw new AiServiceError('Operação cancelada.', 'aborted');
    throw new AiServiceError(`Falha de rede ao contatar ${label} (verifique a conexão).`, 'network');
  }

  if (response.status === 401 || response.status === 403) throw new AiServiceError(`${label} recusou a API Key (HTTP ${response.status}).`, 'auth');
  if (response.status === 429) throw new AiServiceError(`Limite de requisições do ${label} atingido. Aguarde e tente novamente.`, 'rate_limit');
  if (!response.ok) {
    const detail = await response.text().catch(() => '');
    throw new AiServiceError(`${label} retornou HTTP ${response.status}. ${detail.slice(0, 200)}`, 'http');
  }
  return response.json();
}

async function chatCompletion(settings: AiSettings, messages: ChatMessage[], signal?: AbortSignal): Promise<string> {
  const provider = PROVIDERS[settings.provider];
  const data = await request(
    settings,
    '/chat/completions',
    {
      method: 'POST',
      body: JSON.stringify({
        model: settings.model,
        messages,
        temperature: 0.7,
        response_format: provider.supportsJsonSchema
          ? { type: 'json_schema', json_schema: GENERATED_CHALLENGE_JSON_SCHEMA }
          : { type: 'json_object' },
      }),
    },
    signal,
  );

  const message = (data as { choices?: { message?: { content?: unknown; refusal?: unknown } }[] }).choices?.[0]?.message;
  if (typeof message?.refusal === 'string' && message.refusal) throw new AiServiceError(`O modelo recusou: ${message.refusal}`, 'format');
  if (typeof message?.content !== 'string' || !message.content.trim()) throw new AiServiceError('Resposta vazia do modelo.', 'format');
  return message.content;
}

export interface ConnectionTestResult {
  ok: boolean;
  message: string;
}

export async function testConnection(settings: AiSettings, signal?: AbortSignal): Promise<ConnectionTestResult> {
  const { label } = PROVIDERS[settings.provider];
  try {
    const data = await request(settings, '/models', { method: 'GET' }, signal);
    const models = ((data as { data?: { id?: unknown }[] }).data ?? []).map((m) => String(m.id));
    if (models.length && !models.includes(settings.model)) {
      return { ok: false, message: `Chave válida, mas o modelo "${settings.model}" não está disponível no ${label}.` };
    }
    return { ok: true, message: `Conectado ao ${label} · modelo ${settings.model} disponível.` };
  } catch (error) {
    return { ok: false, message: error instanceof Error ? error.message : String(error) };
  }
}

export interface GenerateOptions {
  settings: AiSettings | null;
  signal?: AbortSignal;
  onProgress?: GenerationProgress;
}

const newId = (prefix: string): string => `${prefix}-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 6)}`;
const yieldToBrowser = (): Promise<void> => new Promise((resolve) => setTimeout(resolve, 0));

async function offline(db: Database, req: GenerationRequest, reason: string, attempts: number, onProgress?: GenerationProgress): Promise<GenerationOutcome> {
  onProgress?.('Montando o desafio com o motor offline e rodando o Sanity Check no SQLite…');
  await yieldToBrowser();
  const challenge = generateOfflineChallenge(db, req);
  return { challenge: { ...challenge, id: newId('offline') }, source: 'offline', fallbackReason: reason, attempts };
}

/**
 * Gera um desafio via LLM (com até 3 tentativas de autocorreção a partir dos erros do SQLite)
 * e recorre ao gerador offline quando não há chave, a API falha ou o gabarito não é executável.
 * Cancelamento pelo usuário (`signal`) interrompe tudo, sem fallback.
 */
export async function generateChallenge(db: Database, req: GenerationRequest, options: GenerateOptions): Promise<GenerationOutcome> {
  const { settings, signal, onProgress } = options;
  onProgress?.('Agente analisando tipologias do Bacen e transações do dataset…');
  await yieldToBrowser();
  if (!settings) return offline(db, req, 'Nenhuma API Key configurada.', 0, onProgress);

  const { label } = PROVIDERS[settings.provider];
  const messages: ChatMessage[] = [
    { role: 'system', content: buildSystemPrompt(db, req.difficulty) },
    { role: 'user', content: buildUserPrompt(req) },
  ];
  let lastProblem = '';

  for (let attempt = 1; attempt <= MAX_ATTEMPTS; attempt++) {
    onProgress?.(
      attempt === 1
        ? `${label} (${settings.model}) redigindo o caso a partir das tipologias do Bacen…`
        : `Sanity Check reprovou o gabarito; pedindo correção ao modelo (tentativa ${attempt}/${MAX_ATTEMPTS})…`,
    );

    let raw: string;
    try {
      raw = await chatCompletion(settings, messages, signal);
    } catch (error) {
      if (error instanceof AiServiceError && error.kind === 'aborted') throw error;
      const reason = error instanceof Error ? error.message : String(error);
      return offline(db, req, reason, attempt, onProgress);
    }

    onProgress?.('Sanity Check: executando o gabarito gerado no SQLite em memória…');
    await yieldToBrowser();
    try {
      const verification = verifyChallenge(db, parseGeneratedChallenge(raw), req.difficulty);
      if (verification.ok) {
        return { challenge: { ...verification.challenge, id: newId('ia') }, source: 'ia', model: settings.model, attempts: attempt };
      }
      lastProblem = verification.reason;
    } catch (error) {
      if (!(error instanceof ChallengeFormatError)) throw error;
      lastProblem = `Formato inválido: ${error.message}`;
    }

    messages.push(
      { role: 'assistant', content: raw },
      { role: 'user', content: `Correção necessária: ${lastProblem}\nDevolva o JSON completo corrigido, no mesmo formato.` },
    );
  }

  return offline(db, req, `A IA não gerou um gabarito executável após ${MAX_ATTEMPTS} tentativas (${lastProblem})`, MAX_ATTEMPTS, onProgress);
}
