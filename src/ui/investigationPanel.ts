import {
  baseScenarios,
  findScenario,
  generatedScenarios,
  onScenariosChange,
  removeGenerated,
} from '../challenges/registry.ts';
import { DEFAULT_SCENARIO_ID, TRAIL_BAND_LEVELS, TRAIL_LEVELS, ensureRelatorioColunas, trailBandOf, trailOptgroupLabel, type InvestigationScenario, type ScenarioId, type TrailBand, type TrailLevel, type TwoPhaseReasoning } from '../challenges/scenarios.ts';
import { resolveTwoPhase } from '../challenges/twoPhase.ts';
import { isChallengeCompleted, markChallengeCompleted, PROGRESS_UPDATED_EVENT } from '../services/progressService.ts';
import { showMissionOverlay } from './layout.ts';
import { escapeHtml, formatInline } from './format.ts';

function el<T extends HTMLElement>(id: string): T | null {
  return document.getElementById(id) as T | null;
}

export interface InvestigationPanelController {
  getSelectedScenario(): InvestigationScenario;
  getTrailBand(): TrailBand;
  selectScenario(id: ScenarioId, options?: { syncBand?: boolean }): void;
  /** Avança ou recua na trilha completa (`SCENARIOS` + gerados). Devolve false nas extremidades. */
  stepScenario(delta: -1 | 1): boolean;
  hasNextScenario(): boolean;
  showValidation(approved?: boolean): void;
}

export interface InvestigationPanelHandlers {
  onLoadSolution: (sql: string) => void;
  /** Disparado a cada troca de cenário (seleção manual, desafio gerado ou remoção do atual), exceto na carga inicial. */
  onScenarioChange: (scenario: InvestigationScenario) => void;
  /** Alterna a coluna esquerda entre a missão e o dicionário de tabelas. */
  onOpenSchema?: () => void;
}

const levelLabel = (nivel: TrailLevel): string => trailOptgroupLabel(nivel);


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
    <div class="space-y-2">
      ${step('1', phases.fase1)}
      ${step('2', phases.fase2)}
      <p class="text-[12px] leading-relaxed text-slate-500">
        Para ver o meio do caminho, selecione o trecho do <code class="font-mono text-slate-400">WITH</code> e use
        <span class="text-sky-300">Rodar Teste</span>.
      </p>
    </div>`;
}

function missionLine(s: InvestigationScenario): string {
  const text = ensureRelatorioColunas((s.objetivo ?? '').replace(/`/g, ''));
  return text || 'Produza as evidências pedidas neste caso.';
}

function expectedColumns(s: InvestigationScenario): readonly string[] {
  if (!Array.isArray(s.colunasEsperadas)) return [];
  return s.colunasEsperadas.filter((name): name is string => typeof name === 'string' && name.length > 0);
}

function renderSuggestedColumnsBody(s: InvestigationScenario): string {
  const columns = expectedColumns(s);
  if (!columns.length) {
    return `<p class="leading-relaxed text-slate-400">Consulte o dicionário de tabelas para montar a evidência.</p>`;
  }
  const itens = columns.map((column) => `<li><code class="font-mono text-sky-300">${escapeHtml(column)}</code></li>`).join('');
  return `<ul class="list-disc space-y-1 pl-5 leading-relaxed">${itens}</ul>`;
}

const ACCORDION_CLASS =
  'group rounded-xl border border-slate-800 bg-slate-900/50 p-3 text-xs text-slate-300 transition-colors hover:bg-slate-900/80';

const ACCORDION_SUMMARY_CLASS =
  'flex cursor-pointer list-none select-none items-center gap-2 text-xs font-medium text-slate-400 hover:text-slate-200 [&::-webkit-details-marker]:hidden';

function renderAccordion(titulo: string, corpo: string, extraSummary = ''): string {
  return `
    <details class="${ACCORDION_CLASS}">
      <summary class="${ACCORDION_SUMMARY_CLASS}">
        <span class="text-[10px] text-slate-500 transition group-open:rotate-90" aria-hidden="true">▸</span>
        <span class="min-w-0 flex-1">${titulo}</span>
        ${extraSummary}
      </summary>
      <div class="mt-3 space-y-2 border-t border-slate-800/80 pt-3">${corpo}</div>
    </details>`;
}

const SCHEMA_BUTTON_CLASS =
  'flex w-full items-center justify-center gap-2 rounded-xl border border-slate-800 bg-slate-900/50 px-3 py-2.5 text-xs font-medium text-slate-200 transition-colors hover:bg-slate-900/80';

function renderSchemaButton(): string {
  return `<button type="button" data-open-schema class="${SCHEMA_BUTTON_CLASS}">📊 Consultar Tabelas Disponíveis</button>`;
}

function renderSqlHintBody(s: InvestigationScenario): string {
  return `
    <p class="text-[13px] leading-relaxed text-slate-300">${escapeHtml(s.dicaTexto ?? '')}</p>
    <pre class="overflow-x-auto rounded-xl bg-slate-950 p-3 font-mono text-[12px] leading-6 text-emerald-200">${escapeHtml(s.dicaSql ?? '')}</pre>
    ${renderTwoPhase(s)}`;
}

function renderDossierBody(s: InvestigationScenario): string {
  return `
    <p class="text-[11px] font-semibold uppercase tracking-wider text-amber-200/80">${escapeHtml(s.enquadramento ?? '')}</p>
    <p class="text-[13px] leading-relaxed text-slate-400">${escapeHtml(s.dossie ?? '')}</p>`;
}

function renderSupportStack(s: InvestigationScenario, tentativas = 0): string {
  return `
    <div class="mt-3 flex flex-col gap-2.5">
      ${renderSchemaButton()}
      ${renderAccordion('🏛️ Contexto Regulatório (Bacen/COAF)', renderDossierBody(s))}
      ${renderAccordion('💡 Colunas Sugeridas', renderSuggestedColumnsBody(s))}
      ${renderAccordion('🔍 Dica de SQL', renderSqlHintBody(s))}
      ${renderGabaritoAccordion(s, tentativas)}
    </div>`;
}

function renderGabaritoAccordion(s: InvestigationScenario, tentativas: number): string {
  if (tentativas <= 0) return '';
  const extra = `<span class="text-[11px] font-normal text-slate-500">${tentativas} tentativa${tentativas > 1 ? 's' : ''}</span>`;
  return renderAccordion(
    '📖 Gabarito Comentado',
    `${renderDidacticGabarito(s)}
        <button type="button" data-load-solution
          class="w-full rounded-lg border border-slate-700 px-3 py-2 text-[12px] text-slate-300 hover:border-sky-600 hover:text-sky-200">
          Abrir gabarito no editor
        </button>`,
    extra,
  );
}

function renderScenario(s: InvestigationScenario, tentativas = 0): string {
  const nivelMeta = TRAIL_LEVELS[s.nivel];
  const nivelTitulo = nivelMeta?.titulo ?? 'Trilha';
  return `
    ${renderOriginBadge(s)}
    <section id="mission-card" class="rounded-2xl border border-slate-800/80 bg-slate-900/40 p-5">
      <p class="text-[11px] font-medium uppercase tracking-wider text-slate-500">Nível ${escapeHtml(String(s.nivel))} · ${escapeHtml(nivelTitulo)}</p>
      <h3 class="mt-1.5 text-lg font-semibold leading-snug text-slate-50">${escapeHtml(s.titulo ?? 'Caso investigativo')}</h3>
      <p class="mt-4 text-[11px] font-semibold uppercase tracking-wider text-sky-400">Sua Missão</p>
      <p class="mt-2 text-[15px] leading-relaxed text-slate-100">${escapeHtml(missionLine(s))}</p>
    </section>
    ${renderSupportStack(s, tentativas)}`;
}

function renderMobileDossier(s: InvestigationScenario, tentativas = 0): string {
  return renderSupportStack(s, tentativas);
}

function paintMobileBriefing(s: InvestigationScenario, tentativas = 0): void {
  const level = document.getElementById('mobile-briefing-level');
  const title = document.getElementById('mobile-briefing-title');
  const text = document.getElementById('mobile-briefing-text');
  const dossier = document.getElementById('mobile-dossier-body');
  const nivelMeta = TRAIL_LEVELS[s.nivel];
  if (level) level.textContent = `Nível ${s.nivel}${nivelMeta ? ` · ${nivelMeta.titulo}` : ''}`;
  if (title) title.textContent = s.titulo ?? 'Caso investigativo';
  if (text) text.textContent = missionLine(s);
  if (dossier) dossier.innerHTML = renderMobileDossier(s, tentativas);
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

function renderDidacticGabarito(scenario: InvestigationScenario): string {
  const aula = scenario.explicacaoGabarito;
  if (!aula) {
    return `<pre class="max-h-80 overflow-auto rounded-xl bg-slate-950 p-3 font-mono text-[12px] leading-6">${renderCommentedSql(scenario.gabaritoSql ?? '')}</pre>`;
  }

  const passos = aula.passos
    .map(
      (passo) => `
        <li class="space-y-1">
          <code class="block font-mono text-cyan-300 text-xs bg-slate-950/80 px-2 py-1 rounded border border-slate-800/80 break-words">${escapeHtml(passo.linha)}</code>
          <p class="text-xs text-slate-300">${formatInline(passo.explicacao)}</p>
        </li>`,
    )
    .join('');

  const atencao = aula.atencao
    ? `
      <div class="bg-amber-950/20 border border-amber-500/30 rounded-md p-2.5 mt-3">
        <p class="text-xs font-semibold text-amber-300">⚠️ Ponto de Atenção</p>
        <p class="mt-1 text-xs text-amber-200/90 leading-relaxed">${formatInline(aula.atencao)}</p>
      </div>`
    : '';

  return `
    <div class="bg-slate-900/60 border border-slate-800 rounded-md p-3 mb-3">
      <p class="text-xs font-semibold text-slate-300 mb-1">💡 Raciocínio de Negócio</p>
      <p class="text-xs text-slate-400 leading-relaxed">${formatInline(aula.raciocinio)}</p>
    </div>
    <div>
      <p class="text-xs font-semibold text-slate-300 mb-2">🛠️ Decomposição da Consulta</p>
      <ol class="space-y-3 list-none p-0 m-0">${passos}</ol>
    </div>
    ${atencao}`;
}

export function initInvestigationPanel({
  onLoadSolution,
  onScenarioChange,
  onOpenSchema,
}: InvestigationPanelHandlers): InvestigationPanelController {
  const select = el<HTMLSelectElement>('scenario-select');
  const card = el('scenario-card');
  const solution = el('solution-panel');

  const firstScenario = findScenario(DEFAULT_SCENARIO_ID) ?? baseScenarios()[0];
  if (!firstScenario) throw new Error('Nenhum cenário investigativo cadastrado.');

  let selected = firstScenario;
  const attempts = new Map<ScenarioId, number>();
  const prevButton = el<HTMLButtonElement>('btn-prev-scenario');
  const nextButton = el<HTMLButtonElement>('btn-next-scenario');

  const catalog = (): InvestigationScenario[] => [...baseScenarios(), ...generatedScenarios()];

  const paintStepButtons = (): void => {
    const all = catalog();
    const index = all.findIndex((s) => s.id === selected.id);
    if (prevButton) prevButton.disabled = index <= 0;
    if (nextButton) nextButton.disabled = index < 0 || index >= all.length - 1;
  };

  const renderOptions = (): void => {
    if (!select) return;
    const all = catalog();
    select.innerHTML = TRAIL_BAND_LEVELS.todos
      .map((nivel) => {
        const items = all.filter((s) => s.nivel === nivel);
        const options = items.length
          ? items
              .map((s, i) => {
                const done = isChallengeCompleted(s.id) ? '✓ ' : '';
                const marker = s.origem === 'base' ? '' : `${s.origem === 'ia' ? '✨' : '⚙'} `;
                const label = `${done}${nivel}.${i + 1} · ${marker}${s.titulo ?? s.id}`;
                return `<option value="${escapeHtml(s.id)}"${s.id === selected.id ? ' selected' : ''}>${escapeHtml(label)}</option>`;
              })
              .join('')
          : '<option disabled>Use “✨ Gerar Novo Desafio com IA” para abrir este nível</option>';
        return `<optgroup label="${escapeHtml(levelLabel(nivel))}">${options}</optgroup>`;
      })
      .join('');
    select.value = selected.id;
  };

  const renderSolutionToggle = (): void => {
    if (solution) solution.innerHTML = '';
  };

  if (solution) {
    solution.addEventListener('click', (event) => {
      const target = event.target;
      if (!(target instanceof Element)) return;
      if (target.closest('[data-load-solution]')) onLoadSolution(selected.gabaritoSql);
    });
  }

  const show = (scenario: InvestigationScenario, notify = true): void => {
    const changed = scenario.id !== selected.id;
    selected = scenario;
    if (select) select.value = scenario.id;
    if (card) {
      try {
        card.innerHTML = renderScenario(scenario, attempts.get(scenario.id) ?? 0);
      } catch (error) {
        card.innerHTML = `<p class="text-sm text-rose-300">${escapeHtml(error instanceof Error ? error.message : String(error))}</p>`;
      }
    }
    renderSolutionToggle();
    paintMobileBriefing(scenario, attempts.get(scenario.id) ?? 0);
    paintStepButtons();
    if (notify && changed) onScenarioChange(scenario);
  };

  const stepScenario = (delta: -1 | 1): boolean => {
    const all = catalog();
    const index = all.findIndex((s) => s.id === selected.id);
    const next = index >= 0 ? all[index + delta] : undefined;
    if (!next) return false;
    renderOptions();
    show(next);
    return true;
  };

  if (select) {
    select.addEventListener('change', () => {
      const scenario = findScenario(select.value);
      if (scenario) show(scenario);
    });
  }

  prevButton?.addEventListener('click', () => {
    stepScenario(-1);
  });
  nextButton?.addEventListener('click', () => {
    stepScenario(1);
  });

  const dossierDialog = el<HTMLDialogElement>('mobile-dossier-dialog');
  const dossierButton = el('btn-mobile-dossier');

  const closeDossier = (): void => {
    if (dossierDialog?.open) dossierDialog.close();
  };

  dossierButton?.addEventListener('click', () => {
    paintMobileBriefing(selected, attempts.get(selected.id) ?? 0);
    dossierDialog?.showModal();
  });

  dossierDialog?.addEventListener('click', (event) => {
    const target = event.target;
    if (!(target instanceof Element)) return;
    if (target === dossierDialog || target.closest('[data-close-dialog]')) {
      closeDossier();
      return;
    }
    if (target.closest('[data-open-schema]')) {
      closeDossier();
      showMissionOverlay();
      onOpenSchema?.();
      return;
    }
    if (target.closest('[data-load-solution]')) {
      closeDossier();
      onLoadSolution(selected.gabaritoSql);
    }
  });

  if (card) {
    card.addEventListener('click', (event) => {
      const target = event.target;
      if (!(target instanceof Element)) return;
      if (target.closest('[data-open-schema]')) {
        onOpenSchema?.();
        return;
      }
      if (target.closest('[data-load-solution]')) {
        onLoadSolution(selected.gabaritoSql);
        return;
      }
      const id = target.closest<HTMLElement>('[data-remove-scenario]')?.dataset['removeScenario'];
      if (id && confirm('Remover este desafio gerado?')) removeGenerated(id);
    });
  }

  onScenariosChange(() => {
    const current = findScenario(selected.id);
    renderOptions();
    if (!current) show(firstScenario);
    else paintStepButtons();
  });

  window.addEventListener(PROGRESS_UPDATED_EVENT, () => renderOptions());

  renderOptions();
  show(firstScenario, false);

  return {
    getSelectedScenario: () => selected,
    getTrailBand: () => trailBandOf(selected.nivel),
    selectScenario(id) {
      const scenario = findScenario(id);
      if (!scenario) return;
      renderOptions();
      show(scenario);
    },
    stepScenario,
    hasNextScenario() {
      const all = catalog();
      const index = all.findIndex((s) => s.id === selected.id);
      return index >= 0 && index < all.length - 1;
    },
    showValidation(approved = false) {
      attempts.set(selected.id, (attempts.get(selected.id) ?? 0) + 1);
      if (approved) markChallengeCompleted(selected.id);
      show(selected, false);
    },
  };
}
