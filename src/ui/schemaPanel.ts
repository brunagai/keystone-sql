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
        class="group flex w-full items-center rounded px-1.5 py-1 text-left hover:bg-slate-800/70">
        <span class="truncate font-mono text-[12px] text-slate-200 group-hover:text-emerald-300">${escapeHtml(col.name)}</span>
      </button>
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
          <summary class="flex cursor-pointer items-center justify-center gap-1.5 rounded-md border border-sky-800/70 bg-sky-950/40 px-2 py-1.5 text-[12px] font-medium text-sky-200 hover:border-sky-600 hover:bg-sky-950/70 hover:text-white">
            <span aria-hidden="true">👁</span>
            Ver 3 exemplos práticos desta tabela
          </summary>
          <div data-preview-body class="mt-1 max-h-48 overflow-auto rounded border border-slate-800"></div>
        </details>
      </div>
    </details>`;
}

export function initSchemaPanel(onInsertColumn: (column: string) => void): SchemaPanelController {
  const panel = byId('schema-panel');
  const container = byId('schema-tree');
  const toggle = byId<HTMLButtonElement>('schema-toggle');
  const toggleIcon = byId('schema-toggle-icon');
  const title = byId('schema-panel-title');
  let currentDb: Database | null = null;

  const applyCollapsed = (collapsed: boolean): void => {
    panel.dataset['collapsed'] = collapsed ? 'true' : 'false';
    panel.classList.toggle('w-11', collapsed);
    panel.classList.toggle('w-80', !collapsed);
    container.hidden = collapsed;
    title.classList.toggle('hidden', collapsed);
    toggle.setAttribute('aria-expanded', String(!collapsed));
    toggle.title = collapsed ? 'Expandir dicionário de dados' : 'Recolher dicionário de dados';
    toggleIcon.textContent = collapsed ? '▶' : '◀';
    const sr = toggle.querySelector('.sr-only');
    if (sr) sr.textContent = collapsed ? 'Expandir dicionário de dados' : 'Recolher dicionário de dados';
  };

  applyCollapsed(true);

  toggle.addEventListener('click', () => {
    applyCollapsed(panel.dataset['collapsed'] !== 'true');
  });

  container.addEventListener('click', (event) => {
    const target = (event.target as HTMLElement).closest<HTMLElement>('[data-insert]');
    if (target?.dataset['insert']) onInsertColumn(target.dataset['insert']);
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
