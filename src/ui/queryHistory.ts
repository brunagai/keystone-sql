import { sameSql, stripSqlComments } from '../database/sqlText.ts';
import { byId } from './dom.ts';
import { escapeHtml, formatInteiro, formatMs } from './format.ts';
import { bindPopover } from './popover.ts';

const MAX_ENTRIES = 10;
const PREVIEW_CHARS = 90;

export type HistoryOrigin = 'execucao' | 'validacao';

export interface HistoryEntry {
  sql: string;
  executedAt: Date;
  origin: HistoryOrigin;
  scenarioTitle: string;
  elapsedMs: number;
  /** `null` quando a execução falhou. */
  rows: number | null;
}

export interface QueryHistoryController {
  record(entry: HistoryEntry): void;
}

const timeOf = (d: Date): string => d.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit', second: '2-digit' });

function preview(sql: string): string {
  const flat = (stripSqlComments(sql) || sql).replace(/\s+/g, ' ').trim();
  return flat.length > PREVIEW_CHARS ? `${flat.slice(0, PREVIEW_CHARS)}…` : flat;
}

function renderEntry(entry: HistoryEntry, index: number): string {
  const outcome =
    entry.rows === null
      ? '<span class="text-rose-400">✕ erro</span>'
      : `<span class="text-emerald-400">✓ ${formatInteiro(entry.rows)} linha${entry.rows === 1 ? '' : 's'}</span>`;
  return `
    <li>
      <button type="button" data-history-index="${index}" title="${escapeHtml(entry.sql.slice(0, 600))}"
        class="block w-full rounded px-2 py-1.5 text-left hover:bg-slate-800 focus:bg-slate-800 focus:outline-none">
        <code class="block truncate font-mono text-[11px] text-emerald-200">${escapeHtml(preview(entry.sql))}</code>
        <span class="mt-0.5 flex items-center gap-2 text-[10px] text-slate-500">
          <span class="font-mono">${timeOf(entry.executedAt)}</span>
          ${outcome}
          <span>${formatMs(entry.elapsedMs)}</span>
          ${entry.origin === 'validacao' ? '<span class="rounded border border-sky-800 px-1 text-sky-300">validação</span>' : ''}
          <span class="ml-auto truncate">${escapeHtml(entry.scenarioTitle)}</span>
        </span>
      </button>
    </li>`;
}

export function initQueryHistory(onPick: (sql: string) => void): QueryHistoryController {
  const trigger = byId<HTMLButtonElement>('btn-history');
  const count = byId('history-count');
  const panel = byId('history-panel');
  const list = byId('history-list');

  let entries: HistoryEntry[] = [];

  const render = (): void => {
    count.textContent = entries.length ? String(entries.length) : '';
    count.hidden = entries.length === 0;
    list.innerHTML = entries.length
      ? `<ol class="space-y-0.5">${entries.map(renderEntry).join('')}</ol>`
      : '<p class="px-2 py-3 text-center text-[11px] text-slate-500">Nenhuma query executada nesta sessão.</p>';
  };

  const popover = bindPopover(trigger, panel, () => list.querySelector<HTMLButtonElement>('button')?.focus());

  list.addEventListener('click', (event) => {
    const index = (event.target as HTMLElement).closest<HTMLElement>('[data-history-index]')?.dataset['historyIndex'];
    const entry = index === undefined ? undefined : entries[Number(index)];
    if (!entry) return;
    popover.close();
    onPick(entry.sql);
  });

  list.addEventListener('keydown', (event) => {
    if (event.key !== 'ArrowDown' && event.key !== 'ArrowUp') return;
    event.preventDefault();
    const buttons = [...list.querySelectorAll<HTMLButtonElement>('button')];
    const current = buttons.indexOf(document.activeElement as HTMLButtonElement);
    const next = (current + (event.key === 'ArrowDown' ? 1 : -1) + buttons.length) % buttons.length;
    buttons[next]?.focus();
  });

  render();

  return {
    record(entry) {
      entries = [entry, ...entries.filter((e) => !sameSql(e.sql, entry.sql))].slice(0, MAX_ENTRIES);
      render();
    },
  };
}
