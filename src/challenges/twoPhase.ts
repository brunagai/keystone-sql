import { extractCteNames, extractOuterWhere } from '../database/cteInspector.ts';
import { stripCommentsAndLiterals } from '../database/safeQuery.ts';
import type { InvestigationScenario, TwoPhaseReasoning } from './scenarios.ts';

const TECHNIQUES: { pattern: RegExp; label: string }[] = [
  { pattern: /\bLAG\s*\(/i, label: 'o tempo desde a última operação com `LAG()`' },
  { pattern: /\bLEAD\s*\(/i, label: 'o próximo evento da série com `LEAD()`' },
  { pattern: /\bROW_NUMBER\s*\(/i, label: 'a posição no grupo com `ROW_NUMBER()`' },
  { pattern: /\bRANK\s*\(/i, label: 'o ranking com `RANK()`' },
  { pattern: /\bAVG\s*\([^)]*\)\s*OVER\b/i, label: 'a média histórica com `AVG() OVER`' },
  { pattern: /\bCOUNT\s*\([^)]*\)\s*OVER\b/i, label: 'o histórico acumulado com `COUNT() OVER`' },
  { pattern: /\bSUM\s*\([^)]*\)\s*OVER\b/i, label: 'o volume acumulado com `SUM() OVER`' },
];

const joinPt = (items: string[]): string => {
  if (items.length <= 1) return items[0] ?? 'as métricas analíticas (janelas / partições)';
  return `${items.slice(0, -1).join(', ')} e ${items.at(-1)}`;
};

/** Desafios em que a esteira WITH → WHERE externo é o raciocínio-alvo (N3, N4 e gerados). */
export function showsTwoPhase(scenario: Pick<InvestigationScenario, 'nivel' | 'origem'>): boolean {
  return scenario.nivel === 3 || scenario.nivel === 4 || scenario.origem !== 'base';
}

/** Infere as duas fases a partir do gabarito (desafios gerados) ou devolve o texto pedagógico explícito. */
export function resolveTwoPhase(scenario: InvestigationScenario): TwoPhaseReasoning | null {
  if (scenario.decomposicao) return scenario.decomposicao;
  if (!showsTwoPhase(scenario)) return null;
  return inferTwoPhase(scenario.gabaritoSql);
}

export function inferTwoPhase(sql: string): TwoPhaseReasoning {
  const code = stripCommentsAndLiterals(sql);
  const cte = extractCteNames(sql)[0];
  const found = TECHNIQUES.filter((t) => t.pattern.test(code)).map((t) => t.label);
  const metrics = joinPt(found);
  const where = extractOuterWhere(sql);
  const usesWindow = found.length > 0 || /\bOVER\s*\(/i.test(code);

  const fase1 = cte
    ? `No envelope \`WITH ${cte} AS (...)\`, gere e carimbe linha a linha ${metrics} antes de qualquer corte. Funções de janela não podem ir no \`WHERE\` do mesmo \`SELECT\`.`
    : usesWindow
      ? `Monte um \`WITH\` que gere e carimbe linha a linha ${metrics} antes do filtro. Sem esse envelope, o SQLite recusa filtrar a janela no mesmo \`SELECT\`.`
      : 'Este gabarito ainda corta no próprio `SELECT`. Quando a métrica for de janela (`LAG`, `ROW_NUMBER`), o carimbo precisa ir para um `WITH` e o corte para o `SELECT` externo — selecione o miolo da CTE e use Testar Seleção / CTE para inspecionar.';

  const fase2 = where
    ? `No \`SELECT\` externo, isole apenas as linhas já carimbadas que passam o critério regulatório: \`${where}\`.`
    : 'No `WHERE` (ou `HAVING`) externo, aplique o critério regulatório de corte sobre o dado já carimbado — limiar, posição, intervalo ou combinação de regras.';

  return {
    fase1: { titulo: 'Fase 1 — O envelope `WITH`', texto: fase1 },
    fase2: { titulo: 'Fase 2 — O filtro do `WHERE` externo', texto: fase2 },
  };
}
