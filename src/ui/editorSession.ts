import { getDraft, saveDraft } from '../challenges/drafts.ts';
import { findScenario } from '../challenges/registry.ts';
import type { InvestigationScenario } from '../challenges/scenarios.ts';
import { buildStarterTemplate } from '../challenges/starterTemplate.ts';
import { sameSql, stripSqlComments } from '../database/sqlText.ts';
import type { EditorController } from './editor.ts';

const DRAFT_SAVE_DELAY_MS = 400;

export interface EditorSession {
  /** Abre o cenário inicial com o rascunho salvo ou, sem rascunho, com `fallbackSql`. */
  start(fallbackSql: string): void;
  /** Chamado a cada edição; grava o rascunho do cenário dono do editor com debounce. */
  noteEdit(): void;
  flush(): void;
  /** Leva o editor para outro cenário: restaura o rascunho dele ou carrega o template, pedindo confirmação se houver query em andamento. */
  switchTo(next: InvestigationScenario): Promise<void>;
}

const quoted = (s: InvestigationScenario): string => `“${s.titulo}”`;

export function createEditorSession(editor: EditorController, initial: InvestigationScenario): EditorSession {
  /** Cenário ao qual o texto atual do editor pertence (pode diferir do selecionado enquanto há confirmação pendente). */
  let owner = initial;
  /** Último texto carregado programaticamente; editar a partir dele caracteriza query em andamento. */
  let baseline = '';
  let saveTimer: ReturnType<typeof setTimeout> | undefined;
  let switchToken = 0;

  const flush = (): void => {
    clearTimeout(saveTimer);
    saveTimer = undefined;
    saveDraft(owner.id, editor.getFullSql(), buildStarterTemplate(owner));
  };

  const load = (scenario: InvestigationScenario, sql: string, status: string | null): void => {
    owner = scenario;
    baseline = sql;
    editor.setSql(sql);
    if (status) editor.flashStatus(status);
  };

  const hasWorkInProgress = (sql: string): boolean =>
    stripSqlComments(sql) !== '' && !sameSql(sql, baseline) && !sameSql(sql, buildStarterTemplate(owner));

  return {
    start(fallbackSql) {
      const draft = getDraft(owner.id);
      load(owner, draft ?? fallbackSql, draft === undefined ? null : `Rascunho de ${quoted(owner)} restaurado.`);
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

      const draft = getDraft(next.id);
      if (draft !== undefined) {
        editor.dismissPrompt();
        load(next, draft, `Rascunho de ${quoted(next)} restaurado.`);
        return;
      }

      const current = editor.getFullSql();
      if (hasWorkInProgress(current)) {
        const previous = owner;
        const replace = await editor.confirmReplace({
          message: `Você tem uma query em andamento. Deseja carregar o template de ${quoted(next)}?`,
          detail: findScenario(previous.id)
            ? `Substituir guarda sua query como rascunho de ${quoted(previous)}; ela volta quando você reabrir aquele desafio.`
            : 'O desafio anterior foi removido: substituir descarta a query atual.',
          confirmLabel: 'Substituir',
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

      load(next, buildStarterTemplate(next), `Template de ${quoted(next)} carregado.`);
    },
  };
}
