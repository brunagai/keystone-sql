import { byId } from './dom.ts';
import { escapeHtml } from './format.ts';

export interface ReplacePrompt {
  message: string;
  detail?: string;
  confirmLabel: string;
  cancelLabel: string;
}

export interface EditorController {
  /** SQL selecionado no editor ou, sem seleção, o conteúdo completo. */
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
}

export interface EditorHandlers {
  onRun: () => void;
  onValidate: () => void;
  onChange: () => void;
}

const INDENT = '  ';
const STATUS_TIMEOUT_MS = 3500;

export function initEditor({ onRun, onValidate, onChange }: EditorHandlers): EditorController {
  const textarea = byId<HTMLTextAreaElement>('sql-editor');
  const runButton = byId<HTMLButtonElement>('btn-run');
  const validateButton = byId<HTMLButtonElement>('btn-validate');
  const banner = byId('editor-banner');
  const status = byId('editor-status');

  const insertAtCursor = (text: string): void => {
    textarea.focus();
    textarea.setRangeText(text, textarea.selectionStart, textarea.selectionEnd, 'end');
    onChange();
  };

  runButton.addEventListener('click', onRun);
  validateButton.addEventListener('click', onValidate);
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

  let statusTimer: ReturnType<typeof setTimeout> | undefined;

  return {
    getSql() {
      const { selectionStart, selectionEnd, value } = textarea;
      const selected = value.slice(selectionStart, selectionEnd);
      return selected.trim() ? selected : value;
    },
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
        <span class="mt-px text-amber-400" aria-hidden="true">⚠</span>
        <div class="min-w-0 flex-1">
          <p class="font-medium text-amber-200">${escapeHtml(message)}</p>
          ${detail ? `<p class="mt-0.5 text-[11px] text-amber-200/60">${escapeHtml(detail)}</p>` : ''}
        </div>
        <div class="flex shrink-0 gap-1.5">
          <button type="button" data-choice="replace"
            class="rounded bg-amber-600 px-2 py-0.5 font-semibold text-zinc-950 hover:bg-amber-500">${escapeHtml(confirmLabel)}</button>
          <button type="button" data-choice="keep"
            class="rounded border border-slate-600 px-2 py-0.5 text-slate-200 hover:bg-slate-800">${escapeHtml(cancelLabel)}</button>
        </div>`;
      banner.hidden = false;
      return new Promise<boolean>((resolve) => {
        pendingPrompt = resolve;
      });
    },
    dismissPrompt: () => settlePrompt(false),
    flashStatus(message) {
      clearTimeout(statusTimer);
      status.textContent = message;
      statusTimer = setTimeout(() => {
        status.textContent = '';
      }, STATUS_TIMEOUT_MS);
    },
  };
}
