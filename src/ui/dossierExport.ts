import { buildDossier, type DossierData, type DossierFile, type DossierFormat } from '../export/dossier.ts';
import { byId } from './dom.ts';
import { escapeHtml, formatInteiro } from './format.ts';
import { bindPopover } from './popover.ts';

export interface DossierExportController {
  /** Habilita a exportação para a última execução bem-sucedida (ou desabilita com `null`). */
  setData(data: DossierData | null): void;
}

function download({ filename, mimeType, content }: DossierFile): void {
  const url = URL.createObjectURL(new Blob([content], { type: mimeType }));
  const link = document.createElement('a');
  link.href = url;
  link.download = filename;
  link.hidden = true;
  document.body.append(link);
  link.click();
  link.remove();
  setTimeout(() => URL.revokeObjectURL(url), 0);
}

const isFormat = (value: string | undefined): value is DossierFormat => value === 'markdown' || value === 'csv';

export function initDossierExport(): DossierExportController {
  const trigger = byId<HTMLButtonElement>('btn-export');
  const panel = byId('export-menu');
  const summary = byId('export-summary');

  let data: DossierData | null = null;

  const renderSummary = (): void => {
    if (!data) return;
    const rows = data.results.reduce((acc, r) => acc + r.values.length, 0);
    summary.innerHTML = `
      <span class="block truncate text-slate-300">${escapeHtml(data.scenario.titulo)}</span>
      <span class="font-mono">${escapeHtml(data.scenario.id)}</span> · ${formatInteiro(rows)} linha${rows === 1 ? '' : 's'} de evidência`;
  };

  const popover = bindPopover(trigger, panel, () => {
    renderSummary();
    panel.querySelector<HTMLButtonElement>('[data-format]')?.focus();
  });

  panel.addEventListener('click', (event) => {
    const format = (event.target as HTMLElement).closest<HTMLElement>('[data-format]')?.dataset['format'];
    if (!data || !isFormat(format)) return;
    download(buildDossier(data, format));
    popover.close();
    trigger.focus();
  });

  trigger.disabled = true;

  return {
    setData(next) {
      data = next;
      trigger.disabled = next === null;
      trigger.title = next ? 'Baixa o enquadramento, a query e as evidências da última execução' : 'Execute uma query com sucesso para exportar';
      if (!next) popover.close();
    },
  };
}
