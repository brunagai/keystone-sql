import type { QueryExecResult } from 'sql.js';
import { byId } from './dom.ts';
import { escapeHtml, formatInteiro, formatMs } from './format.ts';
import { renderResultTable } from './resultTable.ts';

export interface OutputPanelController {
  showResults(results: QueryExecResult[], elapsedMs: number): void;
  showError(message: string, elapsedMs?: number): void;
  showMessage(message: string): void;
}

const metaItem = (label: string, value: string, tone = 'text-slate-300'): string =>
  `<span><span class="text-slate-600">${label}</span> <span class="${tone}">${value}</span></span>`;

export function initOutputPanel(): OutputPanelController {
  const meta = byId('output-meta');
  const body = byId('output-body');

  const placeholder = (message: string): string =>
    `<div class="flex h-full items-center justify-center p-6 text-center text-xs text-slate-500">${escapeHtml(message)}</div>`;

  return {
    showResults(results, elapsedMs) {
      const rows = results.reduce((acc, r) => acc + r.values.length, 0);
      meta.innerHTML = [
        metaItem('tempo', formatMs(elapsedMs), 'text-emerald-300'),
        metaItem('linhas', formatInteiro(rows)),
        results.length > 1 ? metaItem('conjuntos', String(results.length)) : '',
      ].join('');

      if (results.length === 0) {
        body.innerHTML = placeholder('Comando executado com sucesso. Nenhuma linha retornada.');
        return;
      }
      body.innerHTML = results
        .map((r, i) =>
          results.length > 1
            ? `<div class="sticky left-0 border-b border-slate-800 bg-zinc-950 px-3 py-1 font-mono text-[10px] text-slate-500">Resultado ${i + 1}</div>${renderResultTable(r)}`
            : renderResultTable(r),
        )
        .join('');
    },
    showError(message, elapsedMs) {
      meta.innerHTML = [
        elapsedMs === undefined ? '' : metaItem('tempo', formatMs(elapsedMs)),
        metaItem('status', 'erro', 'text-rose-400'),
      ].join('');
      body.innerHTML = `
        <div class="p-3">
          <pre class="whitespace-pre-wrap rounded border border-rose-900/70 bg-rose-950/30 p-3 font-mono text-xs text-rose-300">${escapeHtml(message)}</pre>
        </div>`;
    },
    showMessage(message) {
      meta.innerHTML = '';
      body.innerHTML = placeholder(message);
    },
  };
}
