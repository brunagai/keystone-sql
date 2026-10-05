import type { QueryExecResult } from 'sql.js';
import { formatBRL, formatDecimal } from '../ui/format.ts';

export type ScenarioId = string;

export type ScenarioOrigin = 'base' | 'ia' | 'offline';

/** Degraus da trilha pedagógica; o nível 5 cobre QSA/telemetria/produtos e, em seguida, desafios gerados. */
export type TrailLevel = 1 | 2 | 3 | 4 | 5;

export interface TrailLevelInfo {
  titulo: string;
  /** Técnica SQL que o nível exercita. */
  tecnica: string;
}

export const TRAIL_LEVELS: Record<TrailLevel, TrailLevelInfo> = {
  1: { titulo: 'Fundamentos de Agregação', tecnica: 'GROUP BY, HAVING, JOIN e limiares' },
  2: { titulo: 'Janelas e Classificação', tecnica: 'ROW_NUMBER() OVER (PARTITION BY …)' },
  3: { titulo: 'Análise Temporal e Mudança de Padrão', tecnica: 'LAG / LEAD e recorte horário (strftime)' },
  4: { titulo: 'Composição Analítica com CTEs', tecnica: 'WITH + janelas, LAG e ROWS BETWEEN' },
  5: { titulo: 'Casos Avançados de PLD/FT', tecnica: 'JOIN em QSA, telemetria de acesso e produtos financeiros' },
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
      'Identifique os remetentes que enviaram PIX individuais entre R$ 9.700,00 e R$ 9.999,00 para a conta C025, ' +
      'com pelo menos 2 operações, consolidando o volume total por conta e priorizando os maiores montantes.',
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
      'Liste as transações em que o intervalo até a operação imediatamente anterior da mesma conta de origem seja de ' +
      'no máximo 60 segundos, evidenciando rajadas incompatíveis com uso humano habitual.',
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
    id: 'noturno-coacao',
    origem: 'base',
    nivel: 3,
    titulo: 'Nível 3.2 — Transferência Noturna Sob Coação (Sequestro / Madrugada)',
    enquadramento:
      'Carta Circular Bacen 4.001/2020 c/c Resolução BCB 142/2021 (Regulamentação de Limite Noturno do PIX)',
    dossie:
      'A Resolução BCB 142/2021 restringe o PIX noturno precisamente porque sequestro relâmpago, furto de celular e ' +
      'transferência forçada concentram-se entre o fim da noite e a madrugada, quando o titular não opera o aplicativo ' +
      'por rotina comercial. A área de PLD quer a esteira listando originações de valor relevante nesse fuso, inclusive ' +
      'a advogada C005 (perfil estritamente diurno) que passou a enviar PIX elevados a uma intermediadora (C032) após 23h30.',
    objetivo:
      'Identifique originações PIX de R$ 5.000,00 ou mais ocorridas no período noturno e de madrugada (das 20h às 5h59), ' +
      'priorizando os maiores valores e, em seguida, a ordem cronológica.',
    colunasEsperadas: ['id_transacao', 'conta_origem', 'conta_destino', 'valor', 'data_hora', 'hora_transacao'],
    ordenacao: 'valor DESC, data_hora ASC',
    dicaTexto:
      "Carimbe a hora no envelope com `CAST(strftime('%H', data_hora) AS INTEGER)`. O `WHERE` do SQLite não aceita alias da mesma projeção: " +
      'use a CTE (FASE 1) e filtre `hora_transacao` e `valor` no SELECT externo (FASE 2).',
    dicaSql: `-- FASE 1
WITH envelope_metricas AS (
  SELECT t.id_transacao, t.id_conta_origem AS conta_origem, t.id_conta_destino AS conta_destino,
         t.valor, t.data_hora,
         CAST(strftime('%H', t.data_hora) AS INTEGER) AS hora_transacao
  FROM transacoes_pix t
)
-- FASE 2
SELECT ...
FROM envelope_metricas
WHERE valor >= ...
  AND (hora_transacao >= 20 OR hora_transacao < 6)
ORDER BY ...;`,
    decomposicao: {
      fase1: {
        titulo: 'Fase 1 — O envelope `WITH`',
        texto:
          "Na CTE, projete as colunas de evidência e carimbe `hora_transacao` com `CAST(strftime('%H', data_hora) AS INTEGER)`. Não aplique o recorte noturno nem o limiar de valor aqui — o compilador precisa da coluna já materializada.",
      },
      fase2: {
        titulo: 'Fase 2 — O filtro do `WHERE` externo',
        texto:
          'No inspetor, corte `valor >= 5000` e `(hora_transacao >= 20 OR hora_transacao < 6)` (20h–5h59, horário de Brasília). A Res. BCB 142 trata esse fuso como de risco elevado para PIX forçado.',
      },
    },
    gabaritoSql: `-- FASE 1: O ENVELOPE ANALÍTICO (Criação da linha do tempo e carimbo de métricas linha a linha)
WITH envelope_metricas AS (
  SELECT
    t.id_transacao,
    t.id_conta_origem  AS conta_origem,
    t.id_conta_destino AS conta_destino,
    t.valor,
    t.data_hora,
    -- Hora cheia 0–23 (Brasília); o alias só existe depois desta CTE
    CAST(strftime('%H', t.data_hora) AS INTEGER) AS hora_transacao
  FROM transacoes_pix AS t
)
-- FASE 2: O INSPETOR DE RISCO (Corte regulatório e enriquecimento sobre os dados já carimbados)
SELECT
  id_transacao,
  conta_origem,
  conta_destino,
  valor,
  data_hora,
  hora_transacao
FROM envelope_metricas
WHERE valor >= 5000
  AND (hora_transacao >= 20 OR hora_transacao < 6)  -- noturno / madrugada (Res. BCB 142)
ORDER BY valor DESC, data_hora ASC;`,
    colunaChave: 'id_transacao',
    rotuloEntidade: { singular: 'transação', plural: 'transações' },
    dicasDivergencia: {
      excesso:
        'Há transações a mais. Confira `valor >= 5000` e o recorte `(hora >= 20 OR hora < 6)`. `strftime(\'%H\')` devolve texto; faça o `CAST` no envelope.',
      falta:
        'Faltam transações. Inclua 20h–23h e 00h–05h (`hora < 6`). C005→C032 após 23h30 e rajadas noturnas da C032 com valor ≥ R$ 5 mil devem entrar.',
      valores:
        'As transações estão certas, mas `hora_transacao` diverge. Use `CAST(strftime(\'%H\', data_hora) AS INTEGER)` (0 a 23), sem fuso extra.',
      ordenacao: 'Os dados estão corretos, mas a ordem não. Ordene por `valor DESC, data_hora ASC`.',
    },
    resumirSucesso(gabarito) {
      const origens = distinct(columnValues(gabarito, 'conta_origem'));
      const total = sum(columnValues(gabarito, 'valor'));
      return {
        message: `Recorte noturno da Res. BCB 142: ${gabarito.values.length} PIX ≥ R$ 5 mil entre 20h e 5h59 (${origens.length} origens; volume ${formatBRL(total)}).`,
        entities: origens,
        details: [
          'Compare com o perfil diurno da C005: honorários e rotina comercial não explicam PIX de R$ 8.500 e R$ 9.200 à C032 depois das 23h30 — típico de coação ou drible de limite noturno.',
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
      'Identifique transações individuais em que o valor enviado seja igual ou superior a 30 vezes a renda mensal ' +
      'declarada do titular da conta de origem, destacando o grau de desproporção em relação ao perfil cadastral.',
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
      'Considerando apenas os PIX de 18/08/2026, produza uma visão desduplicada: uma linha por conta de origem com a ' +
      'maior transação do dia (em empate de valor, prevalece a operação mais antiga), além da quantidade de envios e do ' +
      'volume total daquela conta no dia.',
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
      'Encontre originações em que a conta tinha um histórico curto (de 1 a 3 PIX anteriores), o valor atual é pelo menos ' +
      '10 vezes a média desses PIX anteriores e também igual ou superior a R$ 5.000,00, e o salto ocorre em até 10 dias ' +
      'após a operação anterior — padrão de conta "aquecida".',
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
      'Identifique originações em que a soma dos últimos 3 PIX da mesma conta de origem (incluindo o atual) alcance ' +
      'R$ 25.000,00 ou mais, priorizando os maiores acúmulos.',
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
  {
    id: 'pep-escalada',
    origem: 'base',
    nivel: 4,
    titulo: 'Nível 4.3 — Escalada Rápida em PEP (Escrutínio Reforçado)',
    enquadramento:
      'Circular Bacen 3.978/2020 c/c Carta Circular 4.001/2020 (Escrutínio Reforçado em Pessoas Expostas Politicamente)',
    dossie:
      'Titulares PEP exigem monitoramento reforçado: o mesmo volume que em um cliente comum pode ser apenas ruído vira ' +
      'alerta quando o cargo público está no cadastro KYC. A denúncia aponta originações em sequência curta na conta de um ' +
      'deputado estadual (C013), cada PIX isolado abaixo de R$ 10 mil. A esteira deve cruzar `eh_pep` com a soma móvel das ' +
      'últimas três operações e só então aplicar o corte de escrutínio.',
    objetivo:
      'Identifique originações de titulares pessoas expostas politicamente (PEP) em que a soma móvel das últimas 3 ' +
      'operações da mesma conta supere R$ 20.000,00, priorizando os maiores acúmulos no escrutínio reforçado.',
    colunasEsperadas: [
      'id_transacao',
      'conta_origem',
      'titular',
      'cargo_pep',
      'valor',
      'data_hora',
      'acumulado_movel_pep',
    ],
    ordenacao: 'acumulado_movel_pep DESC, id_transacao ASC',
    dicaTexto:
      'Faça o JOIN de `transacoes_pix` com `contas` no envelope para carimbar a janela e o cargo. O corte `eh_pep = 1` e ' +
      '`acumulado_movel_pep > 20000` vai no `WHERE` externo — Window Function não entra no `WHERE` do mesmo `SELECT`.',
    dicaSql: `-- FASE 1
WITH envelope_metricas AS (
  SELECT t.id_transacao, t.id_conta_origem AS conta_origem, c.titular, c.eh_pep, c.cargo_pep,
         t.valor, t.data_hora,
         SUM(t.valor) OVER (
           PARTITION BY t.id_conta_origem ORDER BY t.data_hora
           ROWS BETWEEN 2 PRECEDING AND CURRENT ROW
         ) AS acumulado_movel_pep
  FROM transacoes_pix t
  JOIN contas c ON c.id_conta = t.id_conta_origem
)
-- FASE 2
SELECT ...
FROM envelope_metricas
WHERE eh_pep = 1 AND acumulado_movel_pep > ...
ORDER BY ...;`,
    decomposicao: {
      fase1: {
        titulo: 'Fase 1 — O envelope `WITH`',
        texto:
          'Faça o `JOIN` entre `transacoes_pix` e `contas` e carimbe `SUM(valor) OVER (PARTITION BY id_conta_origem ORDER BY data_hora ROWS BETWEEN 2 PRECEDING AND CURRENT ROW)` mais `eh_pep` e `cargo_pep`. A janela considera todas as originações da conta, não só as de PEP. Selecione o `WITH` e use Testar Seleção / CTE.',
      },
      fase2: {
        titulo: 'Fase 2 — O filtro do `WHERE` externo',
        texto:
          'No `SELECT` externo aplique o escrutínio reforçado: `eh_pep = 1` e `acumulado_movel_pep > 20000`. O Prefeito (C004) só entra se a soma móvel dele também romper o limiar; o recorte plantado é o Deputado (C013) em 27/08.',
      },
    },
    gabaritoSql: `-- FASE 1: O ENVELOPE ANALÍTICO (Criação da linha do tempo e carimbo de métricas linha a linha)
WITH envelope_metricas AS (
  SELECT
    t.id_transacao,
    t.id_conta_origem AS conta_origem,
    c.titular,
    c.eh_pep,
    c.cargo_pep,
    t.valor,
    t.data_hora,
    -- Soma móvel das últimas 3 originações (linha atual + 2 anteriores)
    ROUND(SUM(t.valor) OVER (
      PARTITION BY t.id_conta_origem
      ORDER BY t.data_hora
      ROWS BETWEEN 2 PRECEDING AND CURRENT ROW
    ), 2) AS acumulado_movel_pep
  FROM transacoes_pix AS t
  JOIN contas AS c ON c.id_conta = t.id_conta_origem
)
-- FASE 2: O INSPETOR DE RISCO (Corte regulatório e enriquecimento sobre os dados já carimbados)
SELECT
  id_transacao,
  conta_origem,
  titular,
  cargo_pep,
  valor,
  data_hora,
  acumulado_movel_pep
FROM envelope_metricas
WHERE eh_pep = 1                    -- escrutínio reforçado: só PEP
  AND acumulado_movel_pep > 20000   -- corte: janela de 3 PIX acima de R$ 20 mil
ORDER BY acumulado_movel_pep DESC, id_transacao ASC;`,
    colunaChave: 'id_transacao',
    rotuloEntidade: { singular: 'transação', plural: 'transações' },
    dicasDivergencia: {
      excesso:
        'Há transações a mais. Filtre `eh_pep = 1` e `acumulado_movel_pep > 20000` (estrito) no WHERE externo. Não use o limiar de R$ 25 mil do desafio 4.2.',
      falta:
        'Faltam transações. Confira o JOIN com `contas`, o frame `ROWS BETWEEN 2 PRECEDING AND CURRENT ROW` e o corte `> 20000` (a terceira originação de C013 em 27/08 deve entrar).',
      valores:
        'As transações estão certas, mas `acumulado_movel_pep` ou `cargo_pep` divergem. Projeté `cargo_pep` do cadastro e `ROUND(SUM(valor) OVER (...), 2)`.',
      ordenacao: 'Os dados estão corretos, mas a ordem não. Ordene por `acumulado_movel_pep DESC, id_transacao ASC`.',
    },
    resumirSucesso(gabarito) {
      const titulares = distinct(columnValues(gabarito, 'titular'));
      const cargos = distinct(columnValues(gabarito, 'cargo_pep'));
      const picos = columnValues(gabarito, 'acumulado_movel_pep').map(Number);
      const pico = picos.length > 0 ? Math.max(...picos) : 0;
      return {
        message:
          `Escrutínio reforçado: ${gabarito.values.length} originação(ões) PEP com janela móvel acima de R$ 20 mil (pico ${formatBRL(pico)}; cargos: ${cargos.join(', ')}).`,
        entities: titulares,
        details: [
          'Compare o 4.2 (`>= 25000`, qualquer titular) com este corte (`> 20000` só em `eh_pep = 1`): o limiar cai porque o risco do cargo público justifica alerta mais cedo.',
        ],
      };
    },
  },
  {
    id: 'ubo-aurora',
    origem: 'base',
    nivel: 5,
    titulo: 'Rastreio de UBO: Sócios Relevantes em Empresas Suspeitas',
    enquadramento: 'Carta Circular Bacen 4.001/2020 · empresas de fachada, laranjas e beneficiário final (UBO)',
    dossie:
      'A Aurora (C025) concentrou dezenas de PIX logo abaixo de R$ 10 mil e integrou capital na holding. A Circular 3.978/2020 ' +
      'exige conhecer o beneficiário final; a Carta Circular 4.001 cita uso de laranjas e sociedades de fachada para ocultar ' +
      'o controlador. Cruze o QSA (`socios_empresas`) da conta investigada e isole quem de fato manda na empresa: participação ' +
      'relevante e poderes de administrador.',
    objetivo:
      'Identifique os sócios da empresa vinculada à conta C025 com participação societária de 25% ou mais que figurem ' +
      'como administradores, priorizando as maiores fatias de capital — o beneficiário final (UBO) da receptora sob alerta.',
    colunasEsperadas: ['nome_socio', 'cpf_socio', 'percentual_participacao', 'cnpj_empresa'],
    ordenacao: 'percentual_participacao DESC, nome_socio',
    dicaTexto:
      'A tabela `socios_empresas` liga o sócio à conta PJ por `id_conta_empresa`. Filtre a Aurora (`C025`), o piso de 25% e o flag de administrador. Um `JOIN contas c ON c.id_conta = s.id_conta_empresa` ajuda a conferir a razão social, mas as colunas pedidas saem do QSA.',
    dicaSql: `SELECT s.nome_socio,
       s.cpf_socio,
       s.percentual_participacao,
       s.cnpj_empresa
FROM socios_empresas AS s
JOIN contas AS c ON c.id_conta = s.id_conta_empresa
WHERE s.id_conta_empresa = 'C025'
  AND s.percentual_participacao >= ...
  AND s.eh_administrador = ...
ORDER BY ...;`,
    gabaritoSql: `-- Gabarito · UBO / QSA da receptora Aurora (C025)
SELECT
  s.nome_socio,
  s.cpf_socio,
  s.percentual_participacao,
  s.cnpj_empresa
FROM socios_empresas AS s
WHERE s.id_conta_empresa = 'C025'          -- empresa do smurfing
  AND s.percentual_participacao >= 25      -- sócio relevante (CC 4.001 / UBO)
  AND s.eh_administrador = 1               -- poderes de gestão
ORDER BY s.percentual_participacao DESC, s.nome_socio;`,
    colunaChave: 'cpf_socio',
    rotuloEntidade: { singular: 'sócio', plural: 'sócios' },
    dicasDivergencia: {
      excesso:
        'Há sócios a mais. Mantenha `id_conta_empresa = \'C025\'`, `percentual_participacao >= 25` e `eh_administrador = 1`. Laranjas com 1% não entram.',
      falta:
        'Faltam sócios. Confira a tabela `socios_empresas`, o piso inclusivo de 25% e se o administrador de fato da Aurora foi marcado com `eh_administrador = 1`.',
      valores:
        'Os sócios estão certos, mas algum campo diverge. Projete `nome_socio`, `cpf_socio`, `percentual_participacao` e `cnpj_empresa` sem arredondar o percentual.',
      ordenacao: 'Os dados estão corretos, mas a ordem não. Ordene por `percentual_participacao DESC, nome_socio`.',
    },
    resumirSucesso(gabarito) {
      const nomes = distinct(columnValues(gabarito, 'nome_socio'));
      return {
        message: `UBO localizado: ${gabarito.values.length} sócio(s) relevante(s) e administrador(es) no QSA da Aurora (${nomes.join(', ') || '—'}).`,
        entities: nomes,
        details: [
          'Os laranjas com participação residual continuam no QSA, mas o corte de 25% + administrador aponta o controlador econômico.',
        ],
      };
    },
  },
  {
    id: 'ato-dispositivo',
    origem: 'base',
    nivel: 5,
    titulo: 'Account Takeover (ATO): Dispositivo Inédito e Transação Atípica',
    enquadramento: 'Circular Bacen 3.978/2020 · canais eletrônicos, dispositivo e geolocalização incompatíveis (ATO)',
    dossie:
      'A esteira de canais eletrônicos cruzou telemetria com o PIX. Há relato de sessão autenticada a partir de cidade e IP ' +
      'incompatíveis com o cadastro (exemplo plantado: Manaus) minutos antes de uma originação de alto valor. A Circular 3.978 ' +
      'pede monitoramento de transações e de meios de acesso; a Carta Circular 4.001 cita uso atípico de canais e de dispositivos ' +
      'como indício de fraude / account takeover.',
    objetivo:
      'Identifique contas com login bem-sucedido cuja cidade do acesso diverge da cidade cadastral, ocorrido imediatamente ' +
      'antes (até 15 minutos) de uma saída PIX de R$ 10.000,00 ou mais, priorizando as saídas de maior valor.',
    colunasEsperadas: ['id_conta', 'device_id', 'geolocalizacao_cidade', 'valor_transacao'],
    ordenacao: 'valor_transacao DESC, id_conta',
    dicaTexto:
      'Correlacione `acessos_digitais` com `transacoes_pix` (origem) e `contas` (cidade KYC). A divergência é `a.geolocalizacao_cidade <> c.cidade`. A janela “imediatamente antes” usa `unixepoch(t.data_hora) - unixepoch(a.data_hora)` entre 0 e 900 segundos.',
    dicaSql: `SELECT a.id_conta,
       a.device_id,
       a.geolocalizacao_cidade,
       t.valor AS valor_transacao
FROM acessos_digitais AS a
JOIN contas AS c ON c.id_conta = a.id_conta
JOIN transacoes_pix AS t ON t.id_conta_origem = a.id_conta
WHERE a.sucesso = 1
  AND a.geolocalizacao_cidade <> c.cidade
  AND t.valor >= ...
  AND unixepoch(t.data_hora) - unixepoch(a.data_hora) BETWEEN 0 AND 900
ORDER BY ...;`,
    gabaritoSql: `-- Gabarito · ATO (telemetria × PIX de alto valor)
SELECT
  a.id_conta,
  a.device_id,
  a.geolocalizacao_cidade,
  t.valor AS valor_transacao
FROM acessos_digitais AS a
JOIN contas AS c
  ON c.id_conta = a.id_conta
JOIN transacoes_pix AS t
  ON t.id_conta_origem = a.id_conta
WHERE a.sucesso = 1
  AND a.geolocalizacao_cidade <> c.cidade
  AND t.valor >= 10000
  AND unixepoch(t.data_hora) - unixepoch(a.data_hora) BETWEEN 0 AND 900
ORDER BY t.valor DESC, a.id_conta;`,
    colunaChave: 'id_conta',
    rotuloEntidade: { singular: 'conta', plural: 'contas' },
    dicasDivergencia: {
      excesso:
        'Há linhas a mais. Exija login com sucesso, cidade diferente do cadastro, PIX de saída `>= 10000` e intervalo de no máximo 900 s após o acesso.',
      falta:
        'Faltam eventos. Faça JOIN de `acessos_digitais` com `contas` e `transacoes_pix` na origem; o caso plantado é o device inédito em Manaus minutos antes do PIX alto.',
      valores:
        'As contas estão certas, mas `device_id`, cidade ou `valor_transacao` divergem. Alias `t.valor AS valor_transacao` e use a cidade do log, não a do KYC.',
      ordenacao: 'Os dados estão corretos, mas a ordem não. Ordene por `valor_transacao DESC, id_conta`.',
    },
    resumirSucesso(gabarito) {
      const contas = distinct(columnValues(gabarito, 'id_conta'));
      const cidades = distinct(columnValues(gabarito, 'geolocalizacao_cidade'));
      return {
        message: `ATO confirmado: ${gabarito.values.length} sessão(ões) em ${cidades.join(', ') || 'cidade atípica'} imediatamente antes de saídas de alto valor (${contas.join(', ')}).`,
        entities: contas,
        details: [
          'Compare com o histórico de device habitual da mesma conta: o salto geográfico + canal API no PIX é o padrão clássico de takeover.',
        ],
      };
    },
  },
  {
    id: 'consorcio-especie',
    origem: 'base',
    nivel: 5,
    titulo: 'Ocultação Patrimonial: Lance de Consórcio em Espécie',
    enquadramento: 'Carta Circular Bacen 4.001/2020 · integralização atípica e uso de espécie em produtos',
    dossie:
      'Consórcios contemplados e aplicações de renda fixa são veículos clássicos de conversão de numerário. A Circular 3.978/2020 ' +
      'trata da abordagem baseada em risco sobre produtos; a Carta Circular 4.001 aponta pagamentos em espécie sem fundamento e ' +
      'integralizações incompatíveis com o perfil. A esteira deve achar lances de consórcio liquidados em `ESPECIE` para obtenção ' +
      'de bem contemplado (`status_contemplacao = 1`).',
    objetivo:
      'Localize contas que liquidaram lances de consórcio já contemplados mediante pagamento em espécie, priorizando os ' +
      'maiores aportes — típico veículo de conversão de numerário.',
    colunasEsperadas: ['id_conta', 'tipo_produto', 'valor_aporte', 'forma_liquidacao'],
    ordenacao: 'valor_aporte DESC, id_conta',
    dicaTexto:
      'Tudo está em `operacoes_produtos`. Não precisa de JOIN para o recorte mínimo. Combine os três filtros no `WHERE` e projete as quatro colunas pedidas. Um `JOIN contas` só é necessário se você quiser o titular no rascunho — a esteira não exige isso.',
    dicaSql: `SELECT id_conta,
       tipo_produto,
       valor_aporte,
       forma_liquidacao
FROM operacoes_produtos
WHERE tipo_produto = 'CONSORCIO_LANCE'
  AND forma_liquidacao = 'ESPECIE'
  AND status_contemplacao = ...
ORDER BY ...;`,
    gabaritoSql: `-- Gabarito · consórcio contemplado liquidado em espécie
SELECT
  id_conta,
  tipo_produto,
  valor_aporte,
  forma_liquidacao
FROM operacoes_produtos
WHERE tipo_produto = 'CONSORCIO_LANCE'
  AND forma_liquidacao = 'ESPECIE'
  AND status_contemplacao = 1
ORDER BY valor_aporte DESC, id_conta;`,
    colunaChave: 'id_conta',
    rotuloEntidade: { singular: 'conta', plural: 'contas' },
    dicasDivergencia: {
      excesso:
        'Há operações a mais. Restrinja a `CONSORCIO_LANCE`, `ESPECIE` e `status_contemplacao = 1`. Aportes em PIX/TED ou consórcios não contemplados ficam de fora.',
      falta:
        'Faltam operações. Use a tabela `operacoes_produtos` (não o PIX). A Aurora (C025) tem lance contemplado em espécie; outras contas com o mesmo padrão também entram.',
      valores:
        'As contas estão certas, mas `tipo_produto`, `valor_aporte` ou `forma_liquidacao` divergem. Não arredonde o aporte; projete as colunas cruas da tabela.',
      ordenacao: 'Os dados estão corretos, mas a ordem não. Ordene por `valor_aporte DESC, id_conta`.',
    },
    resumirSucesso(gabarito) {
      const contas = distinct(columnValues(gabarito, 'id_conta'));
      const total = sum(columnValues(gabarito, 'valor_aporte'));
      return {
        message: `Ocultação via produto: ${gabarito.values.length} lance(s) de consórcio contemplado(s) em espécie, somando ${formatBRL(total)} (${contas.join(', ')}).`,
        entities: contas,
        details: [
          'O numerário entra como “lance” e sai como bem ou carta de crédito — caminho clássico de layering fora do PIX.',
        ],
      };
    },
  },
];

/** Catálogo base na ordem da trilha (a ordenação é estável dentro de cada nível). */
export const SCENARIOS: readonly InvestigationScenario[] = [...CATALOG].sort((a, b) => a.nivel - b.nivel);