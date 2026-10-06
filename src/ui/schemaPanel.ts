import type { Database } from 'sql.js';
import { DATA_DICTIONARY, type DictionaryCategory } from '../data/dictionary.ts';
import { getDatabaseSchema, previewTable, type ColumnSchema, type TableSchema } from '../database/introspection.ts';
import { byId } from './dom.ts';
import { escapeHtml, formatInteiro } from './format.ts';
import { renderResultTable } from './resultTable.ts';

export interface SchemaPanelController {
  render(db: Database): void;
  toggle(): void;
  open(): void;
  close(): void;
}

const BADGE: Record<DictionaryCategory, { short: string; tone: string }> = {
  'Cadastral & Societário': { short: 'Cadastral', tone: 'border-sky-800/70 bg-sky-950/50 text-sky-200' },
  Transacional: { short: 'Transacional', tone: 'border-emerald-800/70 bg-emerald-950/40 text-emerald-200' },
  'Segurança & Telemetria': { short: 'Telemetria', tone: 'border-amber-800/70 bg-amber-950/40 text-amber-200' },
  'Investimentos & Produtos': { short: 'Investimentos', tone: 'border-violet-800/70 bg-violet-950/40 text-violet-200' },
};

const categoryOf = (table: string): DictionaryCategory | null => DATA_DICTIONARY[table]?.categoria ?? null;

function tableMatches(table: TableSchema, query: string): boolean {
  if (!query) return true;
  if (table.name.toLowerCase().includes(query)) return true;
  const entry = DATA_DICTIONARY[table.name];
  if (entry?.descricao.toLowerCase().includes(query)) return true;
  return table.columns.some((col) => {
    if (col.name.toLowerCase().includes(query)) return true;
    const meta = entry?.colunas[col.name];
    return Boolean(meta && `${meta.descricao} ${meta.exemplo}`.toLowerCase().includes(query));
  });
}

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
        class="group relative flex w-full items-start gap-2 rounded-lg px-2 py-1.5 text-left hover:bg-slate-800/70">
        <span class="min-w-0 flex-1">
          <span class="flex flex-wrap items-center gap-1.5">
            <span class="truncate font-mono text-[13px] text-slate-200 group-hover:text-emerald-300">${escapeHtml(col.name)}</span>
            <span class="rounded bg-slate-800 px-1 py-px font-mono text-[9px] uppercase text-slate-400">${escapeHtml(col.type || 'ANY')}</span>
            ${keyBadges(col, table)}
            <span data-inserted-badge hidden class="rounded bg-emerald-500/15 px-1 py-px text-[10px] font-medium text-emerald-300">✓ inserido</span>
          </span>
          <span class="mt-0.5 block text-[11px] leading-snug text-slate-500">${escapeHtml(descricao)}</span>
          ${exemplo ? `<span class="mt-0.5 block font-mono text-[10px] text-slate-600">ex.: ${escapeHtml(exemplo)}</span>` : ''}
        </span>
      </button>
    </li>`;
}

function renderInspector(table: TableSchema): string {
  const entry = DATA_DICTIONARY[table.name];
  const descricao = entry?.descricao ?? '';
  return `
    <div class="space-y-3">
      <div class="flex items-start gap-2">
        <button type="button" data-insert="${escapeHtml(table.name)}" title="Inserir o nome da tabela no editor"
          class="relative truncate font-mono text-sm font-semibold text-emerald-300 hover:underline">
          ${escapeHtml(table.name)}
          <span data-inserted-badge hidden class="ml-2 rounded bg-emerald-500/15 px-1 py-px text-[10px] font-medium text-emerald-300">✓ inserido</span>
        </button>
        <span class="ml-auto shrink-0 font-mono text-[11px] text-slate-500">${formatInteiro(table.rowCount)} linhas</span>
      </div>
      ${descricao ? `<p class="text-[12px] leading-relaxed text-slate-500">${escapeHtml(descricao)}</p>` : ''}
      <ul class="space-y-px">${table.columns.map((c) => renderColumn(table.name, c)).join('')}</ul>
      <details data-preview="${escapeHtml(table.name)}" class="pt-1">
        <summary class="flex cursor-pointer items-center justify-center gap-1.5 rounded-lg border border-sky-800/60 bg-sky-950/30 px-2 py-2 text-[12px] font-medium text-sky-200 hover:border-sky-600 hover:bg-sky-950/60">
          <span aria-hidden="true">👁</span>
          Ver 3 exemplos práticos desta tabela
        </summary>
        <div data-preview-body class="mt-2 max-h-48 overflow-auto rounded-lg border border-slate-800"></div>
      </details>
    </div>`;
}

function renderTableButton(table: TableSchema, selected: boolean): string {
  const categoria = categoryOf(table.name);
  const badge = categoria
    ? `<span class="rounded border px-1 py-px text-[9px] font-semibold uppercase tracking-wide ${BADGE[categoria].tone}">${escapeHtml(BADGE[categoria].short)}</span>`
    : '';
  const on = selected ? 'border-sky-700 bg-sky-950/50' : 'border-transparent hover:bg-slate-800/70';
  return `
    <button type="button" data-select-table="${escapeHtml(table.name)}"
      class="flex w-full items-center gap-2 rounded-lg border px-2 py-1.5 text-left ${on}">
      <span class="min-w-0 flex-1 truncate font-mono text-[12px] text-slate-100">${escapeHtml(table.name)}</span>
      ${badge}
      <span class="shrink-0 font-mono text-[10px] text-slate-500">${formatInteiro(table.rowCount)}</span>
    </button>`;
}

export function initSchemaPanel(onInsertIdentifier: (identifier: string) => void): SchemaPanelController {
  const drawer = byId('schema-drawer');
  const missionView = byId('investigation-mission-view');
  const sidebar = byId('investigation-panel');
  const list = byId('schema-table-list');
  const inspector = byId('schema-tree');
  const filter = byId<HTMLInputElement>('schema-filter');
  const openButton = document.getElementById('btn-schema');
  const closeButton = byId<HTMLButtonElement>('schema-toggle');

  let currentDb: Database | null = null;
  let tables: TableSchema[] = [];
  let selected: string | null = null;
  let query = '';
  let flashTimer: ReturnType<typeof setTimeout> | undefined;

  const isOpen = (): boolean => !drawer.hidden;

  const setOpen = (open: boolean): void => {
    drawer.hidden = !open;
    missionView.hidden = open;
    sidebar.dataset['view'] = open ? 'schema' : 'mission';
    if (openButton instanceof HTMLButtonElement) {
      openButton.setAttribute('aria-expanded', String(open));
      openButton.setAttribute('aria-pressed', String(open));
    }
  };

  const visibleTables = (): TableSchema[] => tables.filter((t) => tableMatches(t, query));

  const paint = (): void => {
    const visible = visibleTables();
    if (selected && !visible.some((t) => t.name === selected)) selected = visible[0]?.name ?? null;
    if (!selected) selected = visible[0]?.name ?? null;

    list.innerHTML = visible.length
      ? visible.map((t) => renderTableButton(t, t.name === selected)).join('')
      : '<p class="px-2 py-3 text-center text-[12px] text-slate-500">Nenhuma tabela ou coluna corresponde ao filtro.</p>';

    const current = visible.find((t) => t.name === selected);
    inspector.innerHTML = current
      ? renderInspector(current)
      : '<p class="p-2 text-[12px] text-slate-500">Selecione uma tabela para inspecionar colunas.</p>';
  };

  const flashInserted = (host: HTMLElement): void => {
    host.classList.add('ring-1', 'ring-emerald-400/70', 'bg-emerald-950/30');
    const badge = host.querySelector<HTMLElement>('[data-inserted-badge]');
    if (badge) badge.hidden = false;
    clearTimeout(flashTimer);
    flashTimer = setTimeout(() => {
      host.classList.remove('ring-1', 'ring-emerald-400/70', 'bg-emerald-950/30');
      if (badge) badge.hidden = true;
    }, 1200);
  };

  setOpen(false);

  if (openButton instanceof HTMLButtonElement) {
    openButton.addEventListener('click', () => setOpen(!isOpen()));
  }
  closeButton.addEventListener('click', () => setOpen(false));
  document.addEventListener('keydown', (event) => {
    if (event.key !== 'Escape' || !isOpen() || document.querySelector('dialog[open]')) return;
    setOpen(false);
  });

  filter.addEventListener('input', () => {
    query = filter.value.trim().toLowerCase();
    paint();
  });

  list.addEventListener('click', (event) => {
    const target = event.target;
    if (!(target instanceof Element)) return;
    const name = target.closest<HTMLElement>('[data-select-table]')?.dataset['selectTable'];
    if (!name) return;
    selected = name;
    paint();
  });

  inspector.addEventListener('click', (event) => {
    const target = event.target;
    if (!(target instanceof Element)) return;
    const insert = target.closest<HTMLElement>('[data-insert]');
    if (!insert?.dataset['insert']) return;
    event.preventDefault();
    onInsertIdentifier(insert.dataset['insert']);
    flashInserted(insert);
  });

  inspector.addEventListener(
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
      tables = getDatabaseSchema(db);
      if (!selected) selected = tables[0]?.name ?? null;
      paint();
    },
    toggle() {
      setOpen(!isOpen());
    },
    open() {
      setOpen(true);
    },
    close() {
      setOpen(false);
    },
  };
}
