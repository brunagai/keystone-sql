import type { Database } from 'sql.js';

const SAVEPOINT = 'aml_readonly';

const FORBIDDEN_KEYWORDS =
  /\b(INSERT|UPDATE|DELETE|DROP|ALTER|CREATE|ATTACH|DETACH|PRAGMA|VACUUM|BEGIN|COMMIT|ROLLBACK|SAVEPOINT|RELEASE|REINDEX|ANALYZE)\b/i;
const READ_STATEMENT = /^\s*(SELECT|WITH|VALUES)\b/i;

/** Remove comentários e literais para que palavras-chave dentro deles não disparem os filtros. */
export function stripCommentsAndLiterals(sql: string): string {
  return sql.replace(/'(?:[^']|'')*'|"(?:[^"]|"")*"|--[^\n]*|\/\*[\s\S]*?\*\//g, (m) =>
    m.startsWith("'") ? "''" : m.startsWith('"') ? '""' : ' ',
  );
}

/** Retorna o comando proibido encontrado, ou null se o SQL for somente leitura. */
export function findForbiddenCommand(sql: string): string | null {
  const stripped = stripCommentsAndLiterals(sql);
  const forbidden = FORBIDDEN_KEYWORDS.exec(stripped);
  if (forbidden) return forbidden[1]?.toUpperCase() ?? 'comando';
  const statements = stripped.split(';').filter((s) => s.trim());
  const invalid = statements.find((s) => !READ_STATEMENT.test(s));
  return invalid ? (invalid.trim().split(/\s+/)[0]?.toUpperCase() ?? 'comando') : null;
}

/** Executa dentro de um SAVEPOINT revertido ao final: nenhuma alteração persiste no banco. */
export function runIsolated<T>(db: Database, fn: () => T): T {
  db.exec(`SAVEPOINT ${SAVEPOINT};`);
  try {
    return fn();
  } finally {
    db.exec(`ROLLBACK TO ${SAVEPOINT}; RELEASE ${SAVEPOINT};`);
  }
}

/** Extrai a cláusula do ORDER BY externo (fora de OVER/subconsultas), sem LIMIT/OFFSET. */
export function extractOrderBy(sql: string): string | null {
  const stripped = stripCommentsAndLiterals(sql);
  const depths: number[] = [];
  let depth = 0;
  for (const ch of stripped) {
    depths.push(depth);
    if (ch === '(') depth++;
    else if (ch === ')') depth--;
  }

  const outer = [...stripped.matchAll(/\bORDER\s+BY\s+/gi)].filter((m) => depths[m.index] === 0).at(-1);
  if (!outer) return null;

  const rest = stripped.slice(outer.index + outer[0].length);
  const end = rest.search(/\bLIMIT\b|\bOFFSET\b|;/i);
  const clause = (end < 0 ? rest : rest.slice(0, end)).replace(/\s+/g, ' ').trim();
  return clause || null;
}
