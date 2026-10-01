import type { Database } from 'sql.js';
import { AiServiceError, generateChallenge } from './agent/aiService.ts';
import { loadAiSettings } from './agent/settingsStore.ts';
import type { ChallengeDifficulty, ChallengeFocus } from './agent/types.ts';
import { addGenerated, allScenarios } from './challenges/registry.ts';
import { buildStarterTemplate } from './challenges/starterTemplate.ts';
import { validateChallenge } from './challenges/validator.ts';
import { executeTimedQuery, getDatabase, resetDatabase } from './database/sqlite.ts';
import { initAgentPanel } from './ui/agentPanel.ts';
import { initAiSettingsModal } from './ui/aiSettingsModal.ts';
import { initEditor } from './ui/editor.ts';
import { initHeader, type DatasetCounts } from './ui/header.ts';
import { initInvestigationPanel } from './ui/investigationPanel.ts';
import { initOutputPanel } from './ui/outputPanel.ts';
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
const investigation = initInvestigationPanel({
  onLoadSolution: (sql) => {
    editor.setSql(sql);
    editor.focus();
  },
});
const schema = initSchemaPanel((column) => editor.insertAtCursor(column));
const editor = initEditor({ onRun: runCurrentQuery, onValidate: () => void validateCurrentQuery() });
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
    editor.setSql(buildStarterTemplate(scenario));
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
  try {
    const { results, elapsedMs } = executeTimedQuery(db, sql);
    output.showResults(results, elapsedMs);
    header.setDatasetCounts(countRows(db));
    return true;
  } catch (error) {
    output.showError(errorMessage(error), performance.now() - start);
    return false;
  }
}

async function validateCurrentQuery(): Promise<void> {
  if (!db || validating) return;
  validating = true;
  editor.setActionsEnabled(false);
  investigation.showPending();
  try {
    const result = await validateChallenge(db, investigation.getSelectedScenario(), editor.getSql());
    const run = result.studentRun;
    if (run?.ok) output.showResults(run.results, run.elapsedMs);
    else if (run) output.showError(run.error, run.elapsedMs);
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
  editor.setSql(QUERY_INICIAL);
  editor.focus();
  output.showMessage('Inicializando SQLite WebAssembly…');

  try {
    applyDatabase(await getDatabase());
    runCurrentQuery();
  } catch (error) {
    console.error(error);
    header.setConnectionState('error');
    output.showError(errorMessage(error));
  }
}

void bootstrap();
