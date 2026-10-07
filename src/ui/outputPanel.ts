import type { QueryExecResult } from 'sql.js';
import type { ErrorHighlight } from '../challenges/sqlErrors.ts';
import type { ValidationResult } from '../challenges/validator.ts';
import { byId } from './dom.ts';
import { showResultsSheet } from './layout.ts';
import { escapeHtml, formatInline, formatInteiro, formatMs } from './format.ts';
import { renderResultTable } from './resultTable.ts';

export interface OutputPanelController {
  showResults(results: QueryExecResult[], elapsedMs: number, keepBanner?: boolean): void;
  showError(message: string, elapsedMs?: number): void;
  showMessage(message: string): void;
  showExploreBanner(rowCount: number): void;
  showValidationPending(): void;
  showValidation(result: ValidationResult, expectedColumns: readonly string[]): void;
  clearValidation(): void;
  focusResults(): void;
}

const metaItem = (label: string, value: string, tone = 'text-slate-300'): string =>
  `<span><span class="text-slate-600">${label}</span> <span class="${tone}">${value}</span></span>`;

function renderHighlight({ lineNumber, line, token }: ErrorHighlight): string {
  const start = line.toLowerCase().indexOf(token.toLowerCase());
  const marked =
    start < 0
      ? escapeHtml(line)
      : `${escapeHtml(line.slice(0, start))}<mark class="rounded bg-rose-500/30 px-0.5 text-rose-100 underline decoration-rose-400 decoration-wavy">${escapeHtml(
          line.slice(start, start + token.length),
        )}</mark>${escapeHtml(line.slice(start + token.length))}`;
  return `<pre class="mt-2 overflow-x-auto rounded border border-rose-900/60 bg-black/40 px-2 py-1 font-mono text-[11px] text-slate-300"><span class="mr-2 select-none text-slate-600">${lineNumber}</span>${marked}</pre>`;
}

function quoteList(names: readonly string[]): string {
  return names.map((name) => `'${name}'`).join(', ');
}

function snapshotLine(result: ValidationResult, expectedColumns: readonly string[]): string {
  const run = result.studentRun;
  if (!run?.ok) {
    return run ? `SQLite recusou a consulta. ${run.error}` : result.title;
  }
  const table = run.results.at(-1);
  const returned = table?.columns ?? [];
  const rows = table?.values.length ?? 0;
  return `Esperado: ${expectedColumns.length} coluna(s) (${quoteList([...expectedColumns])}). Retornado: ${returned.length} coluna(s)${
    returned.length ? ` (${quoteList(returned)})` : ''
  }, ${rows} linha(s).`;
}

function renderReportAdjustment(result: ValidationResult): string {
  const details = result.details
    .map((line) => `<p class="text-[13px] leading-relaxed text-amber-100/90">${formatInline(line)}</p>`)
    .join('');
  return `
    <div role="status" class="rounded-xl border border-amber-500/60 bg-amber-950/40 px-4 py-3">
      <p class="text-sm font-semibold text-amber-200">${escapeHtml(result.title)}</p>
      <p class="mt-2 text-[13px] leading-relaxed text-amber-100/90">${escapeHtml(result.message)}</p>
      ${details ? `<div class="mt-3 space-y-1.5 border-t border-amber-800/50 pt-3">${details}</div>` : ''}
    </div>`;
}

function renderFailure(result: ValidationResult, expectedColumns: readonly string[]): string {
  const statusLabel = result.status === 'warning' ? 'INCONSISTÊNCIA DETECTADA' : 'ERRO DE VALIDAÇÃO';
  const tone = result.status === 'warning' ? 'border-amber-700/70 text-amber-200' : 'border-rose-800/80 text-rose-200';
  const details = result.details
    .map((line) => `<p class="font-mono text-[12px] leading-relaxed text-slate-300">${formatInline(line)}</p>`)
    .join('');
  return `
    <div role="alert" class="rounded-xl border ${tone} bg-zinc-950 px-4 py-3">
      <p class="font-mono text-[11px] font-semibold tracking-wide">[${escapeHtml(statusLabel)}]</p>
      <p class="mt-1.5 font-mono text-[12px] leading-relaxed text-slate-200">${escapeHtml(result.title)}</p>
      <p class="mt-2 font-mono text-[12px] leading-relaxed text-slate-400">${escapeHtml(snapshotLine(result, expectedColumns))}</p>
      ${details ? `<div class="mt-2 space-y-1 border-t border-slate-800/80 pt-2">${details}</div>` : ''}
      ${result.highlight ? renderHighlight(result.highlight) : ''}
      <p class="mt-3 text-[13px] leading-relaxed text-slate-200">
        <span class="font-medium text-sky-300">Dica de correção:</span>
        ${formatInline(result.message)}
      </p>
    </div>`;
}

function renderSuccess(result: ValidationResult): string {
  const entities = result.entities.length
    ? `<div class="mt-2 flex flex-wrap gap-1">${result.entities
        .map(
          (e) =>
            `<span class="rounded border border-emerald-500/40 bg-emerald-500/10 px-1.5 py-px font-mono text-[10px] text-emerald-200">${escapeHtml(e)}</span>`,
        )
        .join('')}</div>`
    : '';
  const metrics =
    result.compliance
      ? `<div class="mt-3 grid grid-cols-3 gap-2 font-mono text-[11px] leading-tight">
          <div class="rounded-lg bg-emerald-950/50 px-2 py-1.5">
            <p class="text-[10px] uppercase tracking-wider text-emerald-400/80">Alertas</p>
            <p class="font-semibold text-emerald-100">${result.compliance.captured}/${result.compliance.expected} (${result.compliance.recallPct}%)</p>
          </div>
          <div class="rounded-lg bg-emerald-950/50 px-2 py-1.5">
            <p class="text-[10px] uppercase tracking-wider text-emerald-400/80">Falsos +</p>
            <p class="font-semibold text-emerald-100">${result.compliance.falsePositives}</p>
          </div>
          <div class="rounded-lg bg-emerald-950/50 px-2 py-1.5">
            <p class="text-[10px] uppercase tracking-wider text-emerald-400/80">Eficiência</p>
            <p class="font-semibold text-emerald-100">${result.compliance.efficiencyPct}%</p>
          </div>
        </div>`
      : '';
  return `
    <div role="status" class="rounded-xl border border-emerald-500/50 bg-emerald-950/50 px-4 py-3">
      <p class="text-sm font-semibold text-emerald-200">🎉 Missão Cumprida</p>
      <p class="mt-1 text-[12px] font-medium leading-relaxed text-emerald-100/90">${formatInline(result.title)}</p>
      <p class="mt-1 text-[12px] leading-relaxed text-emerald-100/80">${formatInline(result.message)}</p>
      ${metrics}
      ${entities}
      ${
        result.avisoConformidade
          ? `<div class="mt-3 rounded-xl border border-sky-500/35 bg-sky-950/35 px-3 py-2.5">
              <p class="text-[10px] font-semibold uppercase tracking-wider text-sky-300">Dica de Governança</p>
              <p class="mt-1.5 whitespace-pre-line text-[12px] leading-relaxed text-slate-200">${formatInline(result.avisoConformidade)}</p>
            </div>`
          : ''
      }
      ${
        result.details.length
          ? `<div class="mt-3 space-y-2 border-t border-emerald-800/50 pt-3">${result.details
              .map(
                (line) =>
                  `<p class="whitespace-pre-line text-[12px] leading-relaxed text-emerald-100/85">${formatInline(line)}</p>`,
              )
              .join('')}</div>`
          : ''
      }
    </div>`;
}

export function initOutputPanel(): OutputPanelController {
  const pane = byId('output-pane');
  const scroll = byId('output-scroll');
  const meta = byId('output-meta');
  const body = byId('output-body');
  const banner = byId('validation-banner');
  const emptyState = document.getElementById('results-empty-state');
  const sheetTitle = document.getElementById('results-sheet-title');

  const placeholder = (message: string): string =>
    `<div class="flex items-center justify-center p-6 text-center text-xs text-slate-500">${escapeHtml(message)}</div>`;

  const syncEmptyState = (): void => {
    if (!emptyState) return;
    emptyState.hidden = Boolean(banner.innerHTML) || Boolean(body.innerHTML);
  };

  const setBanner = (html: string): void => {
    banner.innerHTML = html;
    banner.hidden = !html;
    syncEmptyState();
  };

  const setBody = (html: string): void => {
    body.innerHTML = html;
    body.hidden = !html;
    syncEmptyState();
  };

  const paintMeta = (elapsedMs: number | undefined, rows: number | null, erro = false): void => {
    meta.innerHTML = [
      elapsedMs === undefined ? '' : metaItem('tempo', formatMs(elapsedMs), erro ? 'text-rose-300' : 'text-emerald-300'),
      rows === null ? '' : metaItem('linhas', formatInteiro(rows)),
      erro ? metaItem('status', 'erro', 'text-rose-400') : '',
    ].join('');
  };

  const setSheetTitle = (label: string): void => {
    if (sheetTitle) sheetTitle.textContent = label;
  };

  const focusResults = (): void => {
    showResultsSheet();
    scroll.scrollTop = 0;
    pane.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
  };

  return {
    showResults(results, elapsedMs, keepBanner = false) {
      if (!keepBanner) setBanner('');
      setSheetTitle('Resultados da consulta');
      const rows = results.reduce((acc, r) => acc + r.values.length, 0);
      paintMeta(elapsedMs, rows);
      if (rows === 0) {
        setBody(keepBanner ? '' : placeholder('Comando executado com sucesso. Nenhuma linha retornada.'));
        return;
      }
      setBody(
        results
          .map((r, i) =>
            results.length > 1
              ? `<div class="sticky left-0 border-b border-slate-800 bg-zinc-950 px-3 py-1 font-mono text-[10px] text-slate-500">Resultado ${i + 1}</div>${renderResultTable(r)}`
              : renderResultTable(r),
          )
          .join(''),
      );
    },
    showError(message, elapsedMs) {
      paintMeta(elapsedMs, null, true);
      setSheetTitle('Erro na execução');
      setBanner('');
      setBody(`
        <div class="px-5 py-3">
          <pre class="whitespace-pre-wrap rounded-xl border border-rose-800/80 bg-zinc-950 px-4 py-3 font-mono text-xs leading-relaxed text-rose-200">${escapeHtml(message)}</pre>
        </div>`);
      focusResults();
    },
    showMessage(message) {
      meta.innerHTML = '';
      setSheetTitle('Resultados');
      setBanner('');
      setBody(placeholder(message));
    },
    showExploreBanner(rowCount) {
      const linhas = rowCount === 1 ? '1 linha' : `${formatInteiro(rowCount)} linhas`;
      setBanner(`
        <div role="status" class="rounded-xl border border-slate-700 bg-slate-900/70 px-4 py-2.5 text-[13px] leading-relaxed text-slate-300">
          🔍 Modo Exploratório: Consulta executada com sucesso (${linhas}). Para submeter e pontuar neste caso, clique em
          <span class="font-medium text-indigo-300">Validar Resposta</span>.
        </div>`);
    },
    showValidationPending() {
      setSheetTitle('Validando resposta');
      setBody('');
      setBanner(`
        <div class="flex items-center gap-2 rounded-xl border border-slate-800 bg-zinc-950 px-4 py-3 text-sm text-slate-400">
          <span class="size-3 animate-spin rounded-full border-2 border-slate-600 border-t-sky-400"></span>
          Comparando seu resultado com o gabarito…
        </div>`);
      focusResults();
    },
    showValidation(result, expectedColumns) {
      const run = result.studentRun;
      if (result.status === 'success') {
        setSheetTitle('Missão cumprida');
        setBanner(renderSuccess(result));
        if (run?.ok) {
          const rows = run.results.reduce((acc, r) => acc + r.values.length, 0);
          paintMeta(run.elapsedMs, rows);
          if (rows === 0) setBody(placeholder('Comando executado com sucesso. Nenhuma linha retornada.'));
        }
        body.hidden = !body.innerHTML;
        focusResults();
        return;
      }
      if (result.status === 'quase_la') {
        setSheetTitle('Quase lá');
        setBanner(renderReportAdjustment(result));
        if (run?.ok) {
          const rows = run.results.reduce((acc, r) => acc + r.values.length, 0);
          paintMeta(run.elapsedMs, rows);
        }
        focusResults();
        return;
      }

      setSheetTitle('Validação');
      setBanner(renderFailure(result, expectedColumns));
      const hasRows = Boolean(run?.ok && run.results.some((table) => table.values.length > 0));
      if (!hasRows) setBody('');
      if (run?.ok) {
        const rows = run.results.reduce((acc, r) => acc + r.values.length, 0);
        paintMeta(run.elapsedMs, rows);
      } else if (run) {
        paintMeta(run.elapsedMs, null, true);
      }
      focusResults();
    },
    clearValidation() {
      setBanner('');
    },
    focusResults,
  };
}
