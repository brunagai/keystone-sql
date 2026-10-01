import {
  baseScenarios,
  findScenario,
  generatedScenarios,
  onScenariosChange,
  removeGenerated,
} from '../challenges/registry.ts';
import type { InvestigationScenario, ScenarioId } from '../challenges/scenarios.ts';
import type { ErrorHighlight } from '../challenges/sqlErrors.ts';
import type { ValidationResult, ValidationStatus } from '../challenges/validator.ts';
import { byId } from './dom.ts';
import { escapeHtml, formatInline } from './format.ts';

export interface InvestigationPanelController {
  getSelectedScenario(): InvestigationScenario;
  selectScenario(id: ScenarioId): void;
  showPending(): void;
  showValidation(result: ValidationResult): void;
  clearFeedback(): void;
}

export interface InvestigationPanelHandlers {
  onLoadSolution: (sql: string) => void;
}

const STATUS_STYLE: Record<ValidationStatus, { box: string; title: string; icon: string; label: string }> = {
  success: { box: 'bg-emerald-950/40 border-emerald-500/50', title: 'text-emerald-300', icon: '✓', label: 'Sucesso' },
  error: { box: 'bg-rose-950/40 border-rose-500/50', title: 'text-rose-300', icon: '✕', label: 'Inconsistência' },
  warning: { box: 'bg-amber-950/40 border-amber-500/50', title: 'text-amber-300', icon: '!', label: 'Parcial' },
};

const block = (title: string, contentHtml: string): string => `
  <section class="rounded border border-slate-800 bg-slate-900/40">
    <h3 class="border-b border-slate-800 px-3 py-1.5 text-[10px] font-semibold uppercase tracking-wider text-slate-500">${title}</h3>
    <div class="px-3 py-2 text-xs leading-relaxed text-slate-300">${contentHtml}</div>
  </section>`;

function renderOriginBadge(s: InvestigationScenario): string {
  if (s.origem === 'base') return '';
  const label = s.origem === 'ia' ? `✨ Gerado por IA${s.modelo ? ` · ${s.modelo}` : ''}` : '⚙ Gerado offline';
  const tone = s.origem === 'ia' ? 'border-violet-600/60 bg-violet-500/10 text-violet-300' : 'border-slate-600 bg-slate-800/60 text-slate-300';
  return `
    <div class="flex items-center gap-2">
      <span class="rounded border px-1.5 py-0.5 font-mono text-[10px] ${tone}">${escapeHtml(label)}</span>
      <button type="button" data-remove-scenario="${escapeHtml(s.id)}"
        class="ml-auto rounded px-1.5 py-0.5 text-[10px] text-slate-500 hover:bg-rose-950/40 hover:text-rose-300">Remover desafio</button>
    </div>`;
}

function renderScenario(s: InvestigationScenario): string {
  return `
    ${renderOriginBadge(s)}
    <span class="inline-block rounded border border-amber-700/60 bg-amber-500/10 px-2 py-0.5 text-[10px] font-semibold text-amber-300">${escapeHtml(s.enquadramento)}</span>
    <h3 class="text-sm font-semibold text-slate-100">${escapeHtml(s.titulo)}</h3>
    ${block('Contexto da Denúncia / Dossiê', escapeHtml(s.dossie))}
    ${block(
      'Objetivo da Análise SQL',
      `<p>${formatInline(s.objetivo)}</p>
       <p class="mt-2 text-[11px] text-slate-500">Ordenação: ${formatInline(`\`ORDER BY ${s.ordenacao}\``)}</p>`,
    )}
    <details class="group rounded border border-slate-800 bg-slate-900/40">
      <summary class="flex cursor-pointer select-none items-center gap-2 px-3 py-1.5 text-[10px] font-semibold uppercase tracking-wider text-slate-500 hover:text-slate-300">
        <span class="transition-transform group-open:rotate-90">▶</span> Dica de Sintaxe SQL
      </summary>
      <div class="space-y-2 border-t border-slate-800 px-3 py-2">
        <p class="text-xs leading-relaxed text-slate-400">${escapeHtml(s.dicaTexto)}</p>
        <pre class="overflow-x-auto rounded bg-slate-950 p-2 font-mono text-[11px] leading-5 text-emerald-200">${escapeHtml(s.dicaSql)}</pre>
      </div>
    </details>`;
}

function renderHighlight({ lineNumber, line, token }: ErrorHighlight): string {
  const start = line.toLowerCase().indexOf(token.toLowerCase());
  const marked =
    start < 0
      ? escapeHtml(line)
      : `${escapeHtml(line.slice(0, start))}<mark class="rounded bg-rose-500/30 px-0.5 text-rose-100 underline decoration-rose-400 decoration-wavy">${escapeHtml(
          line.slice(start, start + token.length),
        )}</mark>${escapeHtml(line.slice(start + token.length))}`;
  return `
    <pre class="mt-2 overflow-x-auto rounded border border-rose-900/60 bg-slate-950 px-2 py-1 font-mono text-[11px] text-slate-300"><span class="mr-2 select-none text-slate-600">${lineNumber}</span>${marked}</pre>`;
}

function splitSqlComment(line: string): [code: string, comment: string] {
  let inString = false;
  for (let i = 0; i < line.length - 1; i++) {
    if (line[i] === "'") inString = !inString;
    if (!inString && line[i] === '-' && line[i + 1] === '-') return [line.slice(0, i), line.slice(i)];
  }
  return [line, ''];
}

function renderCommentedSql(sql: string): string {
  return sql
    .split('\n')
    .map((line, i) => {
      const [code, comment] = splitSqlComment(line);
      return `<span class="mr-3 inline-block w-5 select-none text-right text-slate-700">${i + 1}</span><span class="text-emerald-200">${escapeHtml(
        code,
      )}</span><span class="italic text-amber-200/70">${escapeHtml(comment)}</span>`;
    })
    .join('\n');
}

export function initInvestigationPanel({ onLoadSolution }: InvestigationPanelHandlers): InvestigationPanelController {
  const select = byId<HTMLSelectElement>('scenario-select');
  const card = byId('scenario-card');
  const feedback = byId('validation-feedback');
  const solution = byId('solution-panel');

  const firstScenario = baseScenarios()[0];
  if (!firstScenario) throw new Error('Nenhum cenário investigativo cadastrado.');

  const renderOptions = (): void => {
    const option = (s: InvestigationScenario, label: string): string =>
      `<option value="${escapeHtml(s.id)}"${s.id === selected.id ? ' selected' : ''}>${escapeHtml(label)}</option>`;
    const base = baseScenarios().map((s, i) => option(s, `${String(i + 1).padStart(2, '0')} · ${s.titulo}`));
    const generated = generatedScenarios().map((s) => option(s, `${s.origem === 'ia' ? '✨' : '⚙'} ${s.titulo}`));
    select.innerHTML =
      `<optgroup label="Desafios base">${base.join('')}</optgroup>` +
      (generated.length ? `<optgroup label="Gerados pelo agente (${generated.length})">${generated.join('')}</optgroup>` : '');
  };

  let selected = firstScenario;
  const attempts = new Map<ScenarioId, number>();

  const renderSolutionToggle = (): void => {
    const count = attempts.get(selected.id) ?? 0;
    if (count === 0) {
      solution.innerHTML = '';
      return;
    }
    solution.innerHTML = `
      <details class="group rounded border border-slate-700 bg-slate-900/60">
        <summary class="flex cursor-pointer select-none items-center gap-2 px-3 py-2 text-xs font-medium text-sky-300 hover:bg-slate-800/60">
          <span class="text-[10px] transition-transform group-open:rotate-90">▶</span>
          Ver Gabarito Comentado
          <span class="ml-auto text-[10px] font-normal text-slate-500">${count} tentativa${count > 1 ? 's' : ''}</span>
        </summary>
        <div class="space-y-2 border-t border-slate-800 p-2">
          <pre class="max-h-96 overflow-auto rounded bg-slate-950 p-2 font-mono text-[11px] leading-5">${renderCommentedSql(selected.gabaritoSql)}</pre>
          <button type="button" data-load-solution
            class="w-full rounded border border-slate-700 px-2 py-1 text-[11px] text-slate-300 hover:border-sky-700 hover:text-sky-200">
            Abrir gabarito no editor
          </button>
        </div>
      </details>`;
  };

  solution.addEventListener('click', (event) => {
    if ((event.target as HTMLElement).closest('[data-load-solution]')) onLoadSolution(selected.gabaritoSql);
  });

  const clearFeedback = (): void => {
    feedback.innerHTML = `
      <div class="rounded border border-dashed border-slate-800 px-3 py-2 text-[11px] text-slate-600">
        Escreva sua query e clique em <span class="text-sky-400">Validar Desafio</span> para receber o feedback.
      </div>`;
  };

  const show = (scenario: InvestigationScenario): void => {
    selected = scenario;
    select.value = scenario.id;
    card.innerHTML = renderScenario(scenario);
    clearFeedback();
    renderSolutionToggle();
  };

  select.addEventListener('change', () => {
    const scenario = findScenario(select.value);
    if (scenario) show(scenario);
  });

  card.addEventListener('click', (event) => {
    const id = (event.target as HTMLElement).closest<HTMLElement>('[data-remove-scenario]')?.dataset['removeScenario'];
    if (id && confirm('Remover este desafio gerado?')) removeGenerated(id);
  });

  onScenariosChange(() => {
    const current = findScenario(selected.id);
    if (!current) selected = firstScenario;
    renderOptions();
    if (!current) show(firstScenario);
  });

  renderOptions();
  show(firstScenario);

  return {
    getSelectedScenario: () => selected,
    selectScenario(id) {
      const scenario = findScenario(id);
      if (scenario) show(scenario);
    },
    showPending() {
      feedback.innerHTML = `
        <div class="flex items-center gap-2 rounded border border-slate-700 bg-slate-900/60 px-3 py-2 text-xs text-slate-400">
          <span class="size-3 animate-spin rounded-full border-2 border-slate-600 border-t-sky-400"></span>
          Comparando seu resultado com o gabarito…
        </div>`;
    },
    showValidation(result) {
      attempts.set(selected.id, (attempts.get(selected.id) ?? 0) + 1);
      const style = STATUS_STYLE[result.status];
      const details = result.details.length
        ? `<ul class="mt-2 list-disc space-y-1 pl-4 text-[11px] leading-relaxed text-slate-300">${result.details
            .map((d) => `<li>${formatInline(d)}</li>`)
            .join('')}</ul>`
        : '';
      const entities = result.entities.length
        ? `<div class="mt-2 flex flex-wrap gap-1">${result.entities
            .map(
              (e) =>
                `<span class="rounded border border-emerald-500/40 bg-emerald-500/10 px-1.5 py-px font-mono text-[10px] text-emerald-200">${escapeHtml(e)}</span>`,
            )
            .join('')}</div>`
        : '';

      feedback.innerHTML = `
        <div role="alert" class="rounded border px-3 py-2.5 ${style.box}">
          <div class="flex items-start gap-2">
            <span class="mt-px flex size-4 shrink-0 items-center justify-center rounded-full border border-current text-[9px] font-bold ${style.title}">${style.icon}</span>
            <div class="min-w-0 flex-1">
              <p class="text-[10px] font-semibold uppercase tracking-wider ${style.title} opacity-70">${style.label}</p>
              <p class="text-xs font-semibold ${style.title}">${escapeHtml(result.title)}</p>
              <p class="mt-1 text-[11px] leading-relaxed text-slate-200">${formatInline(result.message)}</p>
              ${result.highlight ? renderHighlight(result.highlight) : ''}
              ${entities}
              ${details}
            </div>
          </div>
        </div>`;
      renderSolutionToggle();
    },
    clearFeedback,
  };
}
