import type { Database } from 'sql.js';
import { extractOrderBy, findForbiddenCommand, runIsolated } from '../database/safeQuery.ts';
import type { GeneratedChallenge } from './types.ts';

export const MAX_SOLUTION_ROWS = 150;

export type VerificationResult =
  | { ok: true; challenge: GeneratedChallenge; rowCount: number }
  /** `reason` é escrito para ser devolvido ao modelo como instrução de correção. */
  | { ok: false; reason: string };

/**
 * Garante que a solutionQuery é somente leitura, executa no SQLite em memória,
 * retorna um conjunto não vazio e razoável, e é determinística (ORDER BY externo).
 */
export function verifyChallenge(db: Database, challenge: GeneratedChallenge): VerificationResult {
  const sql = challenge.solutionQuery;
  const forbidden = findForbiddenCommand(sql);
  if (forbidden) return { ok: false, reason: `A solutionQuery usa o comando proibido ${forbidden}. Use apenas SELECT/WITH.` };
  if (!extractOrderBy(sql)) {
    return { ok: false, reason: 'A solutionQuery não tem ORDER BY externo. Adicione uma ordenação determinística (com desempate).' };
  }

  let columns: string[];
  let rowCount: number;
  try {
    const last = runIsolated(db, () => db.exec(sql)).at(-1);
    columns = last?.columns ?? [];
    rowCount = last?.values.length ?? 0;
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    return { ok: false, reason: `A solutionQuery falhou no SQLite com o erro: "${message}". Corrija usando apenas o schema e funções do SQLite.` };
  }

  if (rowCount === 0) {
    return {
      ok: false,
      reason:
        'A solutionQuery executou mas retornou 0 linhas no dataset. Ajuste os limiares/filtros para valores coerentes com o perfil de dados informado.',
    };
  }
  if (rowCount > MAX_SOLUTION_ROWS) {
    return {
      ok: false,
      reason: `A solutionQuery retornou ${rowCount} linhas (máximo ${MAX_SOLUTION_ROWS}). Torne o critério mais específico para isolar evidências relevantes.`,
    };
  }

  const declared = challenge.criteriosValidacao.colunasEsperadas;
  if (declared.length !== columns.length) {
    return {
      ok: false,
      reason: `colunasEsperadas declara ${declared.length} colunas (${declared.join(', ')}), mas a solutionQuery retorna ${columns.length}: ${columns.join(', ')}. Alinhe os dois.`,
    };
  }

  return {
    ok: true,
    rowCount,
    challenge: { ...challenge, criteriosValidacao: { ...challenge.criteriosValidacao, colunasEsperadas: columns } },
  };
}
