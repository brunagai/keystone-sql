import type { Database } from 'sql.js';
import { DATA_DICTIONARY } from '../data/dictionary.ts';
import { getDatabaseSchema, previewTable, type ColumnSchema, type TableSchema } from '../database/introspection.ts';
import { byId } from './dom.ts';
import { escapeHtml, formatInteiro } from './format.ts';
import { renderResultTable } from './resultTable.ts';

export interface SchemaPanelController {
  /** Re-renderiza a árvore a partir do banco atual (ex.: após reset). */
  render(db: Database): void;
}

function renderColumn(table: string, col: ColumnSchema): string {
  const descricao = DATA_DICTIONARY[table]?.colunas[col.name] ?? `Campo ${col.name}`;
  const hint = `${descricao}\nClique para inserir no editor.`;
  return `
    <li>
      <button type="button" data-insert="${escapeHtml(col.name)}" title="${escapeHtml(hint)}"
        class="group flex w-full items-center rounded-lg px-2 py-1.5 text-left hover:bg-slate-800/70">
        <span class="truncate font-mono text-[13px] text-slate-200 group-hover:text-emerald-300">${escapeHtml(col.name)}</span>
      </button>
    </li>`;
}

function renderTable(table: TableSchema): string {
  const descricao = DATA_DICTIONARY[table.name]?.descricao ?? '';
  return `
    <details open class="group/table rounded-xl border border-slate-800 bg-slate-900/30">
      <summary class="flex cursor-pointer select-none items-center gap-2 px-3 py-2 hover:bg-slate-800/40">
        <span class="text-[10px] text-slate-500 transition-transform group-open/table:rotate-90">▶</span>
        <span class="font-mono text-sm font-semibold text-emerald-300">${escapeHtml(table.name)}</span>
        <span class="ml-auto font-mono text-[11px] tabular-nums text-slate-500">${formatInteiro(table.rowCount)} linhas</span>
      </summary>
      <div class="border-t border-slate-800 px-2 pb-3 pt-2">
        ${descricao ? `<p class="px-2 pb-2 text-[12px] leading-relaxed text-slate-500">${escapeHtml(descricao)}</p>` : ''}
        <ul class="space-y-px">${table.columns.map((c) => renderColumn(table.name, c)).join('')}</ul>
        <details data-preview="${escapeHtml(table.name)}" class="mt-3 px-1">
          <summary class="flex cursor-pointer items-center justify-center gap-1.5 rounded-lg border border-sky-800/60 bg-sky-950/30 px-2 py-2 text-[12px] font-medium text-sky-200 hover:border-sky-600 hover:bg-sky-950/60">
            <span aria-hidden="true">👁</span>
            Ver 3 exemplos práticos desta tabela
          </summary>
          <div data-preview-body class="mt-2 max-h-48 overflow-auto rounded-lg border border-slate-800"></div>
        </details>
      </div>
    </details>`;
}

export function initSchemaPanel(onInsertColumn: (column: string) => void): SchemaPanelController {
  const drawer = byId('schema-drawer');
  const container = byId('schema-tree');
  const openButton = byId<HTMLButtonElement>('btn-schema');
  const closeButton = byId<HTMLButtonElement>('schema-toggle');
  const backdrop = byId('schema-backdrop');
  let currentDb: Database | null = null;

  const setOpen = (open: boolean): void => {
    drawer.hidden = !open;
    openButton.setAttribute('aria-expanded', String(open));
    if (open) closeButton.focus();
  };

  setOpen(false);

  openButton.addEventListener('click', () => setOpen(true));
  closeButton.addEventListener('click', () => setOpen(false));
  backdrop.addEventListener('click', () => setOpen(false));
  document.addEventListener('keydown', (event) => {
    if (event.key !== 'Escape' || drawer.hidden || document.querySelector('dialog[open]')) return;
    setOpen(false);
  });

  container.addEventListener('click', (event) => {
    const target = (event.target as HTMLElement).closest<HTMLElement>('[data-insert]');
    if (!target?.dataset['insert']) return;
    onInsertColumn(target.dataset['insert']);
    setOpen(false);
  });

  container.addEventListener(
    'toggle',
    (event) => {
      const details = event.target as HTMLDetailsElement;
      const table = details.dataset['preview'];
      if (!table || !details.open || !currentDb) return;
      const body = details.querySelector<HTMLElement>('[data-preview-body]');
      if (!body) return;
      const preview = previewTable(currentDb, table);
      body.innerHTML = preview
        ? renderResultTable(preview, { compact: true })
        : '<p class="p-2 text-[12px] text-slate-500">Tabela vazia.</p>';
    },
    true,
  );

  return {
    render(db) {
      currentDb = db;
      container.innerHTML = getDatabaseSchema(db).map(renderTable).join('');
    },
  };
}
