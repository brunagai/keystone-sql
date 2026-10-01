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
  const descricao = DATA_DICTIONARY[table]?.colunas[col.name] ?? '';
  const badges = [
    col.primaryKey ? '<span class="rounded bg-amber-500/15 px-1 text-[9px] font-bold text-amber-300">PK</span>' : '',
    col.foreignKey
      ? `<span class="rounded bg-sky-500/15 px-1 text-[9px] font-bold text-sky-300" title="Referencia ${escapeHtml(
          `${col.foreignKey.table}.${col.foreignKey.column}`,
        )}">FK</span>`
      : '',
    col.notNull && !col.primaryKey ? '<span class="text-[9px] text-slate-600" title="NOT NULL">NN</span>' : '',
  ].join('');

  return `
    <li>
      <button type="button" data-insert="${escapeHtml(col.name)}" title="${escapeHtml(descricao)}&#10;Clique para inserir no editor"
        class="group flex w-full items-center gap-1.5 rounded px-1.5 py-0.5 text-left hover:bg-slate-800/70">
        <span class="truncate font-mono text-[11px] text-slate-200 group-hover:text-emerald-300">${escapeHtml(col.name)}</span>
        ${badges}
        <span class="ml-auto shrink-0 font-mono text-[10px] uppercase text-slate-500">${escapeHtml(col.type)}</span>
      </button>
      ${
        col.foreignKey
          ? `<p class="pl-3 font-mono text-[10px] text-sky-400/70">↳ ${escapeHtml(col.foreignKey.table)}.${escapeHtml(col.foreignKey.column)}</p>`
          : ''
      }
    </li>`;
}

function renderTable(table: TableSchema): string {
  const descricao = DATA_DICTIONARY[table.name]?.descricao ?? '';
  return `
    <details open class="group/table rounded border border-slate-800 bg-slate-900/40">
      <summary class="flex cursor-pointer select-none items-center gap-2 px-2 py-1.5 hover:bg-slate-800/50">
        <span class="text-[10px] text-slate-500 transition-transform group-open/table:rotate-90">▶</span>
        <span class="font-mono text-xs font-semibold text-emerald-300">${escapeHtml(table.name)}</span>
        <span class="ml-auto rounded bg-slate-800 px-1.5 font-mono text-[10px] tabular-nums text-slate-400">${formatInteiro(table.rowCount)} linhas</span>
      </summary>
      <div class="border-t border-slate-800 px-1 pb-2 pt-1">
        ${descricao ? `<p class="px-1.5 pb-1.5 text-[11px] leading-snug text-slate-500">${escapeHtml(descricao)}</p>` : ''}
        <ul class="space-y-px">${table.columns.map((c) => renderColumn(table.name, c)).join('')}</ul>
        <details data-preview="${escapeHtml(table.name)}" class="group/preview mt-2 px-1">
          <summary class="flex cursor-pointer items-center gap-1 rounded border border-slate-800 px-2 py-1 text-[11px] text-slate-400 hover:border-slate-700 hover:text-slate-200">
            <span class="text-[9px] transition-transform group-open/preview:rotate-90">▶</span>
            Pré-visualizar 3 primeiras linhas
          </summary>
          <div data-preview-body class="mt-1 max-h-48 overflow-auto rounded border border-slate-800"></div>
        </details>
      </div>
    </details>`;
}

export function initSchemaPanel(onInsertColumn: (column: string) => void): SchemaPanelController {
  const container = byId('schema-tree');
  let currentDb: Database | null = null;

  container.addEventListener('click', (event) => {
    const target = (event.target as HTMLElement).closest<HTMLElement>('[data-insert]');
    if (target?.dataset['insert']) onInsertColumn(target.dataset['insert']);
  });

  // "toggle" não borbulha; a captura permite um único listener para todas as pré-visualizações.
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
        : '<p class="p-2 text-[11px] text-slate-500">Tabela vazia.</p>';
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
