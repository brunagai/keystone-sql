import {
  baseScenarios,
  findScenario,
  generatedScenarios,
  onScenariosChange,
  removeGenerated,
} from '../challenges/registry.ts';
import { TRAIL_LEVELS, TRAIL_ORDER, type InvestigationScenario, type ScenarioId, type TrailLevel, type TwoPhaseReasoning } from '../challenges/scenarios.ts';
import { resolveTwoPhase } from '../challenges/twoPhase.ts';
import type { ErrorHighlight } from '../challenges/sqlErrors.ts';
import type { ValidationResult, ValidationStatus } from '../challenges/validator.ts';
import { byId } from './dom.ts';
import { escapeHtml, formatInline } from './format.ts';
import { bindPopover } from './popover.ts';

export interface InvestigationPanelController {
  getSelectedScenario(): InvestigationScenario;
  selectScenario(id: ScenarioId): void;
  showPending(): void;
  showValidation(result: ValidationResult): void;
  clearFeedback(): void;
}

export interface InvestigationPanelHandlers {
  onLoadSolution: (sql: string) => void;
  /** Disparado a cada troca de cenário (seleção manual, desafio gerado ou remoção do atual), exceto na carga inicial. */
  onScenarioChange: (scenario: InvestigationScenario) => void;
}

const STATUS_STYLE: Record<ValidationStatus, { box: string; title: string; icon: string; label: string }> = {
  success: { box: 'bg-emerald-950/40 border-emerald-500/50', title: 'text-emerald-300', icon: '✓', label: 'Esteira em conformidade' },
  error: { box: 'bg-rose-950/40 border-rose-500/50', title: 'text-rose-300', icon: '✕', label: 'Inconsistência' },
  warning: { box: 'bg-amber-950/40 border-amber-500/50', title: 'text-amber-300', icon: '!', label: 'Parcial' },
};

const levelLabel = (nivel: TrailLevel): string => `Nível ${nivel} — ${TRAIL_LEVELS[nivel].titulo}`;

type TrailBand = 'todos' | 'iniciante' | 'intermediario' | 'avancado';

const BAND_LEVELS: Record<TrailBand, readonly TrailLevel[]> = {
  todos: TRAIL_ORDER,
  iniciante: [1, 2],
  intermediario: [3],
  avancado: [4, 5],
};

const BAND_BUTTON_ON = 'rounded-full bg-slate-800 px-2.5 py-1 text-[11px] font-medium text-slate-100';
const BAND_BUTTON_OFF = 'rounded-full px-2.5 py-1 text-[11px] font-medium text-slate-400 hover:bg-slate-800 hover:text-slate-200';

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

function renderTwoPhase(s: InvestigationScenario): string {
  const phases = resolveTwoPhase(s);
  if (!phases) return '';
  const step = (n: '1' | '2', phase: TwoPhaseReasoning['fase1']): string => `
    <div class="rounded-xl bg-slate-900/50 px-3 py-2.5">
      <p class="mb-1 text-[11px] font-semibold text-violet-300">${n}. ${formatInline(phase.titulo)}</p>
      <p class="text-[13px] leading-relaxed text-slate-300">${formatInline(phase.texto)}</p>
    </div>`;
  return `
    <div class="mt-4 space-y-2">
      ${step('1', phases.fase1)}
      ${step('2', phases.fase2)}
      <p class="text-[12px] leading-relaxed text-slate-500">
        Para ver o meio do caminho, selecione o trecho do <code class="font-mono text-slate-400">WITH</code> e use
        <span class="text-sky-300">Testar CTE</span>.
      </p>
    </div>`;
}

function missionLine(objetivo: string): string {
  const text = objetivo.replace(/`/g, '').replace(/\s+/g, ' ').trim();
  const sentence = text.split(/(?<=[.!?])\s+/)[0] ?? text;
  return sentence.length > 220 ? `${sentence.slice(0, 217)}…` : sentence;
}

const tabButton = (id: string, label: string, selected: boolean): string => `
  <button type="button" data-tab="${id}" aria-selected="${String(selected)}"
    class="rounded-lg px-3 py-1.5 text-[12px] font-medium ${
      selected ? 'bg-slate-800 text-slate-50' : 'text-slate-500 hover:text-slate-200'
    }">
    ${label}
  </button>`;

function renderScenario(s: InvestigationScenario): string {
  return `
    ${renderOriginBadge(s)}
    <p class="text-[11px] font-medium uppercase tracking-wider text-slate-500">Nível ${s.nivel} · ${escapeHtml(TRAIL_LEVELS[s.nivel].titulo)}</p>
    <section class="rounded-2xl bg-slate-900/40 p-5">
      <h3 class="text-lg font-semibold leading-snug text-slate-50">${escapeHtml(s.titulo)}</h3>
      <p class="mt-4 text-[11px] font-semibold uppercase tracking-wider text-sky-400">Sua Missão</p>
      <p class="mt-2 text-[15px] leading-relaxed text-slate-100">${escapeHtml(missionLine(s.objetivo))}</p>
    </section>
    <div>
      <div role="tablist" aria-label="Detalhes do desafio" class="flex flex-wrap gap-1">
        ${tabButton('dica', '💡 Dica de SQL passo a passo', true)}
        ${tabButton('dossie', '📋 Dossiê / Contexto Policial', false)}
        ${tabButton('colunas', 'Colunas esperadas', false)}
      </div>
      <div data-tab-panel="dica" class="mt-3 space-y-3">
        <p class="text-[13px] leading-relaxed text-slate-300">${escapeHtml(s.dicaTexto)}</p>
        <pre class="overflow-x-auto rounded-xl bg-slate-950 p-3 font-mono text-[12px] leading-6 text-emerald-200">${escapeHtml(s.dicaSql)}</pre>
        ${renderTwoPhase(s)}
      </div>
      <div data-tab-panel="dossie" hidden class="mt-3 space-y-3">
        <p class="text-[12px] font-medium text-amber-200/90">${escapeHtml(s.enquadramento)}</p>
        <p class="text-[13px] leading-relaxed text-slate-400">${escapeHtml(s.dossie)}</p>
      </div>
      <div data-tab-panel="colunas" hidden class="mt-3 space-y-2 text-[13px] leading-relaxed text-slate-300">
        <p>${formatInline(s.objetivo)}</p>
        <p class="text-slate-400">Colunas: ${formatInline(s.colunasEsperadas.map((c) => `\`${c}\``).join(', '))}</p>
        <p class="text-slate-500">Ordene com ${formatInline(`\`ORDER BY ${s.ordenacao}\``)}.</p>
      </div>
    </div>`;
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

export function initInvestigationPanel({ onLoadSolution, onScenarioChange }: InvestigationPanelHandlers): InvestigationPanelController {
  const select = byId<HTMLSelectElement>('scenario-select');
  const card = byId('scenario-card');
  const feedback = byId('validation-feedback');
  const solution = byId('solution-panel');
  const trailLabel = byId('trail-menu-label');
  const trailMenu = bindPopover(byId<HTMLButtonElement>('btn-trail'), byId('trail-menu'));
  const trailBands = byId('trail-bands');
  let trailBand: TrailBand = 'todos';

  const firstScenario = baseScenarios()[0];
  if (!firstScenario) throw new Error('Nenhum cenário investigativo cadastrado.');

  const renderOptions = (): void => {
    const all = [...baseScenarios(), ...generatedScenarios()];
    select.innerHTML = BAND_LEVELS[trailBand].map((nivel) => {
      const items = all.filter((s) => s.nivel === nivel);
      const options = items.length
        ? items
            .map((s, i) => {
              const marker = s.origem === 'base' ? '' : `${s.origem === 'ia' ? '✨' : '⚙'} `;
              const label = `${nivel}.${i + 1} · ${marker}${s.titulo}`;
              return `<option value="${escapeHtml(s.id)}"${s.id === selected.id ? ' selected' : ''}>${escapeHtml(label)}</option>`;
            })
            .join('')
        : '<option disabled>Use “✨ Gerar Novo Desafio com IA” para abrir este nível</option>';
      const count = nivel === 5 && items.length ? ` (${items.length})` : '';
      return `<optgroup label="${escapeHtml(levelLabel(nivel))}${count}">${options}</optgroup>`;
    }).join('');
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
      <details class="group rounded-xl bg-slate-900/40">
        <summary class="flex cursor-pointer select-none items-center gap-2 px-4 py-2.5 text-sm font-medium text-sky-300 hover:bg-slate-800/40">
          Ver gabarito comentado
          <span class="ml-auto text-[12px] font-normal text-slate-500">${count} tentativa${count > 1 ? 's' : ''}</span>
        </summary>
        <div class="space-y-2 border-t border-slate-800 p-3">
          <pre class="max-h-80 overflow-auto rounded-xl bg-slate-950 p-3 font-mono text-[12px] leading-6">${renderCommentedSql(selected.gabaritoSql)}</pre>
          <button type="button" data-load-solution
            class="w-full rounded-lg border border-slate-700 px-3 py-2 text-[12px] text-slate-300 hover:border-sky-600 hover:text-sky-200">
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
      <p class="text-[12px] leading-relaxed text-slate-500">
        Quando terminar, clique em <span class="text-sky-300">Validar Resposta</span> para conferir se a consulta encontrou as movimentações certas.
      </p>`;
  };

  const show = (scenario: InvestigationScenario, notify = true): void => {
    const changed = scenario.id !== selected.id;
    selected = scenario;
    select.value = scenario.id;
    trailLabel.textContent = `${scenario.nivel} · ${scenario.titulo}`;
    card.innerHTML = renderScenario(scenario);
    clearFeedback();
    renderSolutionToggle();
    if (notify && changed) onScenarioChange(scenario);
  };

  trailBands.addEventListener('click', (event) => {
    const band = (event.target as HTMLElement).closest<HTMLElement>('[data-trail-band]')?.dataset['trailBand'];
    if (band !== 'todos' && band !== 'iniciante' && band !== 'intermediario' && band !== 'avancado') return;
    trailBand = band;
    for (const button of trailBands.querySelectorAll<HTMLElement>('[data-trail-band]')) {
      button.className = button.dataset['trailBand'] === trailBand ? BAND_BUTTON_ON : BAND_BUTTON_OFF;
    }
    renderOptions();
  });

  select.addEventListener('change', () => {
    const scenario = findScenario(select.value);
    if (scenario) show(scenario);
    trailMenu.close();
  });

  card.addEventListener('click', (event) => {
    const target = event.target as HTMLElement;
    const tab = target.closest<HTMLElement>('[data-tab]')?.dataset['tab'];
    if (tab) {
      for (const button of card.querySelectorAll<HTMLElement>('[data-tab]')) {
        const on = button.dataset['tab'] === tab;
        button.setAttribute('aria-selected', String(on));
        button.className = `rounded-lg px-3 py-1.5 text-[12px] font-medium ${on ? 'bg-slate-800 text-slate-50' : 'text-slate-500 hover:text-slate-200'}`;
      }
      for (const panel of card.querySelectorAll<HTMLElement>('[data-tab-panel]')) {
        panel.hidden = panel.dataset['tabPanel'] !== tab;
      }
      return;
    }
    const id = target.closest<HTMLElement>('[data-remove-scenario]')?.dataset['removeScenario'];
    if (id && confirm('Remover este desafio gerado?')) removeGenerated(id);
  });

  onScenariosChange(() => {
    const current = findScenario(selected.id);
    renderOptions();
    if (!current) show(firstScenario);
  });

  renderOptions();
  show(firstScenario, false);

  return {
    getSelectedScenario: () => selected,
    selectScenario(id) {
      const scenario = findScenario(id);
      if (scenario) show(scenario);
    },
    showPending() {
      feedback.innerHTML = `
        <div class="flex items-center gap-2 rounded-xl bg-slate-900/50 px-4 py-3 text-sm text-slate-400">
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

      const metrics =
        result.status === 'success' && result.compliance
          ? `<div class="mt-2 grid grid-cols-3 gap-1 font-mono text-[10px] leading-tight">
              <div class="rounded border border-emerald-500/30 bg-emerald-500/10 px-1.5 py-1">
                <p class="text-[9px] uppercase tracking-wider text-emerald-400/80">Alertas</p>
                <p class="font-semibold text-emerald-200">${result.compliance.captured}/${result.compliance.expected} (${result.compliance.recallPct}%)</p>
              </div>
              <div class="rounded border border-emerald-500/30 bg-emerald-500/10 px-1.5 py-1">
                <p class="text-[9px] uppercase tracking-wider text-emerald-400/80">Falsos +</p>
                <p class="font-semibold text-emerald-200">${result.compliance.falsePositives}</p>
              </div>
              <div class="rounded border border-emerald-500/30 bg-emerald-500/10 px-1.5 py-1">
                <p class="text-[9px] uppercase tracking-wider text-emerald-400/80">Eficiência</p>
                <p class="font-semibold text-emerald-200">${result.compliance.efficiencyPct}%</p>
              </div>
            </div>`
          : '';

      feedback.innerHTML = `
        <div role="alert" class="rounded-xl px-4 py-3 ${style.box}">
          <div class="flex items-start gap-2">
            <span class="mt-px flex size-4 shrink-0 items-center justify-center rounded-full border border-current text-[9px] font-bold ${style.title}">${style.icon}</span>
            <div class="min-w-0 flex-1">
              <p class="text-[10px] font-semibold uppercase tracking-wider ${style.title} opacity-70">${style.label}</p>
              <p class="text-xs font-semibold leading-snug ${style.title}">${escapeHtml(result.title)}</p>
              <p class="mt-1 text-[11px] leading-relaxed text-slate-200">${formatInline(result.message)}</p>
              ${metrics}
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
