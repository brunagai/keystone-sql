import type { Database } from 'sql.js';
import { CATEGORY_ORDER, DATA_DICTIONARY, type DictionaryCategory } from '../data/dictionary.ts';
import { getDatabaseSchema, previewTable, type ColumnSchema, type TableSchema } from '../database/introspection.ts';
import { byId } from './dom.ts';
import { escapeHtml, formatInteiro } from './format.ts';
import { renderResultTable } from './resultTable.ts';

export interface SchemaPanelController {
  /** Re-renderiza a árvore a partir do banco atual (ex.: após reset). */
  render(db: Database): void;
}

const BADGE: Record<DictionaryCategory, { short: string; tone: string }> = {
  'Cadastral & Societário': { short: 'Cadastral', tone: 'border-sky-800/70 bg-sky-950/50 text-sky-200' },
  Transacional: { short: 'Transacional', tone: 'border-emerald-800/70 bg-emerald-950/40 text-emerald-200' },
  'Segurança & Telemetria': { short: 'Telemetria', tone: 'border-amber-800/70 bg-amber-950/40 text-amber-200' },
  'Investimentos & Produtos': { short: 'Investimentos', tone: 'border-violet-800/70 bg-violet-950/40 text-violet-200' },
};

const categoryOf = (table: string): DictionaryCategory | null => DATA_DICTIONARY[table]?.categoria ?? null;

function keyBadges(col: ColumnSchema, table: string): string {
  const meta = DATA_DICTIONARY[table]?.colunas[col.name];
  const pk = col.primaryKey || meta?.pk;
  const fkTable = col.foreignKey?.table ?? meta?.fk;
  const parts: string[] = [];
  if (pk) {
    parts.push(
      '<span class="shrink-0 rounded border border-amber-700/70 bg-amber-950/50 px-1 py-px font-mono text-[9px] font-semibold uppercase tracking-wide text-amber-200">PK</span>',
    );
  }
  if (fkTable) {
    parts.push(
      `<span class="shrink-0 rounded border border-sky-800/70 bg-sky-950/40 px-1 py-px font-mono text-[9px] text-sky-200">FK → ${escapeHtml(fkTable)}</span>`,
    );
  }
  return parts.join('');
}

function renderColumn(table: string, col: ColumnSchema): string {
  const meta = DATA_DICTIONARY[table]?.colunas[col.name];
  const descricao = meta?.descricao ?? `Campo ${col.name}`;
  const exemplo = meta?.exemplo;
  const hint = exemplo ? `${descricao}\nEx.: ${exemplo}\nClique para inserir no editor.` : `${descricao}\nClique para inserir no editor.`;
  return `
    <li>
      <button type="button" data-insert="${escapeHtml(col.name)}" title="${escapeHtml(hint)}"
        class="group flex w-full items-start gap-2 rounded-lg px-2 py-1.5 text-left hover:bg-slate-800/70">
        <span class="min-w-0 flex-1">
          <span class="flex flex-wrap items-center gap-1.5">
            <span class="truncate font-mono text-[13px] text-slate-200 group-hover:text-emerald-300">${escapeHtml(col.name)}</span>
            ${keyBadges(col, table)}
          </span>
          <span class="mt-0.5 block text-[11px] leading-snug text-slate-500">${escapeHtml(descricao)}</span>
          ${exemplo ? `<span class="mt-0.5 block font-mono text-[10px] text-slate-600">ex.: ${escapeHtml(exemplo)}</span>` : ''}
        </span>
      </button>
    </li>`;
}

function renderTable(table: TableSchema): string {
  const entry = DATA_DICTIONARY[table.name];
  const descricao = entry?.descricao ?? '';
  const categoria = categoryOf(table.name);
  const badge = categoria
    ? `<span class="rounded border px-1.5 py-px text-[9px] font-semibold uppercase tracking-wide ${BADGE[categoria].tone}">${escapeHtml(BADGE[categoria].short)}</span>`
    : '';
  return `
    <details open class="group/table rounded-xl border border-slate-800 bg-slate-900/30">
      <summary class="flex cursor-pointer select-none items-center gap-2 px-3 py-2 hover:bg-slate-800/40">
        <span class="text-[10px] text-slate-500 transition-transform group-open/table:rotate-90">▶</span>
        <span data-insert="${escapeHtml(table.name)}" title="Inserir o nome da tabela no editor"
          class="truncate font-mono text-sm font-semibold text-emerald-300 hover:underline">${escapeHtml(table.name)}</span>
        ${badge}
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

function renderGroups(tables: readonly TableSchema[]): string {
  const leftover = tables.filter((t) => !categoryOf(t.name));
  const sections = CATEGORY_ORDER.map((categoria) => {
    const items = tables.filter((t) => categoryOf(t.name) === categoria);
    if (items.length === 0) return '';
    const badge = BADGE[categoria];
    return `
      <section class="space-y-2">
        <h3 class="flex items-center gap-2 px-0.5 text-[11px] font-semibold uppercase tracking-wider text-slate-400">
          <span class="rounded border px-1.5 py-px ${badge.tone}">${escapeHtml(badge.short)}</span>
          <span class="font-normal normal-case tracking-normal text-slate-500">${escapeHtml(categoria)}</span>
        </h3>
        ${items.map(renderTable).join('')}
      </section>`;
  });
  const extra = leftover.length
    ? `<section class="space-y-2">${leftover.map(renderTable).join('')}</section>`
    : '';
  return `${sections.join('')}${extra}`;
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
    const target = event.target;
    if (!(target instanceof Element)) return;
    const insert = target.closest<HTMLElement>('[data-insert]');
    if (!insert?.dataset['insert']) return;
    event.preventDefault();
    event.stopPropagation();
    onInsertColumn(insert.dataset['insert']);
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
      container.innerHTML = renderGroups(getDatabaseSchema(db));
    },
  };
}
