const STORAGE_KEY = 'keystone_completed_challenges';
export const PROGRESS_UPDATED_EVENT = 'keystone:progress-updated';

function emitProgressUpdated(): void {
  window.dispatchEvent(new CustomEvent(PROGRESS_UPDATED_EVENT));
}

function readIds(): string[] {
  try {
    const raw: unknown = JSON.parse(localStorage.getItem(STORAGE_KEY) ?? '[]');
    if (!Array.isArray(raw)) return [];
    return [...new Set(raw.filter((id): id is string => typeof id === 'string' && id.length > 0))];
  } catch {
    return [];
  }
}

function persist(ids: readonly string[]): void {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(ids));
  } catch {
    // Storage indisponível: o progresso desta sessão não persiste.
  }
}

export function getCompletedChallenges(): string[] {
  return readIds();
}

export function isChallengeCompleted(challengeId: string): boolean {
  return readIds().includes(challengeId);
}

export function markChallengeCompleted(challengeId: string): void {
  if (!challengeId) return;
  const ids = readIds();
  if (!ids.includes(challengeId)) {
    ids.push(challengeId);
    persist(ids);
  }
  emitProgressUpdated();
}

export function resetProgress(): void {
  try {
    localStorage.removeItem(STORAGE_KEY);
  } catch {
    // ignore
  }
  emitProgressUpdated();
}
