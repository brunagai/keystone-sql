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

const MAX_LISTED_KEYS = 6;

export interface RowAuditInput {
  captured: number;
  expected: number;
  missingKeys: readonly string[];
  extraKeys: readonly string[];
}

export interface AuditFeedback {
  title: string;
  message: string;
}

function formatKeyExamples(keys: readonly string[]): string {
  if (!keys.length) return '';
  const shown = keys.slice(0, MAX_LISTED_KEYS).map((k) => `\`${k}\``).join(', ');
  const rest = keys.length > MAX_LISTED_KEYS ? ` e mais ${keys.length - MAX_LISTED_KEYS}` : '';
  return ` (ex.: ${shown}${rest})`;
}

/** Falsos negativos: a esteira deixou de capturar alertas do gabarito. */
export function describeFalseNegatives(captured: number, missingKeys: readonly string[], expected: number): string {
  const escaped = missingKeys.length > 0 ? missingKeys.length : Math.max(0, expected - captured);
  return (
    `Sua esteira capturou ${captured} transações suspeitas, mas deixou escapar ${escaped} alerta(s) regulatório(s) legítimo(s)` +
    `${formatKeyExamples(missingKeys)}. Verifique se os filtros de data, intervalo de segundos ou limiares de valor não ficaram restritivos demais.`
  );
}

/** Falsos positivos: ruído operacional além do corte do cenário. */
export function describeFalsePositives(extraKeys: readonly string[], extraFallback: number): string {
  const noise = extraKeys.length > 0 ? extraKeys.length : Math.max(0, extraFallback);
  return (
    `Sua esteira gerou ${noise} falso(s) positivo(s) (ruído de monitoramento). Foram incluídas transações legítimas que não atendem aos critérios de corte do cenário` +
    `${formatKeyExamples(extraKeys)}. Revise se faltou algum filtro no WHERE externo ou se a janela temporal precisa de ajuste.`
  );
}

/** Volume da esteira: FN, FP ou os dois. */
export function describeRowAudit(input: RowAuditInput): AuditFeedback {
  const { captured, expected, missingKeys, extraKeys } = input;
  const hasMissing = missingKeys.length > 0 || captured < expected;
  const hasExtra = extraKeys.length > 0 || captured > expected;
  const extraFallback = captured - expected;

  if (hasMissing && hasExtra) {
    return {
      title: 'Esteira com alertas perdidos e ruído operacional',
      message: `${describeFalseNegatives(captured, missingKeys, expected)} ${describeFalsePositives(extraKeys, extraFallback)}`,
    };
  }
  if (hasExtra) {
    return {
      title: 'Falsos positivos / ruído operacional',
      message: describeFalsePositives(extraKeys, extraFallback),
    };
  }
  return {
    title: 'Falsos negativos / alertas não capturados',
    message: describeFalseNegatives(captured, missingKeys, expected),
  };
}

/** Mesmos registros, ordem diferente da fila de priorização PLD. */
export function describePrioritizationMismatch(ordenacao: string): AuditFeedback {
  return {
    title: 'Fila de priorização desalinhada',
    message:
      'Os registros capturados estão corretos, mas a fila de priorização da esteira está desalinhada. ' +
      'No monitoramento de PLD, a ordem é crucial para priorizar os casos mais graves primeiro. ' +
      `Aplique a ordenação esperada: \`ORDER BY ${ordenacao}\`.`,
  };
}
