import type { QueryExecResult } from 'sql.js';
import { escapeHtml } from './format.ts';

function renderCell(value: unknown): string {
  if (value === null) return '<span class="italic text-slate-500">NULL</span>';
  if (value instanceof Uint8Array) return `<span class="text-slate-500">BLOB(${value.length})</span>`;
  return escapeHtml(value);
}

function renderSingleResult({ columns, values }: QueryExecResult): string {
  const head = columns
    .map((c) => `<th class="px-3 py-2 text-left font-semibold text-slate-300">${escapeHtml(c)}</th>`)
    .join('');
  const body = values
    .map(
      (row) =>
        `<tr class="border-t border-slate-800 hover:bg-slate-800/50">${row
          .map((v) => `<td class="whitespace-nowrap px-3 py-1.5 font-mono text-xs">${renderCell(v)}</td>`)
          .join('')}</tr>`,
    )
    .join('');

  return `
    <div class="overflow-auto rounded-lg border border-slate-800 max-h-[28rem]">
      <table class="min-w-full text-sm">
        <thead class="sticky top-0 bg-slate-900"><tr>${head}</tr></thead>
        <tbody>${body}</tbody>
      </table>
    </div>
    <p class="mt-2 text-xs text-slate-500">${values.length} linha(s)</p>
  `;
}

export function renderResults(results: QueryExecResult[]): string {
  if (results.length === 0) {
    return '<p class="text-sm text-slate-400">Comando executado. Nenhuma linha retornada.</p>';
  }
  return results.map(renderSingleResult).join('<div class="h-6"></div>');
}

export function renderError(message: string): string {
  return `<pre class="whitespace-pre-wrap rounded-lg border border-rose-900 bg-rose-950/40 p-3 text-sm text-rose-300">${escapeHtml(message)}</pre>`;
}
