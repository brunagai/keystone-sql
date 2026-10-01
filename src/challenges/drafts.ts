import { sameSql, stripSqlComments } from '../database/sqlText.ts';
import type { ScenarioId } from './scenarios.ts';

const STORAGE_KEY = 'aml-lab:drafts';

const drafts = new Map<ScenarioId, string>(loadDrafts());

function loadDrafts(): [ScenarioId, string][] {
  try {
    const raw: unknown = JSON.parse(localStorage.getItem(STORAGE_KEY) ?? '{}');
    if (typeof raw !== 'object' || raw === null || Array.isArray(raw)) return [];
    return Object.entries(raw).filter((entry): entry is [ScenarioId, string] => typeof entry[1] === 'string');
  } catch {
    return [];
  }
}

function persist(): void {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(Object.fromEntries(drafts)));
  } catch {
    // Storage indisponível: os rascunhos continuam válidos em memória nesta sessão.
  }
}

export function getDraft(id: ScenarioId): string | undefined {
  return drafts.get(id);
}

/** Guarda o rascunho; textos vazios ou idênticos ao template não ocupam espaço. */
export function saveDraft(id: ScenarioId, sql: string, template: string): void {
  if (!stripSqlComments(sql) || sameSql(sql, template)) {
    if (drafts.delete(id)) persist();
    return;
  }
  if (drafts.get(id) === sql) return;
  drafts.set(id, sql);
  persist();
}

export function pruneDrafts(validIds: ReadonlySet<ScenarioId>): void {
  const before = drafts.size;
  for (const id of drafts.keys()) if (!validIds.has(id)) drafts.delete(id);
  if (drafts.size !== before) persist();
}
