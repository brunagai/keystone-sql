import { stripCommentsAndLiterals } from './safeQuery.ts';

export interface CteInspectResult {
  /** SQL pronto para `exec` (o original, ou o envelope WITH + `SELECT *` da última CTE). */
  sql: string;
  /** Nome da CTE inspecionada quando o texto era um envelope sem SELECT externo. */
  inspectedCte: string | null;
}

const IDENT = /[A-Za-z_][\w$]*/;

function depthsOf(text: string): number[] {
  const depths: number[] = [];
  let depth = 0;
  for (const ch of text) {
    depths.push(depth);
    if (ch === '(') depth++;
    else if (ch === ')') depth--;
  }
  return depths;
}

function skipWs(text: string, i: number): number {
  while (i < text.length && /\s/.test(text[i] ?? '')) i++;
  return i;
}

/**
 * Nomes das CTEs de um `WITH` no nível 0 (fora de parênteses).
 * Retorna `[]` se o texto não começa com WITH.
 */
export function extractCteNames(sql: string): string[] {
  const stripped = stripCommentsAndLiterals(sql).replace(/\s+/g, ' ').trim();
  if (!/^\s*WITH\b/i.test(stripped)) return [];
  const depths = depthsOf(stripped);
  const names: string[] = [];
  let i = stripped.search(/\bWITH\b/i);
  if (i < 0) return [];
  i = skipWs(stripped, i + 4);
  if (/^RECURSIVE\b/i.test(stripped.slice(i))) i = skipWs(stripped, i + 9);

  while (i < stripped.length && (depths[i] ?? 1) === 0) {
    const ident = IDENT.exec(stripped.slice(i));
    if (!ident || ident.index !== 0) break;
    const name = ident[0];
    i = skipWs(stripped, i + name.length);
    if (stripped[i] === '(') {
      let depth = 1;
      i++;
      while (i < stripped.length && depth > 0) {
        if (stripped[i] === '(') depth++;
        else if (stripped[i] === ')') depth--;
        i++;
      }
      i = skipWs(stripped, i);
    }
    if (!/^AS\b/i.test(stripped.slice(i))) break;
    names.push(name);
    i = skipWs(stripped, i + 2);
    if (stripped[i] !== '(') break;
    let depth = 1;
    i++;
    while (i < stripped.length && depth > 0) {
      if (stripped[i] === '(') depth++;
      else if (stripped[i] === ')') depth--;
      i++;
    }
    i = skipWs(stripped, i);
    if (stripped[i] === ',') {
      i = skipWs(stripped, i + 1);
      continue;
    }
    break;
  }
  return names;
}

/** Último `WHERE` no nível 0 (SELECT externo, não o das CTEs nem de `OVER`). */
export function extractOuterWhere(sql: string): string | null {
  const stripped = stripCommentsAndLiterals(sql);
  const depths = depthsOf(stripped);
  const outer = [...stripped.matchAll(/\bWHERE\b/gi)].filter((m) => depths[m.index] === 0).at(-1);
  if (!outer) return null;
  const rest = stripped.slice(outer.index + outer[0].length);
  const end = rest.search(/\bGROUP\s+BY\b|\bHAVING\b|\bORDER\s+BY\b|\bLIMIT\b|\bOFFSET\b|;/i);
  const clause = (end < 0 ? rest : rest.slice(0, end)).replace(/\s+/g, ' ').trim();
  return clause || null;
}

function hasOuterSelect(sql: string): boolean {
  const stripped = stripCommentsAndLiterals(sql);
  if (/^\s*(SELECT|VALUES)\b/i.test(stripped)) return true;
  if (!/^\s*WITH\b/i.test(stripped)) return false;
  const depths = depthsOf(stripped);
  return [...stripped.matchAll(/\bSELECT\b/gi)].some((m) => depths[m.index] === 0);
}

/**
 * Se o trecho for um `WITH … AS (…)` sem SELECT externo (o "miolo" da CTE),
 * completa com `SELECT * FROM <última CTE>` para a aluna inspecionar o carimbo.
 */
export function prepareExecutableSql(sql: string): CteInspectResult {
  const trimmed = sql.trim().replace(/;+\s*$/, '');
  if (!trimmed) return { sql, inspectedCte: null };
  const names = extractCteNames(trimmed);
  if (names.length && !hasOuterSelect(trimmed)) {
    const last = names.at(-1);
    if (last) return { sql: `${trimmed}\nSELECT * FROM ${last};`, inspectedCte: last };
  }
  return { sql: trimmed, inspectedCte: null };
}
