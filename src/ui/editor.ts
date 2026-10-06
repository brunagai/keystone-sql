import { byId } from './dom.ts';
import { escapeHtml } from './format.ts';

export interface ReplacePrompt {
  message: string;
  detail?: string;
  confirmLabel: string;
  cancelLabel: string;
}

export interface EditorController {
  getSql(): string;
  getFullSql(): string;
  /** Troca programática (template/rascunho): não entra no histórico de desfazer nem dispara `onChange`. */
  setSql(sql: string): void;
  /** Troca pedida pela usuária (histórico, gabarito): preserva o Ctrl+Z e dispara `onChange`. */
  replaceSql(sql: string): void;
  insertAtCursor(text: string): void;
  setActionsEnabled(enabled: boolean): void;
  focus(): void;
  /** Banner na barra do editor; resolve `true` para substituir. Um novo pedido descarta o anterior como `false`. */
  confirmReplace(prompt: ReplacePrompt): Promise<boolean>;
  dismissPrompt(): void;
  flashStatus(message: string): void;
  clearHint(): void;
}

export interface EditorHandlers {
  onRun: () => void;
  onValidate: () => void;
  onChange: () => void;
  onRestoreTemplate: () => void;
}

const INDENT = '  ';
const HINT_TIMEOUT_MS = 6000;

export function initEditor({ onRun, onValidate, onChange, onRestoreTemplate }: EditorHandlers): EditorController {
  const textarea = byId<HTMLTextAreaElement>('sql-editor');
  const runButton = byId<HTMLButtonElement>('btn-run');
  const validateButton = byId<HTMLButtonElement>('btn-validate');
  const banner = byId('editor-banner');
  const hint = byId('editor-hint');
  const restoreButton = byId<HTMLButtonElement>('btn-restore-template');

  const insertAtCursor = (text: string): void => {
    const start = textarea.selectionStart;
    const end = textarea.selectionEnd;
    textarea.setRangeText(text, start, end, 'end');
    textarea.focus();
    onChange();
  };

  runButton.title = 'Executa sua consulta livremente no banco para explorar e conferir os dados.';
  validateButton.title = 'Submete sua query para a esteira AML conferir se você encontrou as evidências do caso.';
  runButton.addEventListener('click', onRun);
  validateButton.addEventListener('click', onValidate);
  restoreButton.addEventListener('click', onRestoreTemplate);
  textarea.addEventListener('input', onChange);

  textarea.addEventListener('keydown', (event) => {
    if ((event.ctrlKey || event.metaKey) && event.key === 'Enter') {
      event.preventDefault();
      if (!runButton.disabled) onRun();
      return;
    }
    if (event.key === 'Tab' && !event.shiftKey && !event.ctrlKey) {
      event.preventDefault();
      insertAtCursor(INDENT);
    }
  });

  let pendingPrompt: ((replace: boolean) => void) | null = null;
  const settlePrompt = (replace: boolean): void => {
    const resolve = pendingPrompt;
    pendingPrompt = null;
    banner.hidden = true;
    banner.innerHTML = '';
    resolve?.(replace);
  };

  banner.addEventListener('click', (event) => {
    const choice = (event.target as HTMLElement).closest<HTMLElement>('[data-choice]')?.dataset['choice'];
    if (choice) settlePrompt(choice === 'replace');
  });
  banner.addEventListener('keydown', (event) => {
    if (event.key === 'Escape') settlePrompt(false);
  });

  let hintTimer: ReturnType<typeof setTimeout> | undefined;

  const setHint = (message: string): void => {
    clearTimeout(hintTimer);
    hint.hidden = !message;
    hint.textContent = message;
    if (!message) return;
    hintTimer = setTimeout(() => {
      hint.hidden = true;
      hint.textContent = '';
    }, HINT_TIMEOUT_MS);
  };

  return {
    getSql: () => textarea.value,
    getFullSql: () => textarea.value,
    setSql(sql) {
      textarea.value = sql;
      textarea.setSelectionRange(sql.length, sql.length);
      textarea.scrollTop = 0;
    },
    replaceSql(sql) {
      textarea.focus();
      textarea.select();
      if (!document.execCommand('insertText', false, sql)) {
        textarea.value = sql;
        onChange();
      }
      textarea.scrollTop = 0;
    },
    insertAtCursor,
    setActionsEnabled(enabled) {
      runButton.disabled = !enabled;
      validateButton.disabled = !enabled;
    },
    focus() {
      textarea.focus();
    },
    confirmReplace({ message, detail, confirmLabel, cancelLabel }) {
      settlePrompt(false);
      banner.innerHTML = `
        <div class="flex min-w-0 w-full items-start gap-2 sm:flex-1">
          <span class="mt-px shrink-0 text-amber-400" aria-hidden="true">⚠</span>
          <div class="min-w-0 w-full">
            <p class="font-medium leading-relaxed text-amber-200">${escapeHtml(message)}</p>
            ${detail ? `<p class="mt-1 leading-relaxed text-amber-200/70">${escapeHtml(detail)}</p>` : ''}
          </div>
        </div>
        <div class="flex w-full flex-col gap-2 pt-2 xs:flex-row sm:w-auto sm:shrink-0 sm:flex-row sm:pt-0">
          <button type="button" data-choice="replace"
            class="min-h-10 w-full rounded-md bg-amber-600 px-3 py-2 text-center font-semibold text-zinc-950 hover:bg-amber-500 sm:min-h-0 sm:w-auto sm:py-1.5">${escapeHtml(confirmLabel)}</button>
          <button type="button" data-choice="keep"
            class="min-h-10 w-full rounded-md border border-slate-600 px-3 py-2 text-center text-slate-200 hover:bg-slate-800 sm:min-h-0 sm:w-auto sm:py-1.5">${escapeHtml(cancelLabel)}</button>
        </div>`;
      banner.hidden = false;
      return new Promise<boolean>((resolve) => {
        pendingPrompt = resolve;
      });
    },
    dismissPrompt: () => settlePrompt(false),
    flashStatus: setHint,
    clearHint: () => setHint(''),
  };
}
