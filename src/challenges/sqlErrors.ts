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
    explain: (t) => `A tabela \`${t}\` não existe. As tabelas disponíveis são \`contas\` e \`transacoes_pix\`.`,
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
    pattern: /misuse of (?:aggregate|window) function (\w+)/i,
    title: 'Uso indevido de função de agregação/janela',
    explain: (t) =>
      `\`${t}()\` não pode ser usada nesse ponto. Agregações filtram-se no \`HAVING\`; funções de janela devem ser calculadas em uma CTE/subconsulta antes do filtro.`,
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
  for (const rule of RULES) {
    const match = rule.pattern.exec(raw);
    if (match) {
      const token = match[1] ?? '';
      return { title: rule.title, explanation: rule.explain(token), raw, highlight: findHighlight(sql, token) };
    }
  }
  return { title: 'Erro ao executar a consulta', explanation: 'O SQLite retornou um erro ao executar sua consulta.', raw, highlight: null };
}
