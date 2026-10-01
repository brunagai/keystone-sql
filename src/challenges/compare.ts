import type { QueryExecResult, SqlValue } from 'sql.js';

/** Tolerância absoluta para valores monetários e razões arredondadas em 2 casas. */
export const NUMERIC_TOLERANCE = 0.01;

const NUMERIC_STRING = /^-?\d+(?:\.\d+)?$/;

function toNumber(value: SqlValue): number | null {
  if (typeof value === 'number') return value;
  if (typeof value === 'string' && NUMERIC_STRING.test(value.trim())) return Number(value);
  return null;
}

export function cellsEqual(a: SqlValue, b: SqlValue): boolean {
  if (a === null || b === null) return a === b;
  if (a instanceof Uint8Array || b instanceof Uint8Array) return false;
  const na = toNumber(a);
  const nb = toNumber(b);
  if (na !== null && nb !== null) return Math.abs(na - nb) <= NUMERIC_TOLERANCE + 1e-9;
  return String(a).trim() === String(b).trim();
}

/** Representação canônica de uma célula para comparações independentes de ordem. */
function cellToken(value: SqlValue): string {
  if (value === null) return '∅';
  if (value instanceof Uint8Array) return `blob:${value.length}`;
  const n = toNumber(value);
  return n === null ? `s:${String(value).trim()}` : `n:${Math.round(n * 100) / 100}`;
}

export const normalizeColumnName = (name: string): string => name.trim().toLowerCase();

function columnMatches(expected: QueryExecResult, student: QueryExecResult, j: number, k: number): boolean {
  return expected.values.every((row, i) => cellsEqual(row[j] ?? null, student.values[i]?.[k] ?? null));
}

/**
 * Para cada coluna do gabarito, encontra a coluna do aluno com os mesmos valores (mesma ordem de linhas).
 * Prioriza a mesma posição, depois o mesmo nome (case-insensitive), depois qualquer coluna livre.
 */
export function mapColumns(expected: QueryExecResult, student: QueryExecResult): (number | null)[] {
  const used = new Set<number>();
  return expected.columns.map((name, j) => {
    const byName = student.columns.findIndex((c) => normalizeColumnName(c) === normalizeColumnName(name));
    const candidates = [j, byName, ...student.columns.keys()];
    for (const k of candidates) {
      if (k < 0 || k >= student.columns.length || used.has(k)) continue;
      if (columnMatches(expected, student, j, k)) {
        used.add(k);
        return k;
      }
    }
    return null;
  });
}

/** Verdadeiro se cada linha do gabarito tem uma linha correspondente no aluno, ignorando ordem de linhas e colunas. */
export function rowsMatchIgnoringOrder(expected: QueryExecResult, student: QueryExecResult): boolean {
  if (expected.values.length !== student.values.length) return false;
  const studentRows = student.values.map((row) => row.map(cellToken));
  const used = new Set<number>();

  return expected.values.every((row) => {
    const needed = row.map(cellToken);
    const match = studentRows.findIndex((candidate, idx) => {
      if (used.has(idx)) return false;
      const pool = [...candidate];
      return needed.every((token) => {
        const pos = pool.indexOf(token);
        if (pos < 0) return false;
        pool.splice(pos, 1);
        return true;
      });
    });
    if (match < 0) return false;
    used.add(match);
    return true;
  });
}

/** Localiza no resultado do aluno a coluna com maior sobreposição com a coluna-chave do gabarito. */
export function findKeyColumn(student: QueryExecResult, expectedKeys: ReadonlySet<string>, preferredName: string): number {
  const byName = student.columns.findIndex((c) => normalizeColumnName(c) === normalizeColumnName(preferredName));
  if (byName >= 0) return byName;

  let best = -1;
  let bestOverlap = 0;
  student.columns.forEach((_, k) => {
    const overlap = student.values.filter((row) => expectedKeys.has(String(row[k]))).length;
    if (overlap > bestOverlap) {
      best = k;
      bestOverlap = overlap;
    }
  });
  return best;
}
