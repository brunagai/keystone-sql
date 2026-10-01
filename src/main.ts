import type { Database, QueryExecResult } from 'sql.js';
import { AiServiceError, generateChallenge } from './agent/aiService.ts';
import { loadAiSettings } from './agent/settingsStore.ts';
import type { ChallengeDifficulty, ChallengeFocus } from './agent/types.ts';
import { pruneDrafts } from './challenges/drafts.ts';
import { addGenerated, allScenarios, onScenariosChange } from './challenges/registry.ts';
import { validateChallenge } from './challenges/validator.ts';
import { executeTimedQuery, getDatabase, resetDatabase } from './database/sqlite.ts';
import { sameSql } from './database/sqlText.ts';
import { initAgentPanel } from './ui/agentPanel.ts';
import { initAiSettingsModal } from './ui/aiSettingsModal.ts';
import { initDossierExport } from './ui/dossierExport.ts';
import { initEditor } from './ui/editor.ts';
import { createEditorSession } from './ui/editorSession.ts';
import { initHeader, type DatasetCounts } from './ui/header.ts';
import { initInvestigationPanel } from './ui/investigationPanel.ts';
import { initOutputPanel } from './ui/outputPanel.ts';
import { initQueryHistory, type HistoryOrigin } from './ui/queryHistory.ts';
import { initSchemaPanel } from './ui/schemaPanel.ts';

const QUERY_INICIAL = `-- Maiores transações PIX do período
SELECT t.data_hora,
       o.titular AS origem,
       d.titular AS destino,
       t.canal,
       t.valor
FROM transacoes_pix t
JOIN contas o ON o.id_conta = t.id_conta_origem
JOIN contas d ON d.id_conta = t.id_conta_destino
ORDER BY t.valor DESC
LIMIT 20;`;

const errorMessage = (error: unknown): string => (error instanceof Error ? error.message : String(error));

function countRows(db: Database): DatasetCounts {
  const count = (table: string): number => Number(db.exec(`SELECT COUNT(*) FROM ${table}`)[0]?.values[0]?.[0] ?? 0);
  return { contas: count('contas'), transacoes: count('transacoes_pix') };
}

let db: Database | null = null;

let validating = false;

const output = initOutputPanel();
const dossier = initDossierExport();
const investigation = initInvestigationPanel({
  onLoadSolution: (sql) => editor.replaceSql(sql),
  onScenarioChange: (scenario) => void session.switchTo(scenario),
});
const schema = initSchemaPanel((column) => editor.insertAtCursor(column));
const editor = initEditor({
  onRun: runCurrentQuery,
  onValidate: () => void validateCurrentQuery(),
  onChange: () => session.noteEdit(),
});
const session = createEditorSession(editor, investigation.getSelectedScenario());
const history = initQueryHistory((sql) => {
  editor.replaceSql(sql);
  editor.flashStatus('Query do histórico carregada (Ctrl+Z desfaz).');
});

onScenariosChange(() => pruneDrafts(new Set(allScenarios().map((s) => s.id))));
window.addEventListener('pagehide', () => session.flush());

function recordExecution(origin: HistoryOrigin, sql: string, executedAt: Date, elapsedMs: number, rows: number | null): void {
  history.record({ sql, executedAt, origin, elapsedMs, rows, scenarioTitle: investigation.getSelectedScenario().titulo });
}

const totalRows = (results: readonly QueryExecResult[]): number => results.reduce((acc, r) => acc + r.values.length, 0);
const header = initHeader({
  onReset: () => void handleReset(),
  onOpenAiSettings: () => settingsModal.open(),
});

let aiSettings = loadAiSettings();
let generation: AbortController | null = null;

const settingsModal = initAiSettingsModal((settings) => {
  aiSettings = settings;
  agent.setSettings(settings);
  header.setAiSettings(settings);
});
const agent = initAgentPanel({
  onGenerate: (focus, difficulty) => void generateNewChallenge(focus, difficulty),
  onCancel: () => generation?.abort(),
});
agent.setSettings(aiSettings);
header.setAiSettings(aiSettings);

async function generateNewChallenge(focus: ChallengeFocus, difficulty: ChallengeDifficulty): Promise<void> {
  if (!db || generation) return;
  generation = new AbortController();
  agent.setBusy(true);
  header.setResetEnabled(false);
  try {
    const outcome = await generateChallenge(
      db,
      { focus, difficulty, avoidTitles: allScenarios().map((s) => s.titulo) },
      { settings: aiSettings, signal: generation.signal, onProgress: (message) => agent.showProgress(message) },
    );
    const scenario = addGenerated(outcome);
    investigation.selectScenario(scenario.id);
    editor.focus();

    if (outcome.source === 'ia') {
      const retries = outcome.attempts > 1 ? ` após ${outcome.attempts} tentativas de autocorreção` : '';
      agent.showNotice('success', `Desafio gerado por \`${outcome.model ?? 'IA'}\` e gabarito verificado no SQLite${retries}.`);
    } else if (aiSettings) {
      agent.showNotice('warning', `IA indisponível; usei o gerador offline. Motivo: ${outcome.fallbackReason ?? 'desconhecido'}`);
    } else {
      agent.showNotice('success', 'Desafio gerado offline e verificado no SQLite. Configure uma API Key para desafios inéditos via LLM.');
    }
  } catch (error) {
    if (error instanceof AiServiceError && error.kind === 'aborted') agent.showNotice('warning', 'Geração cancelada.');
    else agent.showNotice('error', errorMessage(error));
  } finally {
    generation = null;
    agent.setBusy(false);
    header.setResetEnabled(db !== null);
  }
}

function runCurrentQuery(): boolean {
  if (!db) return false;
  const sql = editor.getSql();
  if (!sql.trim()) {
    output.showMessage('O editor está vazio.');
    return false;
  }
  const start = performance.now();
  const executedAt = new Date();
  try {
    const { results, elapsedMs } = executeTimedQuery(db, sql);
    output.showResults(results, elapsedMs);
    header.setDatasetCounts(countRows(db));
    dossier.setData({ scenario: investigation.getSelectedScenario(), sql, results, executedAt, elapsedMs });
    recordExecution('execucao', sql, executedAt, elapsedMs, totalRows(results));
    return true;
  } catch (error) {
    const elapsedMs = performance.now() - start;
    output.showError(errorMessage(error), elapsedMs);
    dossier.setData(null);
    recordExecution('execucao', sql, executedAt, elapsedMs, null);
    return false;
  }
}

async function validateCurrentQuery(): Promise<void> {
  if (!db || validating) return;
  validating = true;
  editor.setActionsEnabled(false);
  investigation.showPending();
  try {
    const scenario = investigation.getSelectedScenario();
    const sql = editor.getSql();
    const executedAt = new Date();
    const result = await validateChallenge(db, scenario, sql);
    const run = result.studentRun;
    if (run?.ok) {
      output.showResults(run.results, run.elapsedMs);
      dossier.setData({ scenario, sql, results: run.results, executedAt, elapsedMs: run.elapsedMs });
      recordExecution('validacao', sql, executedAt, run.elapsedMs, totalRows(run.results));
    } else if (run) {
      output.showError(run.error, run.elapsedMs);
      dossier.setData(null);
      recordExecution('validacao', sql, executedAt, run.elapsedMs, null);
    }
    investigation.showValidation(result);
  } catch (error) {
    investigation.showValidation({
      status: 'error',
      title: 'Falha interna na validação',
      message: errorMessage(error),
      details: [],
      entities: [],
      highlight: null,
      studentRun: null,
    });
  } finally {
    validating = false;
    editor.setActionsEnabled(true);
  }
}

function applyDatabase(next: Database): void {
  db = next;
  schema.render(next);
  header.setDatasetCounts(countRows(next));
  header.setConnectionState('ready');
  header.setResetEnabled(true);
  editor.setActionsEnabled(true);
  agent.setEnabled(true);
}

async function handleReset(): Promise<void> {
  header.setResetEnabled(false);
  editor.setActionsEnabled(false);
  agent.setEnabled(false);
  header.setConnectionState('loading');
  try {
    applyDatabase(await resetDatabase());
    investigation.clearFeedback();
    dossier.setData(null);
    output.showMessage('Banco recriado a partir do dataset original.');
  } catch (error) {
    header.setConnectionState('error');
    header.setResetEnabled(true);
    output.showError(errorMessage(error));
  }
  editor.focus();
}

async function bootstrap(): Promise<void> {
  header.setConnectionState('loading');
  session.start(QUERY_INICIAL);
  editor.focus();
  output.showMessage('Inicializando SQLite WebAssembly…');

  try {
    applyDatabase(await getDatabase());
    if (sameSql(editor.getFullSql(), QUERY_INICIAL)) runCurrentQuery();
    else output.showMessage('Rascunho restaurado. Pressione Ctrl+Enter para executar.');
  } catch (error) {
    console.error(error);
    header.setConnectionState('error');
    output.showError(errorMessage(error));
  }
}

void bootstrap();
