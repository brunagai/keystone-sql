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

const ALIAS_LABELS: Readonly<Record<string, string>> = {
  acumulado_movel_3: 'Acúmulo móvel das últimas originações',
  acumulado_movel_pep: 'Acúmulo móvel nas originações do titular monitorado',
  canal: 'Canal da originação',
  data_abertura: 'Data de abertura da conta',
  faturamento_mensal: 'Faturamento mensal declarado',
  janela_hora: 'Janela horária da concentração',
  multiplo_renda: 'Quantas vezes o volume supera a renda',
  origens_distintas: 'Quantidade de remetentes distintos',
  proporcao: 'Proporção entre o valor e o perfil declarado',
  qtd_operacoes: 'Quantidade de operações no recorte',
  qtd_pix: 'Quantidade de PIX no recorte',
  qtd_redondas: 'Quantidade de valores redondos',
  remetentes: 'Quantidade de remetentes distintos',
  taxa_repasse: 'Proporção entre saídas e entradas',
  total_recebido_mes: 'Montante recebido no período',
  total_recebimentos: 'Quantidade de recebimentos',
  valor_recebido: 'Montante financeiro recebido',
  cidade_destino: 'Cidade do acesso mais recente',
  cidade_origem: 'Cidade do acesso anterior',
  cnpj_empresa: 'CNPJ da empresa investigada',
  conta_destino: 'Identificador de quem recebeu',
  conta_intermediaria: 'Identificador da conta intermediária',
  conta_origem: 'Identificador de quem enviou',
  conta_passagem: 'Identificador da conta de passagem',
  cpf_socio: 'CPF do sócio no quadro',
  data_hora: 'Data e hora da operação',
  data_hora_anterior: 'Data e hora da operação anterior',
  data_operacao: 'Data civil da operação',
  device_id: 'Identificador do dispositivo',
  fator_incompatibilidade: 'Grau de desproporção em relação à renda',
  forma_liquidacao: 'Forma de liquidação do aporte',
  geolocalizacao_cidade: 'Cidade inferida do login',
  hora_transacao: 'Hora da liquidação',
  id_conta: 'Identificador da conta',
  id_conta_destino: 'Identificador da conta favorecida',
  id_conta_origem: 'Identificador da conta remetente',
  id_transacao: 'Identificador da transação',
  intervalo_horas: 'Intervalo entre disparos consecutivos (horas)',
  intervalo_segundos: 'Intervalo entre eventos consecutivos (segundos)',
  maior_pix: 'Maior valor movimentado no recorte',
  media_historica: 'Média histórica de valores da origem',
  montante_acumulado: 'Montante acumulado até o instante',
  nome_administrador: 'Nome de quem administra a empresa',
  nome_socio: 'Nome de quem figura no quadro societário',
  ocupacao: 'Ocupação declarada no cadastro',
  percentual_participacao: 'Participação societária detida',
  qtd_no_dia: 'Quantidade de envios no mesmo dia',
  razao_social: 'Razão social da empresa',
  renda_mensal: 'Renda mensal declarada',
  renda_mensal_declarada: 'Renda ou faturamento mensal declarado',
  salto: 'Salto do valor em relação ao histórico',
  sequencial_operacao: 'Numeração cronológica do envio',
  status_dispositivo: 'Classificação do dispositivo no acesso',
  ticket_medio: 'Ticket médio por transferência',
  tipo_pessoa: 'Tipo de pessoa (física ou jurídica)',
  tipo_produto: 'Tipo de produto financeiro',
  titular: 'Titular da conta',
  titular_destinatario: 'Titular de quem recebeu',
  titular_pep: 'Titular classificado como PEP',
  titular_remetente: 'Titular de quem enviou',
  total_destinatarios_distintos: 'Quantidade de favorecidos distintos',
  total_enviado: 'Montante financeiro enviado',
  total_movimentado: 'Montante financeiro movimentado',
  total_no_dia: 'Montante acumulado no dia',
  total_operacoes: 'Volume de operações',
  total_operacoes_fracionadas: 'Quantidade de PIX na faixa fracionada',
  total_recebido: 'Montante financeiro recebido',
  transacao_entrada: 'Identificador do crédito de entrada',
  transacao_saida: 'Identificador da saída subsequente',
  valor: 'Valor da operação',
  valor_anterior: 'Valor da operação anterior',
  valor_aporte: 'Montante aportado no produto',
  valor_atual: 'Valor da operação corrente',
  valor_entrada: 'Valor do crédito recebido',
  valor_medio_operacao: 'Ticket médio do crédito',
  valor_remessa_a: 'Valor da primeira perna da cadeia',
  valor_remessa_b: 'Valor da segunda perna da cadeia',
  valor_saida: 'Valor da saída subsequente',
  valor_total: 'Montante acumulado',
  valor_total_dia: 'Montante acumulado no dia',
  valor_total_enviado: 'Montante enviado pelo titular',
  valor_total_fracionado: 'Montante na faixa fracionada',
  valor_transacao: 'Valor da saída correlacionada ao acesso',
  variacao_absoluta: 'Diferença em relação ao envio anterior',
};

function aliasContractLabel(column: string): string {
  return ALIAS_LABELS[column] ?? ALIAS_LABELS[column.toLowerCase()] ?? 'Campo do relatório';
}

function renderExpectedOutput(s: InvestigationScenario): string {
  const columns = expectedColumns(s);
  const itens =
    columns.length > 0
      ? columns
          .map(
            (column) =>
              `<li>${escapeHtml(aliasContractLabel(column))}: ${formatInline(`\`${column}\``)}</li>`,
          )
          .join('')
      : '<li>Consulte o dicionário de tabelas para montar a evidência.</li>';
  const ordenacao = s.ordenacao?.trim();
  const ordem = ordenacao
    ? `<p class="mt-2 text-[12px] leading-relaxed text-slate-500">Priorização da fila (a esteira aceita o conjunto mesmo fora desta ordem): ${formatInline(`\`ORDER BY ${ordenacao}\``)}.</p>`
    : '';
  return `
    <p class="text-[11px] font-semibold uppercase tracking-wider text-sky-400">Contrato de Entrega do Relatório</p>
    <p class="mt-1.5 text-[13px] leading-relaxed text-slate-300">Aliases esperados na query final:</p>
    <ul class="mt-2 list-disc space-y-1 pl-5 text-[13px] text-slate-300">${itens}</ul>
    ${ordem}`;
}

const SCHEMA_BUTTON_CLASS =
  'w-full py-2 px-3 rounded-lg border border-slate-700 bg-slate-900 hover:bg-slate-800 text-slate-200 text-xs font-medium flex items-center justify-center gap-2 my-3';

function renderSchemaButton(): string {
  return `<button type="button" data-open-schema class="${SCHEMA_BUTTON_CLASS}">📊 Consultar Tabelas Disponíveis</button>`;
}

function renderSqlHintAccordion(s: InvestigationScenario): string {
  const twoPhase = renderTwoPhase(s);
  return `
    <details class="rounded-xl border border-slate-800 bg-slate-900/40">
      <summary class="cursor-pointer select-none px-3 py-2.5 text-xs font-medium text-sky-300 hover:text-sky-200">
        💡 Revelar Dica de SQL
      </summary>
      <div class="space-y-2 border-t border-slate-800 px-3 py-3">
        <p class="text-[13px] leading-relaxed text-slate-300">${escapeHtml(s.dicaTexto ?? '')}</p>
        <pre class="overflow-x-auto rounded-xl bg-slate-950 p-3 font-mono text-[12px] leading-6 text-emerald-200">${escapeHtml(s.dicaSql ?? '')}</pre>
        ${twoPhase}
      </div>
    </details>`;
}

function renderDossierContext(s: InvestigationScenario): string {
  return `
    <section class="space-y-2">
      <p class="text-[11px] font-semibold uppercase tracking-wider text-amber-200/90">${escapeHtml(s.enquadramento ?? '')}</p>
      <p class="text-[13px] leading-relaxed text-slate-400">${escapeHtml(s.dossie ?? '')}</p>
    </section>`;
}

function renderGabaritoAccordion(s: InvestigationScenario, tentativas: number): string {
  if (tentativas <= 0) return '';
  return `
    <details class="rounded-xl border border-slate-800 bg-slate-900/40">
      <summary class="flex cursor-pointer select-none items-center gap-2 px-3 py-2.5 text-xs font-medium text-sky-300 hover:text-sky-200">
        Ver gabarito comentado
        <span class="ml-auto text-[11px] font-normal text-slate-500">${tentativas} tentativa${tentativas > 1 ? 's' : ''}</span>
      </summary>
      <div class="space-y-2 border-t border-slate-800 p-3">
        ${renderDidacticGabarito(s)}
        <button type="button" data-load-solution
          class="w-full rounded-lg border border-slate-700 px-3 py-2 text-[12px] text-slate-300 hover:border-sky-600 hover:text-sky-200">
          Abrir gabarito no editor
        </button>
      </div>
    </details>`;
}

function renderScenario(s: InvestigationScenario): string {
  const nivelMeta = TRAIL_LEVELS[s.nivel];
  const nivelTitulo = nivelMeta?.titulo ?? 'Trilha';
  return `
    ${renderOriginBadge(s)}
    <p class="text-[11px] font-medium uppercase tracking-wider text-slate-500">Nível ${escapeHtml(String(s.nivel))} · ${escapeHtml(nivelTitulo)}</p>
    <section id="mission-card" class="rounded-2xl bg-slate-900/40 p-5">
      <h3 class="text-lg font-semibold leading-snug text-slate-50">${escapeHtml(s.titulo ?? 'Caso investigativo')}</h3>
      <p class="mt-4 text-[11px] font-semibold uppercase tracking-wider text-sky-400">Sua Missão</p>
      <p class="mt-2 text-[15px] leading-relaxed text-slate-100">${escapeHtml(missionLine(s))}</p>
    </section>
    ${renderDossierContext(s)}
    ${renderSchemaButton()}
    <section class="rounded-xl border border-slate-800 bg-slate-900/40 p-3 text-[13px] leading-relaxed text-slate-300">
      ${renderExpectedOutput(s)}
    </section>
    ${renderSqlHintAccordion(s)}`;
}

function renderMobileDossier(s: InvestigationScenario, tentativas = 0): string {
  return `
    ${renderDossierContext(s)}
    ${renderSchemaButton()}
    <section class="rounded-xl border border-slate-800 bg-slate-900/40 p-3">
      ${renderExpectedOutput(s)}
    </section>
    ${renderSqlHintAccordion(s)}
    ${renderGabaritoAccordion(s, tentativas)}`;
}

function paintMobileBriefing(s: InvestigationScenario, tentativas = 0): void {
  const level = document.getElementById('mobile-briefing-level');
  const title = document.getElementById('mobile-briefing-title');
  const text = document.getElementById('mobile-briefing-text');
  const dossier = document.getElementById('mobile-dossier-body');
  const nivelMeta = TRAIL_LEVELS[s.nivel];
  if (level) level.textContent = `Nível ${s.nivel}${nivelMeta ? ` · ${nivelMeta.titulo}` : ''}`;
  if (title) {
    title.textContent = s.titulo ?? 'Caso investigativo';
    title.title = s.titulo ?? '';
  }
  if (text) {
    text.textContent = missionLine(s);
    text.classList.add('line-clamp-2');
  }
  const toggle = document.getElementById('mobile-briefing-toggle');
  if (toggle) toggle.setAttribute('aria-expanded', 'false');
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
  const trailBands = el('trail-bands');
  let trailBand: TrailBand = 'todos';

  const firstScenario = findScenario(DEFAULT_SCENARIO_ID) ?? baseScenarios()[0];
  if (!firstScenario) throw new Error('Nenhum cenário investigativo cadastrado.');

  let selected = firstScenario;
  const attempts = new Map<ScenarioId, number>();

  const catalog = (): InvestigationScenario[] => [...baseScenarios(), ...generatedScenarios()];

  const firstInBand = (band: TrailBand): InvestigationScenario | undefined => {
    const levels = TRAIL_BAND_LEVELS[band];
    return catalog().find((s) => levels.includes(s.nivel));
  };

  const scenarioInBand = (scenario: InvestigationScenario, band: TrailBand): boolean =>
    TRAIL_BAND_LEVELS[band].includes(scenario.nivel);

  const paintTrailBand = (): void => {
    if (!trailBands) return;
    for (const button of trailBands.querySelectorAll<HTMLElement>('[data-trail-band]')) {
      const on = button.dataset['trailBand'] === trailBand;
      button.className = on ? BAND_BUTTON_ON : BAND_BUTTON_OFF;
      button.setAttribute('aria-selected', String(on));
    }
  };

  const renderOptions = (): void => {
    if (!select) return;
    const all = catalog();
    select.innerHTML = TRAIL_BAND_LEVELS[trailBand]
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
    if (!solution) return;
    const count = attempts.get(selected.id) ?? 0;
    if (count === 0) {
      solution.innerHTML = '';
      return;
    }
    solution.innerHTML = renderGabaritoAccordion(selected, count);
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
    paintMobileBriefing(scenario, attempts.get(scenario.id) ?? 0);
    if (notify && changed) onScenarioChange(scenario);
  };

  const applyTrailBand = (band: TrailBand): void => {
    trailBand = band;
    paintTrailBand();
    if (scenarioInBand(selected, trailBand)) {
      renderOptions();
      return;
    }
    const next = firstInBand(trailBand);
    renderOptions();
    if (next) show(next);
  };

  if (trailBands) {
    trailBands.addEventListener('click', (event) => {
      const target = event.target;
      if (!(target instanceof Element)) return;
      const band = target.closest<HTMLElement>('[data-trail-band]')?.dataset['trailBand'];
      if (band !== 'todos' && band !== 'iniciante' && band !== 'intermediario' && band !== 'avancado') return;
      applyTrailBand(band);
    });
  }

  if (select) {
    select.addEventListener('change', () => {
      const scenario = findScenario(select.value);
      if (scenario) show(scenario);
    });
  }

  const dossierDialog = el<HTMLDialogElement>('mobile-dossier-dialog');
  const briefingToggle = el('mobile-briefing-toggle');
  const briefingText = el('mobile-briefing-text');
  const dossierButton = el('btn-mobile-dossier');

  const closeDossier = (): void => {
    if (dossierDialog?.open) dossierDialog.close();
  };

  briefingToggle?.addEventListener('click', () => {
    if (!briefingText || !briefingToggle) return;
    const expanded = briefingToggle.getAttribute('aria-expanded') === 'true';
    briefingToggle.setAttribute('aria-expanded', String(!expanded));
    briefingText.classList.toggle('line-clamp-2', expanded);
  });

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
      const id = target.closest<HTMLElement>('[data-remove-scenario]')?.dataset['removeScenario'];
      if (id && confirm('Remover este desafio gerado?')) removeGenerated(id);
    });
  }

  onScenariosChange(() => {
    const current = findScenario(selected.id);
    renderOptions();
    if (!current) show(firstScenario);
  });

  window.addEventListener(PROGRESS_UPDATED_EVENT, () => renderOptions());

  renderOptions();
  paintTrailBand();
  show(firstScenario, false);

  return {
    getSelectedScenario: () => selected,
    getTrailBand: () => trailBand,
    selectScenario(id, options) {
      const scenario = findScenario(id);
      if (!scenario) return;
      if (options?.syncBand || (trailBand !== 'todos' && !scenarioInBand(scenario, trailBand))) {
        trailBand = trailBandOf(scenario.nivel);
        paintTrailBand();
      }
      renderOptions();
      show(scenario);
    },
    showValidation(approved = false) {
      attempts.set(selected.id, (attempts.get(selected.id) ?? 0) + 1);
      if (approved) markChallengeCompleted(selected.id);
      renderSolutionToggle();
      paintMobileBriefing(selected, attempts.get(selected.id) ?? 0);
    },
  };
}
