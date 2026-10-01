import type { QueryExecResult, SqlValue } from 'sql.js';
import { escapeHtml, formatBRL, formatDataHora, formatDecimal, isMonetaryColumn } from './format.ts';

export interface ResultTableOptions {
  /** Versão reduzida usada nas pré-visualizações do dicionário de dados. */
  compact?: boolean;
}

function renderCell(value: SqlValue, column: string): string {
  if (value === null) return '<td class="px-3 text-left italic text-slate-600">NULL</td>';
  if (value instanceof Uint8Array) return `<td class="px-3 text-slate-500">BLOB(${value.length})</td>`;

  if (typeof value === 'number') {
    const isMoney = isMonetaryColumn(column);
    const text = isMoney ? formatBRL(value) : formatDecimal(value);
    const tone = isMoney ? 'text-amber-200' : 'text-sky-200';
    return `<td class="px-3 text-right tabular-nums ${tone}" title="${value}">${escapeHtml(text)}</td>`;
  }

  const data = formatDataHora(value);
  if (data) return `<td class="px-3 tabular-nums text-violet-200" title="${escapeHtml(value)}">${data}</td>`;
  return `<td class="px-3 text-slate-200">${escapeHtml(value)}</td>`;
}

export function renderResultTable({ columns, values }: QueryExecResult, options: ResultTableOptions = {}): string {
  const compact = options.compact ?? false;
  const rowHeight = compact ? 'h-6' : 'h-7';
  const head = columns
    .map(
      (c) =>
        `<th scope="col" class="sticky top-0 z-10 border-b border-slate-700 bg-slate-900 px-3 ${rowHeight} text-left font-semibold text-slate-300">${escapeHtml(c)}</th>`,
    )
    .join('');
  const indexHead = compact
    ? ''
    : `<th scope="col" class="sticky left-0 top-0 z-20 w-10 border-b border-r border-slate-700 bg-slate-900 px-2 text-right font-normal text-slate-600">#</th>`;

  const body = values
    .map((row, i) => {
      const index = compact
        ? ''
        : `<td class="sticky left-0 border-r border-slate-800 bg-slate-950 px-2 text-right text-slate-600">${i + 1}</td>`;
      const cells = row.map((v, j) => renderCell(v, columns[j] ?? '')).join('');
      return `<tr class="${rowHeight} border-b border-slate-800/70 odd:bg-slate-900/30 hover:bg-slate-800/60">${index}${cells}</tr>`;
    })
    .join('');

  return `
    <table class="min-w-full whitespace-nowrap font-mono ${compact ? 'text-[10px]' : 'text-xs'}">
      <thead><tr>${indexHead}${head}</tr></thead>
      <tbody>${body}</tbody>
    </table>`;
}
