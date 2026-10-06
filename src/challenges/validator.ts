import type { Database, QueryExecResult } from 'sql.js';
import { findForbiddenCommand, runIsolated } from '../database/safeQuery.ts';
import {
  describeAliasPractice,
  describePrioritizationMismatch,
  describeRowAudit,
  findKeyColumn,
  formatComplianceBanner,
  computeComplianceMetrics,
  mapColumns,
  mapColumnsByContent,
  normalizeColumnName,
  rowsMatchIgnoringOrder,
  type ComplianceMetrics,
} from './compare.ts';
import type { InvestigationScenario } from './scenarios.ts';
import { describeSqlError, type ErrorHighlight } from './sqlErrors.ts';

export type ValidationStatus = 'success' | 'warning' | 'error' | 'quase_la';

export type StudentRun =
  | { ok: true; results: QueryExecResult[]; elapsedMs: number }
  | { ok: false; error: string; elapsedMs: number };

export interface ValidationResult {
  status: ValidationStatus;
  title: string;
  /** Aceita `código` inline. */
  message: string;
  details: string[];
  entities: string[];
  highlight: ErrorHighlight | null;
  /** Métricas da esteira no card verde (sucesso). */
  compliance?: ComplianceMetrics;
  /** Execução da query do aluno, para exibição no painel de resultados. */
  studentRun: StudentRun | null;
}

const MAX_LISTED_ENTITIES = 6;

const expectedCache = new WeakMap<Database, Map<string, QueryExecResult>>();

function getExpected(db: Database, scenario: InvestigationScenario): QueryExecResult {
  let perDb = expectedCache.get(db);
  if (!perDb) {
    perDb = new Map();
    expectedCache.set(db, perDb);
  }
  const cached = perDb.get(scenario.id);
  if (cached) return cached;

  const result = db.exec(scenario.gabaritoSql).at(-1) ?? { columns: [...scenario.colunasEsperadas], values: [] };
  perDb.set(scenario.id, result);
  return result;
}

const yieldToBrowser = (): Promise<void> => new Promise((resolve) => setTimeout(resolve, 0));

const listEntities = (keys: string[], prefix: string): string => {
  const shown = keys.slice(0, MAX_LISTED_ENTITIES).map((k) => `\`${k}\``).join(', ');
  const rest = keys.length > MAX_LISTED_ENTITIES ? ` e mais ${keys.length - MAX_LISTED_ENTITIES}` : '';
  return `${prefix}: ${shown}${rest}.`;
};

interface EntityDiff {
  keyFound: boolean;
  missing: string[];
  extra: string[];
}

function diffEntities(scenario: InvestigationScenario, expected: QueryExecResult, student: QueryExecResult): EntityDiff {
  const keyIndex = expected.columns.indexOf(scenario.colunaChave);
  if (keyIndex < 0) return { keyFound: false, missing: [], extra: [] };
  const expectedKeys = new Set(expected.values.map((r) => String(r[keyIndex])));
  const studentKeyIndex = findKeyColumn(student, expectedKeys, scenario.colunaChave);
  if (studentKeyIndex < 0) return { keyFound: false, missing: [], extra: [] };

  const studentKeys = new Set(student.values.map((r) => String(r[studentKeyIndex])));
  return {
    keyFound: true,
    missing: [...expectedKeys].filter((k) => !studentKeys.has(k)),
    extra: [...studentKeys].filter((k) => !expectedKeys.has(k)),
  };
}

function describeEntityDiff(scenario: InvestigationScenario, diff: EntityDiff): string[] {
  if (!diff.keyFound) {
    return [`Não encontrei no seu resultado a coluna \`${scenario.colunaChave}\` (nem valores equivalentes). Projete-a para que os registros possam ser conferidos.`];
  }
  const lines: string[] = [];
  if (diff.missing.length) lines.push(listEntities(diff.missing, 'Ausentes no seu resultado'));
  if (diff.extra.length) lines.push(listEntities(diff.extra, 'Presentes no seu resultado, mas fora do gabarito'));
  return lines;
}

function successWithNotes(
  scenario: InvestigationScenario,
  expected: QueryExecResult,
  student: QueryExecResult,
  mapping: readonly (number | null)[],
  extraNotes: readonly string[],
): Omit<ValidationResult, 'studentRun' | 'highlight'> {
  const summary = scenario.resumirSucesso(expected);
  const details = [...extraNotes];
  const complete = mapping.every((k) => k != null);

  if (complete) {
    const extraCols = student.columns.filter((_, k) => !mapping.includes(k));
    if (extraCols.length) {
      details.push(`Dica de boas práticas: as colunas extras \`${extraCols.join(', ')}\` não eram necessárias.`);
    }

    const aliasPair = expected.columns.flatMap((name, j) => {
      const k = mapping[j];
      if (k == null) return [];
      const returned = student.columns[k] ?? '';
      return normalizeColumnName(returned) !== normalizeColumnName(name) ? [{ expected: name, returned }] : [];
    })[0];
    if (aliasPair) details.unshift(describeAliasPractice(aliasPair.expected, aliasPair.returned));

    if (mapping.some((k, j) => k !== j)) {
      details.push('As colunas estão em ordem diferente da sugerida, mas o conteúdo confere.');
    }
  }

  details.push(...(summary.details ?? []));
  const captured = expected.values.length;
  const compliance = computeComplianceMetrics(captured, captured, 0);
  return {
    status: 'success',
    title: formatComplianceBanner(compliance),
    message: summary.message,
    details,
    entities: summary.entities,
    compliance,
  };
}

function formatColumnList(columns: readonly string[]): string {
  return `[${columns.join(', ')}]`;
}

function columnsMatchReport(expected: QueryExecResult, student: QueryExecResult): boolean {
  if (expected.columns.length !== student.columns.length) return false;
  return expected.columns.every(
    (name, index) => normalizeColumnName(name) === normalizeColumnName(student.columns[index] ?? ''),
  );
}

function namesPresent(expected: QueryExecResult, student: QueryExecResult): boolean {
  const have = new Set(student.columns.map((name) => normalizeColumnName(name)));
  return expected.columns.every((name) => have.has(normalizeColumnName(name)));
}

function reportShapeMismatch(
  expected: QueryExecResult,
  student: QueryExecResult,
): Omit<ValidationResult, 'studentRun' | 'highlight'> {
  return {
    status: 'quase_la',
    title: '🔍 Quase lá! Dados e lógica analítica corretos',
    message:
      'Identificou e filtrou os registos solicitados com precisão. Contudo, o relatório de auditoria/compliance exige uma estrutura de colunas específica para conformidade.',
    details: [
      `Colunas enviadas: ${formatColumnList(student.columns)}`,
      `Colunas requeridas: ${formatColumnList(expected.columns)}`,
      'Basta ajustar o SELECT para incluir exatamente essas colunas e revalidar.',
    ],
    entities: [],
  };
}

function compareResults(
  scenario: InvestigationScenario,
  expected: QueryExecResult,
  student: QueryExecResult,
): Omit<ValidationResult, 'studentRun' | 'highlight'> {
  const { plural } = scenario.rotuloEntidade;
  const hints = scenario.dicasDivergencia;
  const diff = diffEntities(scenario, expected, student);
  const entityLines = describeEntityDiff(scenario, diff);
  const audit = describeRowAudit({
    captured: student.values.length,
    expected: expected.values.length,
    missingKeys: diff.missing,
    extraKeys: diff.extra,
  });

  if (student.values.length === 0) {
    return {
      status: 'error',
      title: audit.title,
      message: audit.message,
      details: [hints.falta, ...entityLines],
      entities: [],
    };
  }

  if (student.values.length !== expected.values.length) {
    const mais = student.values.length > expected.values.length;
    return {
      status: 'error',
      title: audit.title,
      message: audit.message,
      details: [mais ? hints.excesso : hints.falta, ...entityLines],
      entities: [],
    };
  }

  const orderedMap = mapColumns(expected, student);
  const contentMap = mapColumnsByContent(expected, student);
  const mapping = contentMap.every((k) => k != null) ? contentMap : orderedMap;
  const unmatched = expected.columns.filter((_, j) => mapping[j] === null);
  const bagMatch = rowsMatchIgnoringOrder(expected, student);
  const entitiesOk = diff.keyFound && diff.missing.length === 0 && diff.extra.length === 0;
  const expectedMapped = unmatched.length === 0;
  const analyticsOk = expectedMapped || bagMatch || entitiesOk;

  if (analyticsOk && !columnsMatchReport(expected, student)) {
    if (expectedMapped || bagMatch || (entitiesOk && !namesPresent(expected, student))) {
      return reportShapeMismatch(expected, student);
    }
  }

  if (unmatched.length > 0) {
    if (bagMatch) {
      const prio = describePrioritizationMismatch(scenario.ordenacao);
      return successWithNotes(scenario, expected, student, contentMap, [
        `${prio.message} A esteira aceitou o conjunto de evidências.`,
      ]);
    }
    if (!diff.keyFound || diff.missing.length || diff.extra.length) {
      return {
        status: 'error',
        title: diff.keyFound ? audit.title : 'Entidades divergentes',
        message: diff.keyFound
          ? `A quantidade de linhas bate (${expected.values.length}), mas os registros identificados não são os mesmos do gabarito. ${audit.message}`
          : `A quantidade de linhas bate (${expected.values.length}), mas os registros identificados não são os mesmos do gabarito.`,
        details: [hints.excesso, ...entityLines],
        entities: [],
      };
    }
    return {
      status: 'error',
      title: 'Registos fora do critério de negócio',
      message: `A identificação de ${plural} está correta, mas os valores de \`${unmatched.join('`, `')}\` não conferem com o gabarito (tolerância numérica de 0,01).`,
      details: [hints.valores],
      entities: [],
    };
  }

  if (!columnsMatchReport(expected, student)) {
    return reportShapeMismatch(expected, student);
  }

  const orderNotes: string[] = [];
  if (orderedMap.some((k) => k === null)) {
    const prio = describePrioritizationMismatch(scenario.ordenacao);
    orderNotes.push(`💡 Fila de priorização: ${prio.message}`);
  }

  return successWithNotes(scenario, expected, student, mapping, orderNotes);
}

export async function validateChallenge(db: Database, scenario: InvestigationScenario, sql: string): Promise<ValidationResult> {
  await yieldToBrowser();

  if (!sql.trim()) {
    return {
      status: 'error',
      title: 'Editor vazio',
      message: 'Escreva uma consulta no editor antes de validar.',
      details: [],
      entities: [],
      highlight: null,
      studentRun: null,
    };
  }

  const forbidden = findForbiddenCommand(sql);
  if (forbidden) {
    return {
      status: 'error',
      title: 'Apenas consultas de leitura',
      message: `Os desafios aceitam somente \`SELECT\`/\`WITH\`. O comando \`${forbidden}\` não é permitido na validação.`,
      details: ['Para experimentar comandos de escrita, use "Executar Query" e depois "Resetar Banco".'],
      entities: [],
      highlight: null,
      studentRun: null,
    };
  }

  return runIsolated(db, () => {
    const expected = getExpected(db, scenario);
    const start = performance.now();
    let results: QueryExecResult[];
    try {
      results = db.exec(sql);
    } catch (error) {
      const elapsedMs = performance.now() - start;
      const friendly = describeSqlError(error, sql);
      return {
        status: 'error',
        title: friendly.title,
        message: friendly.explanation,
        details: [`Mensagem do SQLite: \`${friendly.raw}\``],
        entities: [],
        highlight: friendly.highlight,
        studentRun: { ok: false, error: friendly.raw, elapsedMs },
      };
    }
    const elapsedMs = performance.now() - start;
    const studentRun: StudentRun = { ok: true, results, elapsedMs };
    const student = results.at(-1) ?? { columns: [], values: [] };
    return { ...compareResults(scenario, expected, student), highlight: null, studentRun };
  });
}
