/** Remove comentários `--` (fora de strings) e espaços nas bordas; vazio = nada além de comentários. */
export function stripSqlComments(sql: string): string {
  let out = '';
  let inString = false;
  for (let i = 0; i < sql.length; i++) {
    const ch = sql[i];
    if (ch === "'") inString = !inString;
    if (!inString && ch === '-' && sql[i + 1] === '-') {
      const eol = sql.indexOf('\n', i);
      if (eol < 0) break;
      i = eol - 1;
      continue;
    }
    out += ch;
  }
  return out.trim();
}

/** Comentários e literais mascarados, para casar palavras-chave só no código. */
export function maskSql(sql: string): string {
  return sql.replace(/'(?:[^']|'')*'|"(?:[^"]|"")*"|--[^\n]*|\/\*[\s\S]*?\*\//g, (m) =>
    m.startsWith("'") ? "''" : m.startsWith('"') ? '""' : ' ',
  );
}

const normalize = (sql: string): string => sql.replace(/[ \t]+$/gm, '').trim();

/** Igualdade ignorando espaços no fim das linhas e nas bordas do texto. */
export const sameSql = (a: string, b: string): boolean => normalize(a) === normalize(b);
