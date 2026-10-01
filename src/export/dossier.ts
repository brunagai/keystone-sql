import type { QueryExecResult } from 'sql.js';
import type { InvestigationScenario } from '../challenges/scenarios.ts';

type Cell = QueryExecResult['values'][number][number];

export type DossierFormat = 'markdown' | 'csv';

export interface DossierData {
  scenario: InvestigationScenario;
  sql: string;
  results: readonly QueryExecResult[];
  executedAt: Date;
  elapsedMs: number;
}

export interface DossierFile {
  filename: string;
  mimeType: string;
  content: string;
}

const ORIGIN_LABEL: Record<InvestigationScenario['origem'], string> = {
  base: 'Desafio base',
  ia: 'Gerado por IA',
  offline: 'Gerado offline',
};

const originOf = (s: InvestigationScenario): string => (s.modelo ? `${ORIGIN_LABEL[s.origem]} (${s.modelo})` : ORIGIN_LABEL[s.origem]);

const rowCount = (results: readonly QueryExecResult[]): number => results.reduce((acc, r) => acc + r.values.length, 0);

const pad = (n: number): string => String(n).padStart(2, '0');

const fileStamp = (d: Date): string =>
  `${d.getFullYear()}${pad(d.getMonth() + 1)}${pad(d.getDate())}-${pad(d.getHours())}${pad(d.getMinutes())}`;

const slug = (text: string): string =>
  text
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-zA-Z0-9]+/g, '-')
    .replace(/^-|-$/g, '')
    .toLowerCase()
    .slice(0, 40) || 'caso';

function cellText(value: Cell): string {
  if (value === null) return '';
  if (value instanceof Uint8Array) return `<BLOB ${value.length} bytes>`;
  return String(value);
}

function metadata(d: DossierData): [label: string, value: string][] {
  return [
    ['ID do caso', d.scenario.id],
    ['Título', d.scenario.titulo],
    ['Enquadramento BACEN', d.scenario.enquadramento],
    ['Origem', originOf(d.scenario)],
    ['Executado em', d.executedAt.toLocaleString('pt-BR')],
    ['Tempo de execução', `${d.elapsedMs.toFixed(2)} ms`],
    ['Linhas de evidência', String(rowCount(d.results))],
  ];
}

// --- Markdown ---------------------------------------------------------------

const mdCell = (text: string): string => text.replace(/\\/g, '\\\\').replace(/\|/g, '\\|').replace(/\r?\n/g, '<br>');

function mdTable(columns: readonly string[], rows: readonly (readonly string[])[]): string {
  const line = (cells: readonly string[]): string => `| ${cells.map(mdCell).join(' | ')} |`;
  return [line(columns), `|${columns.map(() => ' --- ').join('|')}|`, ...rows.map(line)].join('\n');
}

function buildMarkdown(d: DossierData): string {
  const fence = d.sql.includes('```') ? '~~~' : '```';
  const evidence = d.results.length
    ? d.results
        .map((r, i) => {
          const title = d.results.length > 1 ? `### Resultado ${i + 1}\n\n` : '';
          const rows = r.values.map((row) => row.map((v) => (v === null ? 'NULL' : cellText(v))));
          return `${title}${mdTable(r.columns, rows)}`;
        })
        .join('\n\n')
    : '_A consulta não retornou linhas._';

  return [
    `# Dossiê de Investigação — ${d.scenario.titulo}`,
    '',
    mdTable(['Campo', 'Valor'], metadata(d)),
    '',
    '## Objetivo da análise',
    '',
    d.scenario.objetivo,
    '',
    '## Query SQL executada',
    '',
    `${fence}sql`,
    d.sql.trim(),
    fence,
    '',
    `## Evidências (${rowCount(d.results)} linhas)`,
    '',
    evidence,
    '',
    '---',
    '_Gerado pelo AML SQL Lab com dados sintéticos, para fins educacionais._',
    '',
  ].join('\n');
}

// --- CSV (RFC 4180) ---------------------------------------------------------

/** Aspas quando necessário; texto iniciado por = + - @ recebe apóstrofo para não virar fórmula no Excel. */
function csvField(value: Cell | string): string {
  if (typeof value === 'number') return String(value);
  let text = cellText(value);
  if (/^[=+\-@\t\r]/.test(text)) text = `'${text}`;
  return /[",\r\n]/.test(text) ? `"${text.replace(/"/g, '""')}"` : text;
}

const csvLine = (cells: readonly (Cell | string)[]): string => cells.map(csvField).join(',');

function buildCsv(d: DossierData): string {
  const lines = [...metadata(d).map(([label, value]) => csvLine([label, value])), csvLine(['Query SQL', d.sql.trim()])];
  d.results.forEach((r, i) => {
    lines.push('');
    if (d.results.length > 1) lines.push(csvLine([`Resultado ${i + 1}`]));
    lines.push(csvLine(r.columns), ...r.values.map(csvLine));
  });
  return `\uFEFF${lines.join('\r\n')}\r\n`;
}

export function buildDossier(d: DossierData, format: DossierFormat): DossierFile {
  const base = `dossie-${slug(d.scenario.id)}-${fileStamp(d.executedAt)}`;
  return format === 'markdown'
    ? { filename: `${base}.md`, mimeType: 'text/markdown;charset=utf-8', content: buildMarkdown(d) }
    : { filename: `${base}.csv`, mimeType: 'text/csv;charset=utf-8', content: buildCsv(d) };
}
