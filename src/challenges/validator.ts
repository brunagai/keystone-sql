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

export type ValidationStatus = 'success' | 'warning' | 'error';

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

function compareResults(
  scenario: InvestigationScenario,
  expected: QueryExecResult,
  student: QueryExecResult,
): Omit<ValidationResult, 'studentRun' | 'highlight'> {
  const { plural } = scenario.rotuloEntidade;
  const hints = scenario.dicasDivergencia;
  const expectedCols = expected.columns.join(', ');
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
      status: 'warning',
      title: audit.title,
      message: audit.message,
      details: [hints.falta, ...entityLines],
      entities: [],
    };
  }

  if (student.columns.length < expected.columns.length) {
    return {
      status: 'error',
      title: 'Colunas faltando',
      message: `Sua consulta retornou ${student.columns.length} coluna(s), mas o desafio pede ${expected.columns.length}: \`${expectedCols}\`.`,
      details: [`Colunas retornadas: \`${student.columns.join(', ')}\`.`],
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

  if (unmatched.length > 0) {
    if (rowsMatchIgnoringOrder(expected, student)) {
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
      status: 'warning',
      title: 'Divergência nas métricas calculadas',
      message: `A identificação de ${plural} está correta, mas os valores de \`${unmatched.join('`, `')}\` não conferem com o gabarito (tolerância numérica de 0,01).`,
      details: [hints.valores],
      entities: [],
    };
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
