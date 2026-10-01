import { byId } from './dom.ts';

export interface EditorController {
  /** SQL selecionado no editor ou, sem seleção, o conteúdo completo. */
  getSql(): string;
  setSql(sql: string): void;
  insertAtCursor(text: string): void;
  setActionsEnabled(enabled: boolean): void;
  focus(): void;
}

export interface EditorHandlers {
  onRun: () => void;
  onValidate: () => void;
}

const INDENT = '  ';

export function initEditor({ onRun, onValidate }: EditorHandlers): EditorController {
  const textarea = byId<HTMLTextAreaElement>('sql-editor');
  const runButton = byId<HTMLButtonElement>('btn-run');
  const validateButton = byId<HTMLButtonElement>('btn-validate');

  const insertAtCursor = (text: string): void => {
    textarea.focus();
    textarea.setRangeText(text, textarea.selectionStart, textarea.selectionEnd, 'end');
  };

  runButton.addEventListener('click', onRun);
  validateButton.addEventListener('click', onValidate);

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

  return {
    getSql() {
      const { selectionStart, selectionEnd, value } = textarea;
      const selected = value.slice(selectionStart, selectionEnd);
      return selected.trim() ? selected : value;
    },
    setSql(sql) {
      textarea.value = sql;
      textarea.setSelectionRange(sql.length, sql.length);
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
  };
}
