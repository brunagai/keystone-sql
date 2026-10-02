import type { QueryExecResult } from 'sql.js';
import { formatBRL, formatDecimal } from '../ui/format.ts';

export type ScenarioId = string;

export type ScenarioOrigin = 'base' | 'ia' | 'offline';

/** Degraus da trilha pedagógica; o nível 5 agrupa os desafios gerados pelo agente. */
export type TrailLevel = 1 | 2 | 3 | 4 | 5;

export interface TrailLevelInfo {
  titulo: string;
  /** Técnica SQL que o nível exercita. */
  tecnica: string;
}

export const TRAIL_LEVELS: Record<TrailLevel, TrailLevelInfo> = {
  1: { titulo: 'Fundamentos de Agregação', tecnica: 'GROUP BY, HAVING, JOIN e limiares' },
  2: { titulo: 'Janelas e Classificação', tecnica: 'ROW_NUMBER() OVER (PARTITION BY …)' },
  3: { titulo: 'Análise Temporal e Mudança de Padrão', tecnica: 'LAG / LEAD' },
  4: { titulo: 'Composição Analítica com CTEs', tecnica: 'WITH + janelas, LAG e ROWS BETWEEN' },
  5: { titulo: 'Laboratório Aberto (Agente IA)', tecnica: 'Desafios gerados por LLM ou offline' },
};

export const TRAIL_ORDER: readonly TrailLevel[] = [1, 2, 3, 4, 5];

export interface SuccessSummary {
  message: string;
  entities: string[];
  details?: string[];
}

export interface DivergenceHints {
  /** Aluno retornou mais linhas que o gabarito (filtro frouxo). */
  excesso: string;
  /** Aluno retornou menos linhas que o gabarito (filtro restritivo). */
  falta: string;
  /** Mesmas entidades, métricas diferentes. */
  valores: string;
  ordenacao: string;
}

/** Esteira analítica: carimbar métricas no WITH, cortar no WHERE externo. */
export interface TwoPhaseStep {
  titulo: string;
  /** Aceita `código` inline. */
  texto: string;
}

export interface TwoPhaseReasoning {
  fase1: TwoPhaseStep;
  fase2: TwoPhaseStep;
}

export interface InvestigationScenario {
  id: ScenarioId;
  origem: ScenarioOrigin;
  nivel: TrailLevel;
  /** Modelo de IA que gerou o desafio (apenas origem 'ia'). */
  modelo?: string;
  titulo: string;
  /** Rótulo regulatório exibido no badge da tipologia. */
  enquadramento: string;
  dossie: string;
  /** Aceita `código` inline. */
  objetivo: string;
  colunasEsperadas: readonly string[];
  ordenacao: string;
  dicaTexto: string;
  dicaSql: string;
  /** Esteira WITH → WHERE; presente nos níveis 3–4 (e inferida nos desafios gerados). */
  decomposicao?: TwoPhaseReasoning;
  /** Query de referência (ground truth). Os comentários `--` fazem parte do gabarito comentado. */
  gabaritoSql: string;
  /** Coluna do gabarito usada para apontar entidades faltantes/excedentes. */
  colunaChave: string;
  rotuloEntidade: { singular: string; plural: string };
  dicasDivergencia: DivergenceHints;
  resumirSucesso(gabarito: QueryExecResult): SuccessSummary;
}

function columnValues(result: QueryExecResult, column: string): unknown[] {
  const index = result.columns.indexOf(column);
  return index < 0 ? [] : result.values.map((row) => row[index]);
}

const distinct = (values: unknown[]): string[] => [...new Set(values.map(String))];
const sum = (values: unknown[]): number => values.reduce<number>((acc, v) => acc + Number(v), 0);

const CATALOG: readonly InvestigationScenario[] = [
  {
    id: 'smurfing',
    origem: 'base',
    nivel: 1,
    titulo: 'Smurfing para a receptora Aurora (C025)',
    enquadramento: 'Carta Circular Bacen 4.001/2020 · Inciso I - Fracionamento',
    dossie:
      'A área de monitoramento recebeu alerta sobre a PJ "Comercial Aurora Importados Ltda" (C025), aberta em junho/2026 ' +
      'com faturamento declarado de R$ 18 mil. Em poucos dias ela recebeu dezenas de milhares de reais de pessoas físicas ' +
      'recém-cadastradas, sempre em valores logo abaixo do limiar de comunicação de R$ 10.000,00.',
    objetivo:
      'Identifique os remetentes que enviaram PIX individuais entre R$ 9.700,00 e R$ 9.999,00 para a conta `C025`, ' +
      'com pelo menos 2 operações (`HAVING COUNT(*) >= 2`). Retorne `conta_origem` (alias de `id_conta_origem`), ' +
      '`total_operacoes` e `valor_total`.',
    colunasEsperadas: ['conta_origem', 'total_operacoes', 'valor_total'],
    ordenacao: 'valor_total DESC',
    dicaTexto: 'Filtre destino e faixa de valor no WHERE, agrupe por remetente e aplique a recorrência no HAVING.',
    dicaSql: `SELECT id_conta_origem AS conta_origem,
       COUNT(*)   AS ...,
       SUM(valor) AS ...
FROM transacoes_pix
WHERE id_conta_destino = '...'
  AND valor BETWEEN ... AND ...
GROUP BY ...
HAVING ...
ORDER BY ...;`,
    gabaritoSql: `-- Gabarito comentado · Smurfing para a Comercial Aurora (C025)
SELECT
  t.id_conta_origem AS conta_origem,     -- remetente (possível "laranja")
  COUNT(*)          AS total_operacoes,  -- quantas vezes fracionou
  SUM(t.valor)      AS valor_total       -- montante total pulverizado
FROM transacoes_pix AS t
WHERE t.id_conta_destino = 'C025'        -- receptora sob alerta
  AND t.valor BETWEEN 9700 AND 9999      -- logo abaixo do limiar de R$ 10 mil (BETWEEN é inclusivo)
GROUP BY t.id_conta_origem               -- uma linha por remetente
HAVING COUNT(*) >= 2                     -- recorrência: padrão de fracionamento, não evento isolado
ORDER BY valor_total DESC;               -- maior exposição primeiro`,
    colunaChave: 'conta_origem',
    rotuloEntidade: { singular: 'remetente', plural: 'remetentes' },
    dicasDivergencia: {
      excesso:
        'Há remetentes a mais. Confira se filtrou o destino `C025`, a faixa `BETWEEN 9700 AND 9999` e se aplicou `HAVING COUNT(*) >= 2`.',
      falta:
        'Faltam remetentes. Os limites do `BETWEEN` são inclusivos; confira também se o `HAVING` não ficou mais restritivo que `>= 2`.',
      valores: 'Os remetentes estão certos, mas as métricas não. `total_operacoes` deve ser `COUNT(*)` e `valor_total` deve ser `SUM(valor)`.',
      ordenacao: 'Os dados estão corretos, mas a ordem não. Ordene por `valor_total DESC`.',
    },
    resumirSucesso(gabarito) {
      const remetentes = distinct(columnValues(gabarito, 'conta_origem'));
      const total = sum(columnValues(gabarito, 'valor_total'));
      return {
        message: `Excelente! Você capturou com precisão os ${remetentes.length} remetentes de smurfing e a conta receptora C025, que concentraram ${formatBRL(total)} em operações fracionadas.`,
        entities: [...remetentes, 'C025 (receptora)'],
        details: ['Próximo passo de um analista: verificar para onde a C025 repassou os recursos (siga o dinheiro!).'],
      };
    },
  },
  {
    id: 'burst',
    origem: 'base',
    nivel: 3,
    titulo: 'Burst / alta frequência em janela curta',
    enquadramento: 'Carta Circular Bacen 4.001/2020 · Inciso IV - Alta Frequência',
    dossie:
      'Um parceiro de arranjo reportou picos de liquidação via API durante a madrugada envolvendo uma intermediadora de ' +
      'pagamentos e pessoas físicas no Rio de Janeiro. O padrão sugere automação para pulverizar recursos em cadeia ' +
      '(layering) sem propósito comercial aparente.',
    objetivo:
      'Liste todas as transações cujo intervalo para a transação imediatamente anterior da MESMA conta de origem seja ' +
      '`<= 60` segundos. Use `LAG(data_hora) OVER (PARTITION BY id_conta_origem ORDER BY data_hora)` e calcule o delta ' +
      "com `strftime('%s', ...)`. Retorne `id_transacao`, `conta_origem`, `conta_destino`, `valor`, `data_hora` e " +
      '`intervalo_segundos`.',
    colunasEsperadas: ['id_transacao', 'conta_origem', 'conta_destino', 'valor', 'data_hora', 'intervalo_segundos'],
    ordenacao: 'conta_origem ASC, data_hora ASC',
    dicaTexto:
      'Funções de janela não podem ser filtradas diretamente no WHERE do mesmo SELECT: calcule o LAG em uma CTE e filtre na consulta externa.',
    dicaSql: `WITH sequencia AS (
  SELECT *,
         LAG(data_hora) OVER (
           PARTITION BY id_conta_origem
           ORDER BY data_hora
         ) AS lag_data_hora
  FROM transacoes_pix
)
SELECT ...,
       strftime('%s', data_hora) - strftime('%s', lag_data_hora) AS intervalo_segundos
FROM sequencia
WHERE ...;`,
    decomposicao: {
      fase1: {
        titulo: 'Fase 1 — O envelope `WITH`',
        texto:
          'Calcule, linha a linha, o horário do PIX anterior da mesma conta de origem com `LAG(data_hora) OVER (PARTITION BY id_conta_origem ORDER BY data_hora)` e o `intervalo_segundos` (`strftime(\'%s\', …)`). Faça isso no `WITH`: funções de janela não podem ir no `WHERE` do mesmo `SELECT`. Selecione o miolo da CTE e use Testar Seleção / CTE para ver o carimbo antes de filtrar.',
      },
      fase2: {
        titulo: 'Fase 2 — O filtro do `WHERE` externo',
        texto:
          'No `SELECT` externo, isole apenas as linhas já carimbadas em que `intervalo_segundos <= 60` (janela de alta frequência da Carta Circular 4.001/2020). A primeira transação de cada conta não tem `LAG` (`NULL`) e sai nesta fase.',
      },
    },
    gabaritoSql: `-- Gabarito comentado · Burst / alta frequência (LAG)
WITH sequencia AS (
  SELECT
    t.id_transacao,
    t.id_conta_origem  AS conta_origem,
    t.id_conta_destino AS conta_destino,
    t.valor,
    t.data_hora,
    LAG(t.data_hora) OVER (          -- horário do PIX anterior...
      PARTITION BY t.id_conta_origem -- ...da MESMA conta de origem
      ORDER BY t.data_hora           -- em ordem cronológica
    ) AS lag_data_hora
  FROM transacoes_pix AS t
),
intervalos AS (
  SELECT
    *,
    -- strftime('%s') converte para epoch (segundos); a diferença é o intervalo
    CAST(strftime('%s', data_hora) AS INTEGER)
      - CAST(strftime('%s', lag_data_hora) AS INTEGER) AS intervalo_segundos
  FROM sequencia
  WHERE lag_data_hora IS NOT NULL    -- a 1ª transação de cada conta não tem anterior
)
SELECT id_transacao, conta_origem, conta_destino, valor, data_hora, intervalo_segundos
FROM intervalos
WHERE intervalo_segundos <= 60       -- janela de alta frequência (inclusiva)
ORDER BY conta_origem ASC, data_hora ASC;`,
    colunaChave: 'id_transacao',
    rotuloEntidade: { singular: 'transação', plural: 'transações' },
    dicasDivergencia: {
      excesso:
        'Há transações a mais. Confira o filtro `intervalo_segundos <= 60` e se o `LAG` está ordenado por `data_hora`.',
      falta:
        'Faltam transações. Particione apenas por `id_conta_origem` (não pelo par origem/destino) e use `<= 60` (inclusivo).',
      valores:
        "As transações estão certas, mas alguma métrica diverge. `intervalo_segundos` deve ser `strftime('%s', data_hora) - strftime('%s', lag_data_hora)`.",
      ordenacao: 'Os dados estão corretos, mas a ordem não. Ordene por `conta_origem ASC, data_hora ASC`.',
    },
    resumirSucesso(gabarito) {
      const contas = distinct(columnValues(gabarito, 'conta_origem'));
      return {
        message: `Precisão cirúrgica! Você isolou as ${gabarito.values.length} transações com intervalo de até 60 s, distribuídas entre ${contas.length} contas de origem.`,
        entities: contas,
        details: [
          'Repare que nem todo alerta é suspeito: pagamentos de folha e repasses de aluguel em lote (PJs C021 e C022) também caem na janela. A diligência do analista separa automação legítima de layering.',
        ],
      };
    },
  },
  {
    id: 'incompatibilidade',
    origem: 'base',
    nivel: 1,
    titulo: 'Incompatibilidade patrimonial bruta',
    enquadramento: 'Circular Bacen 3.978/2020, Art. 38 c/c Carta Circular 4.001/2020, Inciso II',
    dossie:
      'Comunicação interna aponta que clientes de baixa renda declarada (estudante, aposentada e MEI) passaram a ' +
      'movimentar centenas de milhares de reais em agosto/2026, em operações com uma holding recém-constituída.',
    objetivo:
      'Identifique transações individuais com `valor >= 30 * renda_mensal` do titular da conta de ORIGEM. Retorne ' +
      '`id_transacao`, `conta_origem`, `titular`, `renda_mensal` (alias de `renda_mensal_declarada`), `valor` e ' +
      '`fator_incompatibilidade` = `ROUND(valor / renda_mensal, 2)`.',
    colunasEsperadas: ['id_transacao', 'conta_origem', 'titular', 'renda_mensal', 'valor', 'fator_incompatibilidade'],
    ordenacao: 'fator_incompatibilidade DESC',
    dicaTexto: 'Faça JOIN da transação com a conta pela ORIGEM e compare o valor com um múltiplo da renda declarada.',
    dicaSql: `SELECT t.id_transacao,
       ...,
       ROUND(t.valor / c.renda_mensal_declarada, 2) AS fator_incompatibilidade
FROM transacoes_pix t
JOIN contas c ON c.id_conta = t.id_conta_origem
WHERE ...
ORDER BY ...;`,
    gabaritoSql: `-- Gabarito comentado · Incompatibilidade patrimonial (ratio valor/renda)
SELECT
  t.id_transacao,
  t.id_conta_origem        AS conta_origem,
  c.titular,                                   -- titular da conta de ORIGEM
  c.renda_mensal_declarada AS renda_mensal,    -- capacidade financeira declarada (KYC)
  t.valor,
  ROUND(t.valor / c.renda_mensal_declarada, 2) AS fator_incompatibilidade  -- quantas rendas em um único PIX
FROM transacoes_pix AS t
JOIN contas AS c
  ON c.id_conta = t.id_conta_origem            -- quem ENVIA o recurso
WHERE c.renda_mensal_declarada > 0             -- protege contra divisão por zero
  AND t.valor >= 30 * c.renda_mensal_declarada -- desproporção grave: 30x a renda mensal
ORDER BY fator_incompatibilidade DESC;         -- casos mais graves primeiro`,
    colunaChave: 'id_transacao',
    rotuloEntidade: { singular: 'transação', plural: 'transações' },
    dicasDivergencia: {
      excesso:
        'Há transações a mais. Garanta que a renda comparada é a da conta de ORIGEM (`JOIN ... ON c.id_conta = t.id_conta_origem`) e que o fator mínimo é 30.',
      falta: 'Faltam transações. Use `>=` (inclusivo) e compare `valor` com `30 * renda_mensal_declarada` da conta de origem.',
      valores:
        'As transações estão certas, mas alguma métrica diverge. `fator_incompatibilidade` deve ser `ROUND(valor / renda_mensal, 2)`.',
      ordenacao: 'Os dados estão corretos, mas a ordem não. Ordene por `fator_incompatibilidade DESC`.',
    },
    resumirSucesso(gabarito) {
      const titulares = distinct(columnValues(gabarito, 'titular'));
      const fatores = columnValues(gabarito, 'fator_incompatibilidade').map(Number);
      const pico = fatores.length > 0 ? Math.max(...fatores) : 0;
      return {
        message: `Excelente! Você identificou as ${gabarito.values.length} transações com desproporção grave (≥ 30x a renda), com pico de ${formatDecimal(pico)}x a renda declarada.`,
        entities: titulares,
        details: ['Esses titulares são fortes candidatos a "contas de passagem"; o próximo passo é mapear a origem dos recursos.'],
      };
    },
  },
  {
    id: 'pico-diario',
    origem: 'base',
    nivel: 2,
    titulo: 'Pico individual por conta no dia 18/08 (ROW_NUMBER)',
    enquadramento: 'Carta Circular Bacen 4.001/2020 · Alta Frequência e Valores Atípicos',
    dossie:
      'Na madrugada de 18/08/2026 o monitoramento disparou dezenas de alertas para o mesmo dia, muitos repetidos para as ' +
      'mesmas contas. Para priorizar a fila, a gestão de PLD pediu uma visão desduplicada: uma única linha por conta de ' +
      'origem, mostrando o maior PIX enviado no dia e o volume total que a conta movimentou.',
    objetivo:
      'Considerando apenas os PIX de `2026-08-18`, retorne uma linha por conta de origem com sua MAIOR transação do dia, ' +
      'usando `ROW_NUMBER() OVER (PARTITION BY id_conta_origem ORDER BY valor DESC, data_hora ASC)` (em caso de empate no ' +
      'valor, vale o PIX mais antigo). Retorne `conta_origem`, `id_transacao`, `maior_pix`, `data_hora`, `qtd_no_dia` ' +
      '(quantos PIX a conta enviou no dia) e `total_no_dia` (`ROUND(SUM(valor), 2)` do dia).',
    colunasEsperadas: ['conta_origem', 'id_transacao', 'maior_pix', 'data_hora', 'qtd_no_dia', 'total_no_dia'],
    ordenacao: 'maior_pix DESC, conta_origem',
    dicaTexto:
      'Numere os PIX de cada conta numa CTE (posição 1 = maior valor) e, na consulta externa, mantenha só a posição 1. ' +
      'COUNT e SUM com OVER (PARTITION BY ...) trazem os totais do dia sem colapsar as linhas como o GROUP BY faria.',
    dicaSql: `WITH pix_do_dia AS (
  SELECT *,
         ROW_NUMBER() OVER (
           PARTITION BY id_conta_origem
           ORDER BY valor DESC, data_hora ASC
         ) AS posicao,
         COUNT(*)   OVER (PARTITION BY ...) AS qtd_no_dia,
         SUM(valor) OVER (PARTITION BY ...) AS soma_no_dia
  FROM transacoes_pix
  WHERE data_hora >= '...' AND data_hora < '...'
)
SELECT ...
FROM pix_do_dia
WHERE posicao = ...
ORDER BY ...;`,
    gabaritoSql: `-- Gabarito comentado · Pico individual por conta (ROW_NUMBER)
WITH pix_do_dia AS (
  SELECT
    t.id_conta_origem AS conta_origem,
    t.id_transacao,
    t.valor,
    t.data_hora,
    ROW_NUMBER() OVER (                   -- numera os PIX de cada conta...
      PARTITION BY t.id_conta_origem      -- ...reiniciando a contagem por remetente
      ORDER BY t.valor DESC,              -- 1 = maior valor do dia
               t.data_hora ASC            -- desempate determinístico: o PIX mais antigo
    ) AS posicao,
    COUNT(*)     OVER (PARTITION BY t.id_conta_origem) AS qtd_no_dia,   -- janela sem ORDER BY = total da partição
    SUM(t.valor) OVER (PARTITION BY t.id_conta_origem) AS soma_no_dia
  FROM transacoes_pix AS t
  WHERE t.data_hora >= '2026-08-18 00:00:00'   -- intervalo semiaberto: cobre o dia inteiro
    AND t.data_hora <  '2026-08-19 00:00:00'   -- e continua usando o índice de data_hora
)
SELECT
  conta_origem,
  id_transacao,
  valor                 AS maior_pix,
  data_hora,
  qtd_no_dia,
  ROUND(soma_no_dia, 2) AS total_no_dia
FROM pix_do_dia
WHERE posicao = 1                       -- desduplicação: só o pico de cada conta
ORDER BY maior_pix DESC, conta_origem;  -- maiores picos primeiro`,
    colunaChave: 'conta_origem',
    rotuloEntidade: { singular: 'conta', plural: 'contas' },
    dicasDivergencia: {
      excesso:
        'Há linhas a mais: provavelmente mais de um PIX por conta. Filtre `posicao = 1` na consulta externa e garanta que o `PARTITION BY` é só `id_conta_origem`.',
      falta:
        'Faltam contas. Confira o recorte do dia (`>= 2026-08-18 00:00:00` e `< 2026-08-19 00:00:00`) e se nenhum filtro extra eliminou contas com um único PIX.',
      valores:
        'As contas estão certas, mas algum valor diverge. Se for `id_transacao`/`data_hora`, revise o desempate (`ORDER BY valor DESC, data_hora ASC`); se for `qtd_no_dia`/`total_no_dia`, use `COUNT`/`SUM` com `OVER (PARTITION BY id_conta_origem)` sobre todos os PIX do dia.',
      ordenacao: 'Os dados estão corretos, mas a ordem não. Ordene por `maior_pix DESC, conta_origem`.',
    },
    resumirSucesso(gabarito) {
      const contas = distinct(columnValues(gabarito, 'conta_origem'));
      const qtd = columnValues(gabarito, 'qtd_no_dia').map(Number);
      const rajadas = contas.flatMap((conta, i) => ((qtd[i] ?? 0) > 1 ? [`${conta} (${qtd[i]} PIX)`] : []));
      return {
        message: `Fila desduplicada! ${gabarito.values.length} contas, uma linha cada. ${rajadas.join(' e ')} enviaram vários PIX em poucos minutos, o que as coloca no topo da priorização.`,
        entities: contas,
        details: [
          'Repare no empate da C031 (dois PIX de R$ 4.990,00): sem o desempate por `data_hora`, o ROW_NUMBER escolheria um deles de forma arbitrária, e o resultado mudaria de uma execução para outra.',
        ],
      };
    },
  },
  {
    id: 'conta-aquecida',
    origem: 'base',
    nivel: 4,
    titulo: 'Conta "aquecida": PIX de teste seguido de salto abrupto (CTE)',
    enquadramento: 'Circular Bacen 3.978/2020 (monitoramento) c/c Carta Circular 4.001/2020 · Mudança de padrão',
    dossie:
      'Uma tática comum de redes de laranjas é "aquecer" a conta: o titular faz um ou dois PIX de valor irrisório (padaria, ' +
      'mercado) para simular uso normal e, poucos dias depois, passa a movimentar valores dezenas de vezes maiores. A área de ' +
      'PLD quer uma regra que combine histórico curto, salto em relação ao próprio histórico e proximidade temporal.',
    objetivo:
      'Monte uma CTE `metricas` que calcule, para cada PIX: `intervalo_segundos` desde o PIX anterior da mesma origem (com `LAG`), ' +
      '`media_historica` (média dos PIX ANTERIORES do remetente: `AVG(valor) OVER (... ROWS BETWEEN UNBOUNDED PRECEDING AND 1 PRECEDING)`) ' +
      'e `qtd_historico` (quantos PIX anteriores existem). No `WHERE` externo, aplique as regras em conjunto: `qtd_historico` entre 1 e 3, ' +
      '`valor >= 10 * media_historica`, `valor >= 5000` e intervalo de até 10 dias (`864000` s). Retorne `id_transacao`, `conta_origem`, ' +
      '`titular`, `valor`, `data_hora`, `intervalo_horas` (`ROUND(intervalo_segundos / 3600.0, 1)`), `media_historica` (2 casas) e ' +
      '`salto` (`ROUND(valor / media_historica, 2)`).',
    colunasEsperadas: [
      'id_transacao',
      'conta_origem',
      'titular',
      'valor',
      'data_hora',
      'intervalo_horas',
      'media_historica',
      'salto',
    ],
    ordenacao: 'salto DESC, id_transacao',
    dicaTexto:
      'Calcule todas as métricas de janela na CTE (o WHERE não enxerga funções de janela do mesmo SELECT). O frame "ROWS BETWEEN ' +
      'UNBOUNDED PRECEDING AND 1 PRECEDING" exclui o próprio PIX da média, então a primeira transação de cada conta fica com média NULL.',
    dicaSql: `WITH metricas AS (
  SELECT t.id_transacao, t.id_conta_origem AS conta_origem, c.titular, t.valor, t.data_hora,
         unixepoch(t.data_hora)
           - unixepoch(LAG(t.data_hora) OVER (PARTITION BY ... ORDER BY ...)) AS intervalo_segundos,
         AVG(t.valor) OVER (
           PARTITION BY ... ORDER BY ...
           ROWS BETWEEN UNBOUNDED PRECEDING AND 1 PRECEDING
         ) AS media_historica,
         COUNT(*) OVER (...mesmo frame...) AS qtd_historico
  FROM transacoes_pix t
  JOIN contas c ON ...
)
SELECT ...
FROM metricas
WHERE qtd_historico BETWEEN ... AND ...
  AND ...
ORDER BY ...;`,
    decomposicao: {
      fase1: {
        titulo: 'Fase 1 — O envelope `WITH`',
        texto:
          'Na CTE `metricas`, carimbe cada PIX com três métricas antes do corte: `intervalo_segundos` (`LAG` da mesma origem), `media_historica` (`AVG(valor) OVER` só dos PIX anteriores) e `qtd_historico` (mesmo frame). Selecione o `WITH metricas AS (...)` e use Testar Seleção / CTE para inspecionar médias e intervalos ainda sem filtro.',
      },
      fase2: {
        titulo: 'Fase 2 — O filtro do `WHERE` externo',
        texto:
          'No `WHERE` externo, aplique as regras em conjunto (`AND`) sobre o dado já carimbado: `qtd_historico BETWEEN 1 AND 3`, `valor >= 10 * media_historica`, `valor >= 5000` e `intervalo_segundos <= 864000` (10 dias). Cortar cedo demais (no envelope) impede de ver o histórico que sustenta o salto.',
      },
    },
    gabaritoSql: `-- Gabarito comentado · Conta "aquecida" (CTE + LAG + média histórica)
WITH metricas AS (
  SELECT
    t.id_transacao,
    t.id_conta_origem AS conta_origem,
    c.titular,
    t.valor,
    t.data_hora,
    -- Regra temporal: segundos desde o PIX anterior do MESMO remetente
    unixepoch(t.data_hora) - unixepoch(LAG(t.data_hora) OVER (
      PARTITION BY t.id_conta_origem ORDER BY t.data_hora
    )) AS intervalo_segundos,
    -- Linha de base: média só dos PIX ANTERIORES (o frame exclui a linha atual)
    AVG(t.valor) OVER (
      PARTITION BY t.id_conta_origem ORDER BY t.data_hora
      ROWS BETWEEN UNBOUNDED PRECEDING AND 1 PRECEDING
    ) AS media_historica,
    -- Tamanho do histórico que sustenta essa média
    COUNT(*) OVER (
      PARTITION BY t.id_conta_origem ORDER BY t.data_hora
      ROWS BETWEEN UNBOUNDED PRECEDING AND 1 PRECEDING
    ) AS qtd_historico
  FROM transacoes_pix AS t
  JOIN contas AS c ON c.id_conta = t.id_conta_origem
)
SELECT
  id_transacao,
  conta_origem,
  titular,
  valor,
  data_hora,
  ROUND(intervalo_segundos / 3600.0, 1) AS intervalo_horas,  -- 3600.0 força divisão real
  ROUND(media_historica, 2)             AS media_historica,
  ROUND(valor / media_historica, 2)     AS salto
FROM metricas
WHERE qtd_historico BETWEEN 1 AND 3        -- histórico curto: conta recém-"aquecida"
  AND valor >= 10 * media_historica        -- salto: 10x ou mais o padrão do próprio remetente
  AND valor >= 5000                        -- relevância: ignora saltos de centavos para reais
  AND intervalo_segundos <= 10 * 86400     -- proximidade: até 10 dias após o PIX anterior
ORDER BY salto DESC, id_transacao;`,
    colunaChave: 'id_transacao',
    rotuloEntidade: { singular: 'transação', plural: 'transações' },
    dicasDivergencia: {
      excesso:
        'Há transações a mais. Aplique TODAS as regras juntas (`AND`): histórico entre 1 e 3 PIX, `valor >= 10 * media_historica`, `valor >= 5000` e intervalo `<= 864000` s.',
      falta:
        'Faltam transações. A média deve considerar só os PIX ANTERIORES (`ROWS BETWEEN UNBOUNDED PRECEDING AND 1 PRECEDING`) e o `qtd_historico` usa o mesmo frame; confira também se os limites são inclusivos.',
      valores:
        'As transações estão certas, mas alguma métrica diverge. `intervalo_horas` = `ROUND(intervalo_segundos / 3600.0, 1)`; `media_historica` exclui o PIX atual; `salto` = `ROUND(valor / media_historica, 2)`.',
      ordenacao: 'Os dados estão corretos, mas a ordem não. Ordene por `salto DESC, id_transacao`.',
    },
    resumirSucesso(gabarito) {
      const titulares = distinct(columnValues(gabarito, 'titular'));
      const saltos = columnValues(gabarito, 'salto').map(Number);
      const pico = saltos.length > 0 ? Math.max(...saltos) : 0;
      return {
        message: `Regra composta certeira! ${gabarito.values.length} contas "aquecidas" saltaram até ${formatDecimal(pico)}x o próprio histórico, logo após PIX de teste de poucos reais.`,
        entities: titulares,
        details: [
          'Relaxe o critério de histórico (por exemplo, `qtd_historico <= 10`) e veja surgir clientes com perfil legítimo, como um pagamento pontual de caução a uma imobiliária. Combinar regras é o que reduz falsos positivos.',
        ],
      };
    },
  },
  {
    id: 'janela-movel',
    origem: 'base',
    nivel: 4,
    titulo: 'Acúmulo móvel: soma das últimas 3 originações (ROWS BETWEEN)',
    enquadramento: 'Carta Circular Bacen 4.001/2020 · Fracionamento / estruturação em janela curta',
    dossie:
      'Além do fracionamento clássico (várias operações isoladas abaixo de R$ 10 mil), redes estruturam volume em ' +
      'rajadas de três PIX consecutivos da mesma origem. Cada transferência isolada pode parecer rotineira; a soma móvel ' +
      'das últimas três originações revela o acúmulo. A esteira deve carimbar essa métrica linha a linha e só então aplicar o corte.',
    objetivo:
      'Na CTE `envelope_metricas`, calcule `acumulado_movel_3` com `SUM(valor) OVER (PARTITION BY id_conta_origem ORDER BY data_hora ROWS BETWEEN 2 PRECEDING AND CURRENT ROW)`. ' +
      'No `WHERE` externo, mantenha apenas linhas com `acumulado_movel_3 >= 25000`. Retorne `id_transacao`, `conta_origem`, `titular`, `valor`, `data_hora` e `acumulado_movel_3` (2 casas), ' +
      'ordenando por `acumulado_movel_3 DESC, id_transacao`.',
    colunasEsperadas: ['id_transacao', 'conta_origem', 'titular', 'valor', 'data_hora', 'acumulado_movel_3'],
    ordenacao: 'acumulado_movel_3 DESC, id_transacao',
    dicaTexto:
      'O frame `ROWS BETWEEN 2 PRECEDING AND CURRENT ROW` inclui a linha atual e as duas anteriores da mesma partição. ' +
      'Nas primeiras linhas de cada conta a janela fica menor (1 ou 2 PIX) — o `SUM` ainda é válido. Não filtre a janela no mesmo `SELECT`.',
    dicaSql: `-- FASE 1
WITH envelope_metricas AS (
  SELECT t.id_transacao, t.id_conta_origem AS conta_origem, c.titular, t.valor, t.data_hora,
         SUM(t.valor) OVER (
           PARTITION BY t.id_conta_origem ORDER BY t.data_hora
           ROWS BETWEEN 2 PRECEDING AND CURRENT ROW
         ) AS acumulado_movel_3
  FROM transacoes_pix t
  JOIN contas c ON c.id_conta = t.id_conta_origem
)
-- FASE 2
SELECT ...
FROM envelope_metricas
WHERE acumulado_movel_3 >= ...
ORDER BY ...;`,
    decomposicao: {
      fase1: {
        titulo: 'Fase 1 — O envelope `WITH`',
        texto:
          'Na CTE `envelope_metricas`, carimbe cada originação com `SUM(valor) OVER (... ROWS BETWEEN 2 PRECEDING AND CURRENT ROW)` — a soma móvel das últimas 3 transações da mesma `id_conta_origem`. Selecione o `WITH` e use Testar Seleção / CTE para ver o acumulado ainda sem corte.',
      },
      fase2: {
        titulo: 'Fase 2 — O filtro do `WHERE` externo',
        texto:
          'No `SELECT` externo, isole as linhas já carimbadas com `acumulado_movel_3 >= 25000`. Esse é o corte regulatório: volume estruturado em janela de três PIX, mesmo que cada operação isolada fique abaixo de R$ 10 mil.',
      },
    },
    gabaritoSql: `-- FASE 1: O ENVELOPE ANALÍTICO (Criação da linha do tempo e carimbo de métricas linha a linha)
WITH envelope_metricas AS (
  SELECT
    t.id_transacao,
    t.id_conta_origem AS conta_origem,
    c.titular,
    t.valor,
    t.data_hora,
    -- Soma móvel: linha atual + 2 PIX anteriores da mesma origem
    ROUND(SUM(t.valor) OVER (
      PARTITION BY t.id_conta_origem
      ORDER BY t.data_hora
      ROWS BETWEEN 2 PRECEDING AND CURRENT ROW
    ), 2) AS acumulado_movel_3
  FROM transacoes_pix AS t
  JOIN contas AS c ON c.id_conta = t.id_conta_origem
)
-- FASE 2: O INSPETOR DE RISCO (Corte regulatório e enriquecimento sobre os dados já carimbados)
SELECT
  id_transacao,
  conta_origem,
  titular,
  valor,
  data_hora,
  acumulado_movel_3
FROM envelope_metricas
WHERE acumulado_movel_3 >= 25000   -- corte: acúmulo móvel de 3 originações
ORDER BY acumulado_movel_3 DESC, id_transacao;`,
    colunaChave: 'id_transacao',
    rotuloEntidade: { singular: 'transação', plural: 'transações' },
    dicasDivergencia: {
      excesso:
        'Há transações a mais. Confira o frame `ROWS BETWEEN 2 PRECEDING AND CURRENT ROW` (não use UNBOUNDED) e o corte `acumulado_movel_3 >= 25000` no WHERE externo.',
      falta:
        'Faltam transações. A janela inclui a linha atual; um único PIX de R$ 25 mil ou mais também entra. Confira `>= 25000` (inclusivo) e o `PARTITION BY id_conta_origem`.',
      valores:
        'As transações estão certas, mas `acumulado_movel_3` diverge. Use `ROUND(SUM(valor) OVER (...), 2)` com `ORDER BY data_hora` na partição da origem.',
      ordenacao: 'Os dados estão corretos, mas a ordem não. Ordene por `acumulado_movel_3 DESC, id_transacao`.',
    },
    resumirSucesso(gabarito) {
      const contas = distinct(columnValues(gabarito, 'conta_origem'));
      const picos = columnValues(gabarito, 'acumulado_movel_3').map(Number);
      const pico = picos.length > 0 ? Math.max(...picos) : 0;
      return {
        message:
          `Janela móvel de 3 PIX identificou ${gabarito.values.length} alerta(s) em ${contas.length} conta(s); o maior acumulado foi ${formatBRL(pico)}.`,
        entities: contas,
        details: [
          'Compare com um `SUM` / `GROUP BY` no dia inteiro: a janela `ROWS BETWEEN` pega estruturação que cruza viradas de dia e ignora o PIX isolado “limpo” no meio de uma sequência.',
        ],
      };
    },
  },
];

/** Catálogo base na ordem da trilha (a ordenação é estável dentro de cada nível). */
export const SCENARIOS: readonly InvestigationScenario[] = [...CATALOG].sort((a, b) => a.nivel - b.nivel);