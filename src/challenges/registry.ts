import { toScenario, type StoredChallenge } from '../agent/challengeAdapter.ts';
import { parseGeneratedChallenge } from '../agent/challengeSchema.ts';
import type { GenerationOutcome } from '../agent/types.ts';
import { SCENARIOS, type InvestigationScenario } from './scenarios.ts';

const STORAGE_KEY = 'aml-lab:generated-challenges';
const MAX_STORED = 20;

type Listener = () => void;

const listeners = new Set<Listener>();
let stored: StoredChallenge[] = loadStored();
let generated: InvestigationScenario[] = stored.map(toScenario);

function loadStored(): StoredChallenge[] {
  try {
    const raw: unknown = JSON.parse(localStorage.getItem(STORAGE_KEY) ?? '[]');
    if (!Array.isArray(raw)) return [];
    return raw.flatMap((item: unknown): StoredChallenge[] => {
      if (typeof item !== 'object' || item === null) return [];
      const { challenge, source, model, createdAt } = item as Record<string, unknown>;
      if (source !== 'ia' && source !== 'offline') return [];
      try {
        const parsed = parseGeneratedChallenge(JSON.stringify(challenge));
        if (!parsed.id) return [];
        return [
          {
            challenge: parsed,
            source,
            createdAt: typeof createdAt === 'string' ? createdAt : new Date().toISOString(),
            ...(typeof model === 'string' ? { model } : {}),
          },
        ];
      } catch {
        return [];
      }
    });
  } catch {
    return [];
  }
}

function persist(): void {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(stored));
  } catch {
    // Quota excedida ou storage indisponível: os desafios continuam disponíveis nesta sessão.
  }
  generated = stored.map(toScenario);
  listeners.forEach((fn) => fn());
}

export function baseScenarios(): readonly InvestigationScenario[] {
  return SCENARIOS;
}

export function generatedScenarios(): readonly InvestigationScenario[] {
  return generated;
}

export function allScenarios(): readonly InvestigationScenario[] {
  return [...SCENARIOS, ...generated];
}

export function findScenario(id: string): InvestigationScenario | undefined {
  return allScenarios().find((s) => s.id === id);
}

export function addGenerated(outcome: GenerationOutcome): InvestigationScenario {
  const entry: StoredChallenge = {
    challenge: outcome.challenge,
    source: outcome.source,
    createdAt: new Date().toISOString(),
    ...(outcome.model ? { model: outcome.model } : {}),
  };
  stored = [entry, ...stored].slice(0, MAX_STORED);
  persist();
  return toScenario(entry);
}

export function removeGenerated(id: string): void {
  stored = stored.filter((s) => s.challenge.id !== id);
  persist();
}

export function onScenariosChange(listener: Listener): () => void {
  listeners.add(listener);
  return () => listeners.delete(listener);
}
