import { maskSql } from '../database/sqlText.ts';

export interface ErrorHighlight {
  lineNumber: number;
  line: string;
  token: string;
}

export interface FriendlySqlError {
  title: string;
  explanation: string;
  raw: string;
  highlight: ErrorHighlight | null;
}

interface ErrorRule {
  pattern: RegExp;
  title: string;
  explain: (token: string) => string;
}

const COMPILER_ORDER_TITLE = '⚠️ Ordem de Execução do Compilador SQL';

const COMPILER_ORDER_EXPLANATION =
  'O compilador SQL executa a cláusula `WHERE` antes de o `SELECT` processar as Window Functions (`LAG`, `ROW_NUMBER`, etc.). Para filtrar com base em uma métrica de janela, envelope o cálculo em uma CTE usando `WITH envelope_metricas AS (...)` (Fase 1) e aplique o filtro de corte regulatório no `WHERE` externo (Fase 2).';

/** Mensagens típicas do SQLite (e variantes) ao filtrar janela no WHERE/HAVING. */
const SQLITE_WINDOW_FILTER_ERROR =
  /misuse of window function|window functions? not allowed in (?:WHERE|HAVING)|window function.*(?:WHERE|HAVING)/i;

const WINDOW_CALL = /\b(?:OVER\s*\(|(?:LAG|LEAD|ROW_NUMBER|RANK|DENSE_RANK|NTILE)\s*\()/i;
const WINDOW_HIGHLIGHT = /\b(?:LAG|LEAD|ROW_NUMBER|RANK|DENSE_RANK|NTILE|OVER)\b/i;
const FILTER_STOP = /\b(?:GROUP\s+BY|HAVING|ORDER\s+BY|LIMIT|WINDOW|UNION|INTERSECT|EXCEPT)\b/i;

function extractFilterClauses(masked: string): string[] {
  const clauses: string[] = [];
  const opener = /\b(WHERE|HAVING)\b/gi;
  let match: RegExpExecArray | null;
  while ((match = opener.exec(masked))) {
    const rest = masked.slice(match.index + match[0].length);
    const stop = rest.search(FILTER_STOP);
    clauses.push(stop < 0 ? rest : rest.slice(0, stop));
  }
  return clauses;
}

/** True se WHERE/HAVING contém OVER / LAG / LEAD / ROW_NUMBER etc. */
export function sqlFiltersOnWindowFunction(sql: string): boolean {
  return extractFilterClauses(maskSql(sql)).some((clause) => WINDOW_CALL.test(clause));
}

function windowHighlightToken(sql: string): string {
  const fromFilter = extractFilterClauses(maskSql(sql))
    .map((clause) => WINDOW_HIGHLIGHT.exec(clause)?.[0])
    .find(Boolean);
  if (fromFilter) return fromFilter;
  return WINDOW_HIGHLIGHT.exec(sql)?.[0] ?? 'OVER';
}

const RULES: readonly ErrorRule[] = [
  {
    pattern: /near "([^"]*)": syntax error/i,
    title: 'Erro de sintaxe',
    explain: (t) => `O SQLite não entendeu a consulta perto de \`${t}\`. Verifique vírgulas, parênteses e a ordem das cláusulas (SELECT → FROM → WHERE → GROUP BY → HAVING → ORDER BY).`,
  },
  {
    pattern: /no such column: ([\w.]+)/i,
    title: 'Coluna inexistente',
    explain: (t) =>
      `A coluna \`${t}\` não existe. Confira o Dicionário de Dados: as contas ficam em \`id_conta_origem\`/\`id_conta_destino\` e a renda em \`renda_mensal_declarada\` (use \`AS\` para criar aliases).`,
  },
  {
    pattern: /no such table: ([\w.]+)/i,
    title: 'Tabela inexistente',
    explain: (t) => `A tabela \`${t}\` não existe. As tabelas disponíveis são \`contas\`, \`transacoes_pix\`, \`socios_empresas\`, \`acessos_digitais\` e \`operacoes_produtos\`.`,
  },
  {
    pattern: /no such function: (\w+)/i,
    title: 'Função não suportada',
    explain: (t) => `O SQLite não possui a função \`${t}\`. Para datas, use \`strftime\`, \`julianday\` ou \`unixepoch\`.`,
  },
  {
    pattern: /ambiguous column name: ([\w.]+)/i,
    title: 'Coluna ambígua',
    explain: (t) => `\`${t}\` existe em mais de uma tabela do JOIN. Qualifique com o alias da tabela (ex.: \`t.${t}\`).`,
  },
  {
    pattern: /misuse of aggregate function (\w+)/i,
    title: 'Uso indevido de função de agregação',
    explain: (t) =>
      `\`${t}()\` não pode ser usada nesse ponto. Agregações (\`COUNT\`, \`SUM\`, \`AVG\`…) filtram-se no \`HAVING\`, depois do \`GROUP BY\`.`,
  },
  {
    pattern: /incomplete input/i,
    title: 'SQL incompleto',
    explain: () => 'A consulta terminou antes do esperado. Faltou fechar um parêntese ou completar uma cláusula?',
  },
];

function findHighlight(sql: string, token: string): ErrorHighlight | null {
  if (!token) return null;
  const lines = sql.split(/\r?\n/);
  const index = lines.findIndex((l) => l.toLowerCase().includes(token.toLowerCase()));
  const line = lines[index];
  return line === undefined ? null : { lineNumber: index + 1, line, token };
}

export function describeSqlError(error: unknown, sql: string): FriendlySqlError {
  const raw = error instanceof Error ? error.message : String(error);
  if (SQLITE_WINDOW_FILTER_ERROR.test(raw) || sqlFiltersOnWindowFunction(sql)) {
    const token = windowHighlightToken(sql);
    return {
      title: COMPILER_ORDER_TITLE,
      explanation: COMPILER_ORDER_EXPLANATION,
      raw,
      highlight: findHighlight(sql, token),
    };
  }
  for (const rule of RULES) {
    const match = rule.pattern.exec(raw);
    if (match) {
      const token = match[1] ?? '';
      return { title: rule.title, explanation: rule.explain(token), raw, highlight: findHighlight(sql, token) };
    }
  }
  return { title: 'Erro ao executar a consulta', explanation: 'O SQLite retornou um erro ao executar sua consulta.', raw, highlight: null };
}
