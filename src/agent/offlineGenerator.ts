import type { Database } from 'sql.js';
import { verifyChallenge } from './challengeVerifier.ts';
import type { ChallengeFocus, GeneratedChallenge, GenerationRequest } from './types.ts';

interface TemplateDef<P> {
  focus: Exclude<ChallengeFocus, 'livre'>;
  variants: readonly P[];
  build: (p: P) => Omit<GeneratedChallenge, 'id'>;
}

interface OfflineTemplate {
  focus: Exclude<ChallengeFocus, 'livre'>;
  candidates: () => Omit<GeneratedChallenge, 'id'>[];
}

const defineTemplate = <P>(def: TemplateDef<P>): OfflineTemplate => ({
  focus: def.focus,
  candidates: () => def.variants.map(def.build),
});

const brl = (n: number): string => n.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL', maximumFractionDigits: 0 });

export const OFFLINE_TEMPLATES: readonly OfflineTemplate[] = [
  defineTemplate({
    focus: 'horario_atipico',
    variants: [
      { inicio: '23', fim: '06', valorMin: 1000 },
      { inicio: '22', fim: '05', valorMin: 2000 },
    ],
    build: ({ inicio, fim, valorMin }) => ({
      titulo: `PIX de madrugada (${inicio}h–${fim}h) acima de ${brl(valorMin)}`,
      tipologiaBacen: 'Movimentação atípica em horário e canal',
      badgeEnquadramento: 'Carta Circular 4.001/2020 · Horário atípico',
      contexto:
        'A mesa de monitoramento identificou liquidações relevantes fora do horário comercial, muitas iniciadas por API. ' +
        'Operações noturnas recorrentes, sem relação com o perfil do cliente, podem indicar automação para dispersar recursos.',
      objetivo:
        `Liste as transações realizadas entre ${inicio}:00 e ${fim}:59 (virando a noite) com \`valor >= ${valorMin}\`. ` +
        'Retorne `id_transacao`, `conta_origem`, `conta_destino`, `canal`, `valor` e `data_hora`, ordenando por `data_hora, id_transacao`.',
      dicaSql: `SELECT ...
FROM transacoes_pix
WHERE (strftime('%H', data_hora) >= '..' OR strftime('%H', data_hora) < '..')
  AND valor >= ...
ORDER BY ...;`,
      solutionQuery: `-- Horário atípico: hora extraída com strftime('%H') (texto '00'..'23')
SELECT
  t.id_transacao,
  t.id_conta_origem  AS conta_origem,
  t.id_conta_destino AS conta_destino,
  t.canal,                                         -- API tende a indicar automação
  t.valor,
  t.data_hora
FROM transacoes_pix AS t
WHERE (strftime('%H', t.data_hora) >= '${inicio}'        -- a partir de ${inicio}h...
       OR strftime('%H', t.data_hora) < '${fim}')        -- ...até antes das ${fim}h (janela vira a noite)
  AND t.valor >= ${valorMin}                             -- materialidade mínima
ORDER BY t.data_hora, t.id_transacao;                    -- cronológico, com desempate`,
      criteriosValidacao: {
        colunasEsperadas: ['id_transacao', 'conta_origem', 'conta_destino', 'canal', 'valor', 'data_hora'],
        descricaoSucesso: 'Você isolou a movimentação noturna relevante. Observe a concentração no canal API e em poucas contas.',
      },
    }),
  }),
  defineTemplate({
    focus: 'fan_in_out',
    variants: [
      { dataCorte: '2026-01-01', minOrigens: 3 },
      { dataCorte: '2026-01-01', minOrigens: 2 },
    ],
    build: ({ dataCorte, minOrigens }) => ({
      titulo: `Fan-in em contas recém-abertas (≥ ${minOrigens} origens)`,
      tipologiaBacen: 'Concentração de recebimentos de múltiplas origens',
      badgeEnquadramento: 'Carta Circular 4.001/2020 · Fan-in em conta nova',
      contexto:
        'Contas abertas recentemente passaram a receber recursos de várias pessoas diferentes em poucos dias. ' +
        'O padrão de concentração (fan-in) sem histórico é típico de contas usadas para agregar valores de terceiros.',
      objetivo:
        `Para contas com \`data_abertura >= '${dataCorte}'\`, calcule por conta recebedora: \`conta_destino\`, \`titular\`, ` +
        `\`data_abertura\`, \`origens_distintas\`, \`total_recebimentos\` e \`valor_recebido\`. Mantenha apenas as que tiveram ` +
        `pelo menos ${minOrigens} origens distintas, ordenando por \`valor_recebido DESC\`.`,
      dicaSql: `SELECT t.id_conta_destino AS conta_destino, ...,
       COUNT(DISTINCT t.id_conta_origem) AS origens_distintas
FROM transacoes_pix t
JOIN contas c ON c.id_conta = t.id_conta_destino
WHERE ...
GROUP BY ...
HAVING ...;`,
      solutionQuery: `-- Fan-in: muitas origens distintas para a mesma conta recebedora recém-aberta
SELECT
  t.id_conta_destino                 AS conta_destino,
  c.titular,
  c.data_abertura,
  COUNT(DISTINCT t.id_conta_origem)  AS origens_distintas,   -- quantos pagadores diferentes
  COUNT(*)                           AS total_recebimentos,
  ROUND(SUM(t.valor), 2)             AS valor_recebido
FROM transacoes_pix AS t
JOIN contas AS c ON c.id_conta = t.id_conta_destino          -- dados cadastrais do recebedor
WHERE c.data_abertura >= '${dataCorte}'                         -- conta sem histórico
GROUP BY t.id_conta_destino
HAVING COUNT(DISTINCT t.id_conta_origem) >= ${minOrigens}      -- critério de concentração
ORDER BY valor_recebido DESC, conta_destino;`,
      criteriosValidacao: {
        colunasEsperadas: ['conta_destino', 'titular', 'data_abertura', 'origens_distintas', 'total_recebimentos', 'valor_recebido'],
        descricaoSucesso: 'Você encontrou contas novas atuando como concentradoras de recursos de terceiros, um sinal clássico de agregação.',
      },
    }),
  }),
  defineTemplate({
    focus: 'conta_passagem',
    variants: [
      { minRecebido: 50000, pMin: 0.8, pMax: 1.1 },
      { minRecebido: 30000, pMin: 0.7, pMax: 1.2 },
    ],
    build: ({ minRecebido, pMin, pMax }) => ({
      titulo: `Contas de passagem (repasse entre ${Math.round(pMin * 100)}% e ${Math.round(pMax * 100)}%)`,
      tipologiaBacen: 'Conta de passagem / pass-through',
      badgeEnquadramento: 'Carta Circular 4.001/2020 · Conta de passagem',
      contexto:
        'O COAF solicitou mapeamento de contas que funcionam como "corredor" de recursos: recebem valores expressivos e ' +
        'repassam quase tudo em seguida, mantendo saldo residual. O padrão sugere interposição de pessoas (laranjas).',
      objetivo:
        `Calcule, por conta, o total recebido e o total enviado no período. Retorne \`id_conta\`, \`titular\`, \`renda_mensal\`, ` +
        `\`total_recebido\`, \`total_enviado\` e \`taxa_repasse\` (enviado/recebido, 2 casas) para contas com recebimentos ` +
        `\`>= ${minRecebido}\` e taxa entre ${pMin} e ${pMax}. Ordene por \`total_recebido DESC\`.`,
      dicaSql: `WITH entradas AS (
  SELECT id_conta_destino AS id_conta, SUM(valor) AS total_recebido
  FROM transacoes_pix GROUP BY 1
),
saidas AS ( ... )
SELECT ...
FROM contas c
JOIN entradas e ON ...
JOIN saidas s ON ...
WHERE ...;`,
      solutionQuery: `-- Conta de passagem: entradas e saídas de mesma magnitude
WITH entradas AS (
  SELECT id_conta_destino AS id_conta, SUM(valor) AS total_recebido   -- tudo que a conta recebeu
  FROM transacoes_pix
  GROUP BY id_conta_destino
),
saidas AS (
  SELECT id_conta_origem AS id_conta, SUM(valor) AS total_enviado     -- tudo que a conta enviou
  FROM transacoes_pix
  GROUP BY id_conta_origem
)
SELECT
  c.id_conta,
  c.titular,
  c.renda_mensal_declarada                  AS renda_mensal,
  ROUND(e.total_recebido, 2)                AS total_recebido,
  ROUND(s.total_enviado, 2)                 AS total_enviado,
  ROUND(s.total_enviado / e.total_recebido, 2) AS taxa_repasse      -- perto de 1 = repassa quase tudo
FROM contas AS c
JOIN entradas AS e ON e.id_conta = c.id_conta
JOIN saidas   AS s ON s.id_conta = c.id_conta
WHERE e.total_recebido >= ${minRecebido}                                     -- materialidade
  AND s.total_enviado BETWEEN ${pMin} * e.total_recebido AND ${pMax} * e.total_recebido
ORDER BY total_recebido DESC, c.id_conta;`,
      criteriosValidacao: {
        colunasEsperadas: ['id_conta', 'titular', 'renda_mensal', 'total_recebido', 'total_enviado', 'taxa_repasse'],
        descricaoSucesso: 'Você mapeou as contas-corredor: recebem alto volume e repassam quase tudo, muitas vezes com renda incompatível.',
      },
    }),
  }),
  defineTemplate({
    focus: 'valores_redondos',
    variants: [
      { min: 5000, mult: 1000 },
      { min: 10000, mult: 5000 },
    ],
    build: ({ min, mult }) => ({
      titulo: `Valores redondos (múltiplos de ${brl(mult)} a partir de ${brl(min)})`,
      tipologiaBacen: 'Operações em valores redondos sem fundamento econômico',
      badgeEnquadramento: 'Carta Circular 4.001/2020 · Valores atípicos',
      contexto:
        'Transferências comerciais legítimas costumam ter centavos e valores "quebrados". Repasses vultosos em valores ' +
        'exatos e redondos, recorrentes entre as mesmas partes, merecem análise de propósito econômico.',
      objetivo:
        `Agrupe por conta de origem os PIX com \`valor >= ${min}\` que sejam múltiplos exatos de ${mult}. Retorne ` +
        '`conta_origem`, `qtd_redondas` e `valor_total`, ordenando por `valor_total DESC`.',
      dicaSql: `SELECT id_conta_origem AS conta_origem, COUNT(*) AS ..., SUM(valor) AS ...
FROM transacoes_pix
WHERE valor >= ...
  AND valor = CAST(valor AS INTEGER)       -- sem centavos
  AND CAST(valor AS INTEGER) % ... = 0
GROUP BY ...
ORDER BY ...;`,
      solutionQuery: `-- Valores redondos: inteiros e múltiplos exatos de ${mult}
SELECT
  t.id_conta_origem       AS conta_origem,
  COUNT(*)                AS qtd_redondas,
  ROUND(SUM(t.valor), 2)  AS valor_total
FROM transacoes_pix AS t
WHERE t.valor >= ${min}                              -- materialidade
  AND t.valor = CAST(t.valor AS INTEGER)            -- sem centavos
  AND CAST(t.valor AS INTEGER) % ${mult} = 0        -- múltiplo exato
GROUP BY t.id_conta_origem
ORDER BY valor_total DESC, conta_origem;`,
      criteriosValidacao: {
        colunasEsperadas: ['conta_origem', 'qtd_redondas', 'valor_total'],
        descricaoSucesso: 'Você destacou remetentes de valores redondos e vultosos; agora compare-os com o perfil econômico declarado.',
      },
    }),
  }),
  defineTemplate({
    focus: 'fracionamento',
    variants: [
      { piso: 9500, minQtd: 3 },
      { piso: 9000, minQtd: 1 },
    ],
    build: ({ piso, minQtd }) => ({
      titulo: `Recebedores de fracionamento (${piso / 100}%–99,99% do limiar, ≥ ${minQtd} op.)`,
      tipologiaBacen: 'Fracionamento para evitar limiar de comunicação',
      badgeEnquadramento: 'Carta Circular 4.001/2020 · Fracionamento',
      contexto:
        'Em vez de olhar os remetentes, a área de PLD quer saber quais contas RECEBEM operações logo abaixo do limiar de ' +
        'R$ 10.000,00. Uma recebedora com muitas operações nessa faixa, de remetentes distintos, é forte indício de smurfing.',
      objetivo:
        `Considere PIX com \`valor >= ${piso}\` e \`valor < 10000\`. Por conta recebedora, retorne \`conta_destino\`, ` +
        `\`qtd_operacoes\`, \`remetentes\` (distintos) e \`valor_total\`, mantendo as com pelo menos ${minQtd} operação(ões). ` +
        'Ordene por `valor_total DESC`.',
      dicaSql: `SELECT id_conta_destino AS conta_destino,
       COUNT(*) AS ..., COUNT(DISTINCT ...) AS ..., SUM(valor) AS ...
FROM transacoes_pix
WHERE valor >= ... AND valor < 10000
GROUP BY ...
HAVING ...;`,
      solutionQuery: `-- Fracionamento visto pelo lado do recebedor
SELECT
  t.id_conta_destino                 AS conta_destino,
  COUNT(*)                           AS qtd_operacoes,
  COUNT(DISTINCT t.id_conta_origem)  AS remetentes,       -- smurfing costuma usar vários remetentes
  ROUND(SUM(t.valor), 2)             AS valor_total
FROM transacoes_pix AS t
WHERE t.valor >= ${piso}                                     -- faixa logo abaixo...
  AND t.valor < 10000                                    -- ...do limiar de R$ 10 mil
GROUP BY t.id_conta_destino
HAVING COUNT(*) >= ${minQtd}
ORDER BY valor_total DESC, conta_destino;`,
      criteriosValidacao: {
        colunasEsperadas: ['conta_destino', 'qtd_operacoes', 'remetentes', 'valor_total'],
        descricaoSucesso: 'Você identificou quem concentra as operações fracionadas — o "ponto de chegada" do smurfing.',
      },
    }),
  }),
  defineTemplate({
    focus: 'alta_frequencia',
    variants: [{ min: 5 }, { min: 4 }],
    build: ({ min }) => ({
      titulo: `Rajadas por hora cheia (≥ ${min} PIX da mesma origem)`,
      tipologiaBacen: 'Alta frequência transacional',
      badgeEnquadramento: 'Carta Circular 4.001/2020 · Alta frequência',
      contexto:
        'Um parceiro reportou picos de liquidação concentrados em janelas de uma hora. A equipe quer um primeiro corte ' +
        'simples, por hora cheia, antes de aplicar análises finas com funções de janela.',
      objetivo:
        `Agrupe por conta de origem e hora cheia (\`strftime('%Y-%m-%d %H:00', data_hora)\`). Retorne \`conta_origem\`, ` +
        `\`janela_hora\`, \`qtd_pix\` e \`valor_total\` para janelas com pelo menos ${min} PIX, ordenando por \`qtd_pix DESC\`.`,
      dicaSql: `SELECT id_conta_origem AS conta_origem,
       strftime('%Y-%m-%d %H:00', data_hora) AS janela_hora,
       COUNT(*) AS ..., SUM(valor) AS ...
FROM transacoes_pix
GROUP BY ...
HAVING ...;`,
      solutionQuery: `-- Alta frequência: contagem por origem em janelas de hora cheia
SELECT
  t.id_conta_origem                          AS conta_origem,
  strftime('%Y-%m-%d %H:00', t.data_hora)    AS janela_hora,  -- trunca para a hora
  COUNT(*)                                   AS qtd_pix,
  ROUND(SUM(t.valor), 2)                     AS valor_total
FROM transacoes_pix AS t
GROUP BY conta_origem, janela_hora
HAVING COUNT(*) >= ${min}                                      -- limiar de frequência
ORDER BY qtd_pix DESC, valor_total DESC, conta_origem, janela_hora;`,
      criteriosValidacao: {
        colunasEsperadas: ['conta_origem', 'janela_hora', 'qtd_pix', 'valor_total'],
        descricaoSucesso: 'Você encontrou as janelas de rajada. O próximo passo seria medir os intervalos exatos com LAG().',
      },
    }),
  }),
  defineTemplate({
    focus: 'incompatibilidade',
    variants: [{ mult: 10 }, { mult: 5 }],
    build: ({ mult }) => ({
      titulo: `Recebimentos mensais ≥ ${mult}x a renda (PF)`,
      tipologiaBacen: 'Incompatibilidade com a capacidade financeira',
      badgeEnquadramento: 'Circular 3.978/2020 · Capacidade financeira (KYC)',
      contexto:
        'A revisão periódica de KYC precisa comparar o volume recebido no mês com a renda declarada pelas pessoas físicas. ' +
        'Volumes muito superiores à renda, sem justificativa, exigem atualização cadastral e análise de origem dos recursos.',
      objetivo:
        `Para contas PF com renda > 0, some os valores RECEBIDOS no período e retorne \`id_conta\`, \`titular\`, \`ocupacao\`, ` +
        `\`renda_mensal\`, \`total_recebido_mes\` e \`multiplo_renda\` (1 casa) quando o total for \`>= ${mult}x\` a renda. ` +
        'Ordene por `multiplo_renda DESC`.',
      dicaSql: `SELECT c.id_conta, ..., SUM(t.valor) AS total_recebido_mes
FROM transacoes_pix t
JOIN contas c ON c.id_conta = t.id_conta_destino
WHERE c.tipo_pessoa = 'PF' AND ...
GROUP BY ...
HAVING SUM(t.valor) >= ...;`,
      solutionQuery: `-- Incompatibilidade: volume recebido no mês x renda mensal declarada
SELECT
  c.id_conta,
  c.titular,
  c.ocupacao,
  c.renda_mensal_declarada                               AS renda_mensal,
  ROUND(SUM(t.valor), 2)                                 AS total_recebido_mes,
  ROUND(SUM(t.valor) / c.renda_mensal_declarada, 1)      AS multiplo_renda   -- quantas rendas recebeu
FROM transacoes_pix AS t
JOIN contas AS c ON c.id_conta = t.id_conta_destino       -- olhamos o RECEBEDOR
WHERE c.tipo_pessoa = 'PF'
  AND c.renda_mensal_declarada > 0                        -- evita divisão por zero
GROUP BY c.id_conta
HAVING SUM(t.valor) >= ${mult} * c.renda_mensal_declarada
ORDER BY multiplo_renda DESC, c.id_conta;`,
      criteriosValidacao: {
        colunasEsperadas: ['id_conta', 'titular', 'ocupacao', 'renda_mensal', 'total_recebido_mes', 'multiplo_renda'],
        descricaoSucesso: 'Você encontrou pessoas físicas recebendo muitas vezes a própria renda — candidatas a revisão de KYC e comunicação.',
      },
    }),
  }),
  defineTemplate({
    focus: 'incompatibilidade',
    variants: [{ p: 2 }, { p: 5 }],
    build: ({ p }) => ({
      titulo: `Maior PIX de cada PJ ≥ ${p}x o faturamento (ROW_NUMBER)`,
      tipologiaBacen: 'Incompatibilidade com faturamento declarado (PJ)',
      badgeEnquadramento: 'Circular 3.978/2020 · Capacidade financeira (PJ)',
      contexto:
        'Empresas com faturamento modesto realizaram transferências únicas muito superiores ao que declaram faturar por mês. ' +
        'A análise deve isolar o MAIOR envio de cada PJ e compará-lo com o faturamento.',
      objetivo:
        'Usando `ROW_NUMBER() OVER (PARTITION BY id_conta_origem ORDER BY valor DESC)`, pegue o maior PIX enviado por cada ' +
        `PJ e retorne \`conta_origem\`, \`titular\`, \`faturamento_mensal\`, \`maior_pix\` e \`proporcao\` (2 casas) quando ` +
        `\`maior_pix >= ${p}x\` o faturamento. Ordene por \`proporcao DESC\`.`,
      dicaSql: `WITH ranking AS (
  SELECT t.*,
         ROW_NUMBER() OVER (PARTITION BY ... ORDER BY ...) AS rn
  FROM transacoes_pix t
)
SELECT ...
FROM ranking r
JOIN contas c ON ...
WHERE r.rn = 1 AND ...;`,
      solutionQuery: `-- Top-1 por PJ com ROW_NUMBER e comparação com o faturamento
WITH ranking AS (
  SELECT
    t.*,
    ROW_NUMBER() OVER (
      PARTITION BY t.id_conta_origem            -- um ranking por empresa
      ORDER BY t.valor DESC, t.id_transacao     -- maior valor primeiro (com desempate)
    ) AS rn
  FROM transacoes_pix AS t
)
SELECT
  r.id_conta_origem                              AS conta_origem,
  c.titular,
  c.renda_mensal_declarada                       AS faturamento_mensal,
  r.valor                                        AS maior_pix,
  ROUND(r.valor / c.renda_mensal_declarada, 2)   AS proporcao
FROM ranking AS r
JOIN contas AS c ON c.id_conta = r.id_conta_origem
WHERE r.rn = 1                                   -- apenas o maior PIX de cada conta
  AND c.tipo_pessoa = 'PJ'
  AND r.valor >= ${p} * c.renda_mensal_declarada
ORDER BY proporcao DESC, conta_origem;`,
      criteriosValidacao: {
        colunasEsperadas: ['conta_origem', 'titular', 'faturamento_mensal', 'maior_pix', 'proporcao'],
        descricaoSucesso: 'Você usou ROW_NUMBER para isolar o maior envio de cada PJ e revelou empresas movimentando muito além do faturamento.',
      },
    }),
  }),
];

function shuffle<T>(items: readonly T[]): T[] {
  const copy = [...items];
  for (let i = copy.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [copy[i], copy[j]] = [copy[j] as T, copy[i] as T];
  }
  return copy;
}

/** Gera um desafio por templates parametrizados, verificando cada candidato contra o banco. */
export function generateOfflineChallenge(db: Database, request: GenerationRequest): GeneratedChallenge {
  const pool = request.focus === 'livre' ? OFFLINE_TEMPLATES : OFFLINE_TEMPLATES.filter((t) => t.focus === request.focus);
  const avoid = new Set(request.avoidTitles);
  const candidates = shuffle(pool).flatMap((t) => shuffle(t.candidates()));
  const ordered = [...candidates.filter((c) => !avoid.has(c.titulo)), ...candidates.filter((c) => avoid.has(c.titulo))];

  for (const candidate of ordered) {
    const verification = verifyChallenge(db, { ...candidate, id: `offline-${Date.now().toString(36)}` }, request.difficulty);
    if (verification.ok) return verification.challenge;
  }
  throw new Error('Nenhum template offline produziu um desafio válido para este dataset.');
}
