import { getDraft, saveDraft } from '../challenges/drafts.ts';
import { findScenario } from '../challenges/registry.ts';
import type { InvestigationScenario } from '../challenges/scenarios.ts';
import { buildStarterTemplate } from '../challenges/starterTemplate.ts';
import { sameSql, stripSqlComments } from '../database/sqlText.ts';
import type { EditorController } from './editor.ts';

const DRAFT_SAVE_DELAY_MS = 400;

export interface EditorSession {
  /** Abre o cenário inicial com o rascunho salvo ou, sem rascunho útil, com o template do desafio. */
  start(): void;
  /** Chamado a cada edição; grava o rascunho do cenário dono do editor com debounce. */
  noteEdit(): void;
  flush(): void;
  /** Leva o editor para outro cenário: rascunho daquele caso ou template guiado. */
  switchTo(next: InvestigationScenario): Promise<void>;
  /** Recoloca o scaffolding oficial do desafio ativo. */
  restoreTemplate(): Promise<void>;
}

const quoted = (s: InvestigationScenario): string => `“${s.titulo}”`;

/** Query exploratória antiga (JOINs genéricos), não deve sobreviver como rascunho de desafio. */
function isLegacyExploreQuery(sql: string): boolean {
  const flat = stripSqlComments(sql).replace(/\s+/g, ' ');
  return /FROM\s+transacoes_pix\s+t\s+JOIN\s+contas/i.test(flat) && /LIMIT\s+20/i.test(flat);
}

function usefulDraft(sql: string | undefined, template: string): string | undefined {
  if (sql === undefined) return undefined;
  if (isLegacyExploreQuery(sql) || sameSql(sql, template) || !stripSqlComments(sql)) return undefined;
  return sql;
}

export function createEditorSession(editor: EditorController, initial: InvestigationScenario): EditorSession {
  /** Cenário ao qual o texto atual do editor pertence (pode diferir do selecionado enquanto há confirmação pendente). */
  let owner = initial;
  /** Último texto carregado programaticamente; editar a partir dele caracteriza query em andamento. */
  let baseline = '';
  let saveTimer: ReturnType<typeof setTimeout> | undefined;
  let switchToken = 0;

  const templateOf = (scenario: InvestigationScenario): string => buildStarterTemplate(scenario);

  const flush = (): void => {
    clearTimeout(saveTimer);
    saveTimer = undefined;
    saveDraft(owner.id, editor.getFullSql(), templateOf(owner));
  };

  const load = (scenario: InvestigationScenario, sql: string, status: string | null): void => {
    owner = scenario;
    baseline = sql;
    editor.setSql(sql);
    if (status) editor.flashStatus(status);
  };

  const hasWorkInProgress = (sql: string): boolean =>
    stripSqlComments(sql) !== '' &&
    !sameSql(sql, baseline) &&
    !sameSql(sql, templateOf(owner)) &&
    !isLegacyExploreQuery(sql);

  return {
    start() {
      const template = templateOf(owner);
      const draft = usefulDraft(getDraft(owner.id), template);
      load(owner, draft ?? template, draft === undefined ? null : `Rascunho de ${quoted(owner)} restaurado.`);
    },

    noteEdit() {
      clearTimeout(saveTimer);
      saveTimer = setTimeout(flush, DRAFT_SAVE_DELAY_MS);
    },

    flush,

    async switchTo(next) {
      const token = ++switchToken;
      flush();
      if (next.id === owner.id) {
        editor.dismissPrompt();
        return;
      }

      const nextTemplate = templateOf(next);
      const draft = usefulDraft(getDraft(next.id), nextTemplate);
      const current = editor.getFullSql();

      if (hasWorkInProgress(current)) {
        const previous = owner;
        const replace = await editor.confirmReplace({
          message: `Você tem uma query em andamento. Carregar o modelo de ${quoted(next)}?`,
          detail: findScenario(previous.id)
            ? `Substituir guarda sua query como rascunho de ${quoted(previous)}; ela volta quando você reabrir aquele desafio.`
            : 'O desafio anterior foi removido: substituir descarta a query atual.',
          confirmLabel: 'Carregar modelo do caso',
          cancelLabel: 'Manter minha query',
        });
        if (token !== switchToken) return;
        flush();
        if (!replace) {
          owner = next;
          baseline = editor.getFullSql();
          flush();
          editor.flashStatus(`Query mantida no editor para ${quoted(next)}.`);
          return;
        }
      }

      if (token !== switchToken) return;
      if (draft !== undefined) {
        editor.dismissPrompt();
        load(next, draft, `Rascunho de ${quoted(next)} restaurado.`);
        return;
      }

      load(next, nextTemplate, `Modelo inicial de ${quoted(next)} carregado.`);
    },

    async restoreTemplate() {
      const template = templateOf(owner);
      const current = editor.getFullSql();
      if (sameSql(current, template)) {
        editor.flashStatus('O editor já está no modelo inicial deste desafio.');
        return;
      }
      if (hasWorkInProgress(current) || (!sameSql(current, template) && stripSqlComments(current))) {
        const replace = await editor.confirmReplace({
          message: 'Restaurar o modelo inicial deste desafio?',
          detail: 'A consulta atual será substituída pelo scaffolding guiado. O rascunho anterior deixa de valer para este caso.',
          confirmLabel: 'Restaurar modelo',
          cancelLabel: 'Manter minha query',
        });
        if (!replace) return;
      }
      load(owner, template, 'Modelo inicial restaurado.');
      flush();
    },
  };
}
