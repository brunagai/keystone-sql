import type { Database } from 'sql.js';
import { datasetMetadata, getDatabase, resetDatabase, runQuery } from './database/sqlite.ts';
import { formatBRL, formatInteiro } from './ui/format.ts';
import { renderError, renderResults } from './ui/resultTable.ts';

const QUERY_INICIAL = `-- Maiores transações PIX do período
SELECT t.data_hora,
       o.titular AS origem,
       d.titular AS destino,
       t.valor
FROM transacoes_pix t
JOIN contas o ON o.id_conta = t.id_conta_origem
JOIN contas d ON d.id_conta = t.id_conta_destino
ORDER BY t.valor DESC
LIMIT 10;`;

function requireElement<T extends HTMLElement>(selector: string): T {
  const el = document.querySelector<T>(selector);
  if (!el) throw new Error(`Elemento não encontrado: ${selector}`);
  return el;
}

function renderLayout(root: HTMLElement): void {
  const { periodo } = datasetMetadata;
  root.innerHTML = `
    <main class="mx-auto max-w-6xl px-6 py-10">
      <header class="mb-8 flex flex-wrap items-end justify-between gap-4">
        <div>
          <p class="text-xs font-semibold uppercase tracking-widest text-emerald-400">PLD / AML Lab</p>
          <h1 class="mt-1 text-3xl font-bold">SQL Analítico para Prevenção à Lavagem de Dinheiro</h1>
          <p class="mt-2 text-sm text-slate-400">
            SQLite (sql.js + WebAssembly) rodando 100% no navegador · período ${periodo.inicio} a ${periodo.fim}
          </p>
        </div>
        <span id="status" class="rounded-full bg-amber-500/10 px-3 py-1 text-xs font-medium text-amber-300">
          Inicializando banco…
        </span>
      </header>

      <section id="stats" class="mb-8 grid gap-4 sm:grid-cols-3"></section>

      <section class="rounded-xl border border-slate-800 bg-slate-900/60 p-4">
        <label for="sql" class="mb-2 block text-sm font-medium text-slate-300">Console SQL</label>
        <textarea id="sql" spellcheck="false"
          class="h-48 w-full resize-y rounded-lg border border-slate-700 bg-slate-950 p-3 font-mono text-sm text-emerald-200 focus:border-emerald-500 focus:outline-none"></textarea>
        <div class="mt-3 flex items-center gap-3">
          <button id="run" disabled
            class="rounded-lg bg-emerald-600 px-4 py-2 text-sm font-semibold hover:bg-emerald-500 disabled:cursor-not-allowed disabled:opacity-40">
            Executar (Ctrl+Enter)
          </button>
          <button id="reset" disabled
            class="rounded-lg border border-slate-700 px-4 py-2 text-sm text-slate-300 hover:bg-slate-800 disabled:cursor-not-allowed disabled:opacity-40">
            Recriar banco
          </button>
        </div>
      </section>

      <section id="results" class="mt-6"></section>
    </main>
  `;
}

function setStatus(text: string, tone: 'ok' | 'erro'): void {
  const el = requireElement<HTMLSpanElement>('#status');
  el.textContent = text;
  el.className =
    tone === 'ok'
      ? 'rounded-full bg-emerald-500/10 px-3 py-1 text-xs font-medium text-emerald-300'
      : 'rounded-full bg-rose-500/10 px-3 py-1 text-xs font-medium text-rose-300';
}

function scalar(db: Database, sql: string): number {
  return Number(db.exec(sql)[0]?.values[0]?.[0] ?? 0);
}

function renderStats(db: Database): void {
  const cards: Array<[string, string]> = [
    ['Contas', formatInteiro(scalar(db, 'SELECT COUNT(*) FROM contas'))],
    ['Transações PIX', formatInteiro(scalar(db, 'SELECT COUNT(*) FROM transacoes_pix'))],
    ['Volume total', formatBRL(scalar(db, 'SELECT SUM(valor) FROM transacoes_pix'))],
  ];
  requireElement('#stats').innerHTML = cards
    .map(
      ([label, value]) => `
        <div class="rounded-xl border border-slate-800 bg-slate-900/60 p-4">
          <p class="text-xs uppercase tracking-wide text-slate-400">${label}</p>
          <p class="mt-1 text-2xl font-semibold">${value}</p>
        </div>`,
    )
    .join('');
}

async function bootstrap(): Promise<void> {
  renderLayout(requireElement('#app'));

  const editor = requireElement<HTMLTextAreaElement>('#sql');
  const runButton = requireElement<HTMLButtonElement>('#run');
  const resetButton = requireElement<HTMLButtonElement>('#reset');
  const results = requireElement('#results');
  editor.value = QUERY_INICIAL;

  let db = await getDatabase();
  renderStats(db);
  setStatus('Banco pronto', 'ok');
  runButton.disabled = false;
  resetButton.disabled = false;

  const execute = (): void => {
    try {
      results.innerHTML = renderResults(runQuery(db, editor.value));
    } catch (error) {
      results.innerHTML = renderError(error instanceof Error ? error.message : String(error));
    }
  };

  runButton.addEventListener('click', execute);
  editor.addEventListener('keydown', (event) => {
    if ((event.ctrlKey || event.metaKey) && event.key === 'Enter') {
      event.preventDefault();
      execute();
    }
  });
  resetButton.addEventListener('click', async () => {
    db = await resetDatabase();
    renderStats(db);
    results.innerHTML = '<p class="text-sm text-slate-400">Banco recriado a partir do dataset.</p>';
  });

  execute();
}

bootstrap().catch((error: unknown) => {
  console.error(error);
  setStatus('Falha na inicialização', 'erro');
  requireElement('#results').innerHTML = renderError(error instanceof Error ? error.message : String(error));
});
