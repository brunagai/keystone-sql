import {
  baseScenarios,
  findScenario,
  generatedScenarios,
  onScenariosChange,
  removeGenerated,
} from '../challenges/registry.ts';
import { TRAIL_LEVELS, TRAIL_ORDER, type InvestigationScenario, type ScenarioId, type TrailLevel, type TwoPhaseReasoning } from '../challenges/scenarios.ts';
import { resolveTwoPhase } from '../challenges/twoPhase.ts';
import { escapeHtml, formatInline } from './format.ts';

function el<T extends HTMLElement>(id: string): T | null {
  return document.getElementById(id) as T | null;
}

export interface InvestigationPanelController {
  getSelectedScenario(): InvestigationScenario;
  selectScenario(id: ScenarioId): void;
  showValidation(): void;
}

export interface InvestigationPanelHandlers {
  onLoadSolution: (sql: string) => void;
  /** Disparado a cada troca de cenário (seleção manual, desafio gerado ou remoção do atual), exceto na carga inicial. */
  onScenarioChange: (scenario: InvestigationScenario) => void;
  /** Abre a gaveta do Dicionário de Tabelas sem o estudante sair da missão. */
  onOpenSchema?: () => void;
}

const levelLabel = (nivel: TrailLevel): string => `Nível ${nivel} — ${TRAIL_LEVELS[nivel].titulo}`;

type TrailBand = 'todos' | 'iniciante' | 'intermediario' | 'avancado';

const BAND_LEVELS: Record<TrailBand, readonly TrailLevel[]> = {
  todos: TRAIL_ORDER,
  iniciante: [1, 2],
  intermediario: [3],
  avancado: [4, 5],
};

const BAND_BUTTON_ON = 'rounded-full bg-sky-600 px-3 py-1 text-[12px] font-medium text-white';
const BAND_BUTTON_OFF = 'rounded-full px-3 py-1 text-[12px] font-medium text-slate-400 hover:bg-slate-800 hover:text-slate-100';

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
        <span class="text-sky-300">Testar Trecho</span>.
      </p>
    </div>`;
}

function missionLine(objetivo: string | undefined): string {
  const text = (objetivo ?? '').replace(/`/g, '').replace(/\s+/g, ' ').trim();
  if (!text) return 'Produza as evidências pedidas neste caso.';
  const stop = text.search(/[.!?]/);
  const sentence = stop >= 0 ? text.slice(0, stop + 1).trim() : text;
  return sentence.length > 220 ? `${sentence.slice(0, 217)}…` : sentence;
}

function expectedColumns(s: InvestigationScenario): readonly string[] {
  if (!Array.isArray(s.colunasEsperadas)) return [];
  return s.colunasEsperadas.filter((name): name is string => typeof name === 'string' && name.length > 0);
}

const COLUMN_ROLES: Readonly<Record<string, string>> = {
  acumulado_movel_3: 'o volume acumulado nas últimas originações da mesma conta',
  acumulado_movel_pep: 'o volume acumulado nas originações recentes do titular monitorado',
  cnpj_empresa: 'o CNPJ da empresa investigada',
  cpf_socio: 'o CPF do sócio no quadro societário',
  device_id: 'o identificador do dispositivo usado no acesso',
  forma_liquidacao: 'a forma como o aporte foi liquidado',
  geolocalizacao_cidade: 'a cidade inferida do login',
  nome_socio: 'o nome de quem figura no quadro societário',
  percentual_participacao: 'a fatia do capital detida pelo sócio',
  tipo_produto: 'o tipo de produto financeiro aportado',
  valor_aporte: 'o montante aportado no produto',
  valor_transacao: 'o valor da saída PIX correlacionada ao acesso',
  cargo_pep: 'o cargo público associado ao titular',
  canal: 'o canal por onde a operação foi disparada',
  conta_destino: 'identificador de quem recebeu o valor',
  conta_origem: 'identificador de quem enviou o valor',
  data_abertura: 'a data de abertura da conta',
  data_hora: 'a data e a hora da operação',
  fator_incompatibilidade: 'o quanto o valor destoa da renda declarada',
  faturamento_mensal: 'o faturamento mensal declarado',
  hora_transacao: 'a hora em que a operação ocorreu',
  id_conta: 'identificador da conta analisada',
  id_transacao: 'identificador da transação',
  intervalo_horas: 'o intervalo entre operações consecutivas',
  intervalo_segundos: 'o intervalo entre operações consecutivas',
  janela_hora: 'a janela horária em que as operações se concentraram',
  maior_pix: 'o maior valor movimentado no recorte',
  media_historica: 'a média histórica de valores daquela origem',
  multiplo_renda: 'quantas vezes o volume supera a renda declarada',
  ocupacao: 'a ocupação declarada no cadastro',
  origens_distintas: 'quantos remetentes distintos alimentaram a conta',
  proporcao: 'a proporção entre o valor e o perfil declarado',
  qtd_historico: 'quantas operações anteriores entram na comparação',
  qtd_no_dia: 'a quantidade de envios no mesmo dia',
  qtd_operacoes: 'a quantidade de operações suspeitas',
  qtd_pix: 'a quantidade de PIX no recorte',
  qtd_redondas: 'a quantidade de valores redondos',
  remetentes: 'quantos remetentes distintos participaram',
  renda_mensal: 'a renda mensal declarada',
  salto: 'o salto do valor em relação ao histórico',
  taxa_repasse: 'a proporção entre saídas e entradas',
  titular: 'quem figura como titular da conta',
  total_enviado: 'o montante financeiro enviado',
  total_no_dia: 'o montante financeiro acumulado no dia',
  total_operacoes: 'a quantidade de envios suspeitos',
  total_recebido: 'o montante financeiro recebido',
  total_recebido_mes: 'o montante financeiro recebido no mês',
  total_recebimentos: 'a quantidade de recebimentos',
  valor: 'o valor da operação',
  valor_recebido: 'o montante financeiro recebido',
  valor_total: 'o montante financeiro total acumulado',
};

function joinPt(parts: readonly string[]): string {
  if (parts.length === 0) return 'as evidências necessárias à esteira';
  if (parts.length === 1) return parts[0] ?? '';
  const last = parts[parts.length - 1] ?? '';
  return `${parts.slice(0, -1).join(', ')} e ${last}`;
}

function describeOutputGoal(columns: readonly string[]): string {
  const known: string[] = [];
  let unknown = 0;
  for (const column of columns) {
    const role = COLUMN_ROLES[column.toLowerCase()] ?? '';
    if (role) known.push(role);
    else unknown += 1;
  }
  if (unknown === 1) known.push('um atributo adicional da evidência (descubra o nome técnico no dicionário)');
  if (unknown > 1) known.push('os demais atributos da evidência (descubra os nomes técnicos no dicionário)');
  return `A sua consulta deve devolver evidências com: ${joinPt(known)}.`;
}

function renderExpectedOutput(s: InvestigationScenario): string {
  const columns = expectedColumns(s);
  const aliases = columns.map((c) => `\`${c}\``).join(', ') || '`—`';
  const ordenacao = s.ordenacao?.trim() || 'as colunas da evidência';
  return `
    <p class="text-[11px] font-semibold uppercase tracking-wider text-sky-400">Objetivo de negócio da saída</p>
    <p class="mt-1.5">${escapeHtml(describeOutputGoal(columns))}</p>
    <p class="text-[12px] leading-relaxed text-slate-500">
      Use o dicionário de tabelas para escolher as colunas reais. Os nomes técnicos abaixo só são necessários na hora de validar.
    </p>
    <details class="rounded-xl border border-slate-800 bg-slate-950/50">
      <summary class="cursor-pointer select-none px-3 py-2.5 text-[12px] font-medium text-slate-200 hover:text-sky-200">
        👁️ Revelar Nomes Técnicos e Aliases Esperados
      </summary>
      <div class="space-y-2 border-t border-slate-800 px-3 py-2.5 text-[12px] text-slate-400">
        <p>A esteira compara o resultado nesta ordem: ${formatInline(aliases)}.</p>
        <p>Ordene com ${formatInline(`\`ORDER BY ${ordenacao}\``)}.</p>
      </div>
    </details>`;
}

const tabButton = (id: string, label: string, selected: boolean): string => `
  <button type="button" data-tab="${id}" aria-selected="${String(selected)}"
    class="rounded-lg px-3 py-1.5 text-[12px] font-medium ${
      selected ? 'bg-slate-800 text-slate-50' : 'text-slate-500 hover:text-slate-200'
    }">
    ${label}
  </button>`;

function renderScenario(s: InvestigationScenario): string {
  const nivelMeta = TRAIL_LEVELS[s.nivel];
  const nivelTitulo = nivelMeta?.titulo ?? 'Trilha';
  return `
    ${renderOriginBadge(s)}
    <p class="text-[11px] font-medium uppercase tracking-wider text-slate-500">Nível ${escapeHtml(String(s.nivel))} · ${escapeHtml(nivelTitulo)}</p>
    <section id="mission-card" class="rounded-2xl bg-slate-900/40 p-5">
      <h3 class="text-lg font-semibold leading-snug text-slate-50">${escapeHtml(s.titulo ?? 'Caso investigativo')}</h3>
      <p class="mt-4 text-[11px] font-semibold uppercase tracking-wider text-sky-400">Sua Missão</p>
      <p class="mt-2 text-[15px] leading-relaxed text-slate-100">${escapeHtml(missionLine(s.objetivo))}</p>
    </section>
    <button type="button" data-open-schema
      class="inline-flex w-full items-center justify-center gap-2 rounded-xl border border-slate-700 bg-slate-900/50 px-3 py-2.5 text-[13px] font-medium text-slate-200 hover:border-sky-600 hover:bg-slate-800 hover:text-sky-100">
      📊 Consultar Tabelas Disponíveis
    </button>
    <div>
      <div role="tablist" aria-label="Detalhes do desafio" class="flex flex-wrap gap-1">
        ${tabButton('dica', '💡 Dica de SQL passo a passo', true)}
        ${tabButton('dossie', '📋 Dossiê / Contexto Policial', false)}
        ${tabButton('colunas', 'Colunas esperadas', false)}
      </div>
      <div data-tab-panel="dica" class="mt-3 space-y-3">
        <p class="text-[13px] leading-relaxed text-slate-300">${escapeHtml(s.dicaTexto ?? '')}</p>
        <pre class="overflow-x-auto rounded-xl bg-slate-950 p-3 font-mono text-[12px] leading-6 text-emerald-200">${escapeHtml(s.dicaSql ?? '')}</pre>
        ${renderTwoPhase(s)}
      </div>
      <div data-tab-panel="dossie" hidden class="mt-3 space-y-3">
        <p class="text-[12px] font-medium text-amber-200/90">${escapeHtml(s.enquadramento ?? '')}</p>
        <p class="text-[13px] leading-relaxed text-slate-400">${escapeHtml(s.dossie ?? '')}</p>
      </div>
      <div data-tab-panel="colunas" hidden class="mt-3 space-y-3 text-[13px] leading-relaxed text-slate-300">
        ${renderExpectedOutput(s)}
      </div>
    </div>`;
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

export function initInvestigationPanel({
  onLoadSolution,
  onScenarioChange,
  onOpenSchema,
}: InvestigationPanelHandlers): InvestigationPanelController {
  const select = el<HTMLSelectElement>('scenario-select');
  const card = el('scenario-card');
  const solution = el('solution-panel');
  const trailBands = el('trail-bands');
  let trailBand: TrailBand = 'todos';

  const firstScenario = baseScenarios()[0];
  if (!firstScenario) throw new Error('Nenhum cenário investigativo cadastrado.');

  let selected = firstScenario;
  const attempts = new Map<ScenarioId, number>();

  const renderOptions = (): void => {
    if (!select) return;
    const all = [...baseScenarios(), ...generatedScenarios()];
    select.innerHTML = BAND_LEVELS[trailBand]
      .map((nivel) => {
        const items = all.filter((s) => s.nivel === nivel);
        const options = items.length
          ? items
              .map((s, i) => {
                const marker = s.origem === 'base' ? '' : `${s.origem === 'ia' ? '✨' : '⚙'} `;
                const label = `${nivel}.${i + 1} · ${marker}${s.titulo ?? s.id}`;
                return `<option value="${escapeHtml(s.id)}"${s.id === selected.id ? ' selected' : ''}>${escapeHtml(label)}</option>`;
              })
              .join('')
          : '<option disabled>Use “✨ Gerar Novo Desafio com IA” para abrir este nível</option>';
        const count = nivel === 5 && items.length ? ` (${items.length})` : '';
        return `<optgroup label="${escapeHtml(levelLabel(nivel))}${count}">${options}</optgroup>`;
      })
      .join('');
    select.value = selected.id;
  };

  const renderSolutionToggle = (): void => {
    if (!solution) return;
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
          <pre class="max-h-80 overflow-auto rounded-xl bg-slate-950 p-3 font-mono text-[12px] leading-6">${renderCommentedSql(selected.gabaritoSql ?? '')}</pre>
          <button type="button" data-load-solution
            class="w-full rounded-lg border border-slate-700 px-3 py-2 text-[12px] text-slate-300 hover:border-sky-600 hover:text-sky-200">
            Abrir gabarito no editor
          </button>
        </div>
      </details>`;
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
        card.innerHTML = renderScenario(scenario);
      } catch (error) {
        card.innerHTML = `<p class="text-sm text-rose-300">${escapeHtml(error instanceof Error ? error.message : String(error))}</p>`;
      }
    }
    renderSolutionToggle();
    if (notify && changed) onScenarioChange(scenario);
  };

  if (trailBands) {
    trailBands.addEventListener('click', (event) => {
      const target = event.target;
      if (!(target instanceof Element)) return;
      const band = target.closest<HTMLElement>('[data-trail-band]')?.dataset['trailBand'];
      if (band !== 'todos' && band !== 'iniciante' && band !== 'intermediario' && band !== 'avancado') return;
      trailBand = band;
      for (const button of trailBands.querySelectorAll<HTMLElement>('[data-trail-band]')) {
        button.className = button.dataset['trailBand'] === trailBand ? BAND_BUTTON_ON : BAND_BUTTON_OFF;
      }
      renderOptions();
    });
  }

  if (select) {
    select.addEventListener('change', () => {
      const scenario = findScenario(select.value);
      if (scenario) show(scenario);
    });
  }

  if (card) {
    card.addEventListener('click', (event) => {
      const target = event.target;
      if (!(target instanceof Element)) return;
      if (target.closest('[data-open-schema]')) {
        onOpenSchema?.();
        return;
      }
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
  }

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
    showValidation() {
      attempts.set(selected.id, (attempts.get(selected.id) ?? 0) + 1);
      renderSolutionToggle();
    },
  };
}
