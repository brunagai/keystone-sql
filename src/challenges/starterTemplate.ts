import { TRAIL_LEVELS, ensureRelatorioColunas, type InvestigationScenario } from './scenarios.ts';

const LINE_WIDTH = 78;

const plain = (text: string): string => text.replace(/`/g, '').replace(/\s+/g, ' ').trim();

function wrapComment(text: string, prefix: string): string[] {
  const continuation = `--${' '.repeat(Math.max(prefix.length - 2, 1))}`;
  const lines: string[] = [];
  let lead = prefix;
  let current = lead;
  for (const word of plain(text).split(' ')) {
    if (current.length > lead.length && current.length + word.length + 1 > LINE_WIDTH) {
      lines.push(current);
      lead = continuation;
      current = lead;
    }
    current += current.length > lead.length ? ` ${word}` : word;
  }
  if (current.length > lead.length) lines.push(current);
  return lines;
}

const LEVEL0_SKELETON: Readonly<Record<string, string>> = {
  'cadastro-listagem': `SELECT
    -- 1. Quais dados cadastrais a ficha-mãe precisa mostrar?
    
FROM contas
-- Ainda não há recorte: a listagem cobre toda a base.
;`,
  'triagem-pep': `SELECT
    -- 1. Identificador, titular e ocupação
    
FROM contas
WHERE
    -- 2. Como o cadastro sinaliza Pessoa Exposta Politicamente?
    
;`,
  'pix-alto-valor': `SELECT
    -- 1. Identificador da liquidação, origem, destino, valor e data/hora
    
FROM transacoes_pix
WHERE
    -- 2. Qual o piso de valor da comunicação obrigatória?
    
-- 3. Priorize os maiores montantes:
-- ORDER BY ...
;`,
  'volumetria-remetente': `SELECT
    -- 1. Conta de origem (com alias), quantidade de remessas e volume acumulado
    
FROM transacoes_pix
-- 2. Consolide por pagador (sem corte de recorrência mínima):
-- GROUP BY ...
-- ORDER BY ...
;`,
  'baixa-renda-pf': `SELECT
    -- 1. Identificador da conta, titular, ocupação e renda declarada
    
FROM contas
WHERE
    -- 2. Pessoa física E renda estritamente abaixo do teto cadastral
    -- (as duas condições precisam valer ao mesmo tempo)
    
-- 3. Priorize as menores rendas:
-- ORDER BY ...
;`,
  'capilaridade-destinatarios': `SELECT
    -- 1. Conta de origem (com alias) e quantidade de favorecidos distintos
    
FROM transacoes_pix
-- 2. Consolide por pagador e conte destinos únicos (não o total de PIX):
-- GROUP BY ...
-- ORDER BY ...
;`,
};

const LEVEL1_SKELETON: Readonly<Record<string, string>> = {
  'alta-recorrencia': `SELECT
    -- 1. Conta de origem (com alias), quantidade de envios e volume acumulado
    
FROM transacoes_pix
GROUP BY
    -- 2. Consolide por pagador
    
-- 3. Mantenha só grupos com 10 ou mais remessas:
-- HAVING ...
-- ORDER BY ...
;`,
  'concentracao-creditos': `SELECT
    -- 1. Conta de destino (com alias), volume recebido e ticket médio
    
FROM transacoes_pix
GROUP BY
    -- 2. Consolide por favorecido
    
-- 3. Mantenha quem acumulou mais de R$ 100.000,00:
-- HAVING ...
-- ORDER BY ...
;`,
  'fracionamento-limiar': `SELECT
    -- 1. Conta de origem (com alias), quantidade e volume na faixa fracionada
    
FROM transacoes_pix
WHERE
    -- 2. Recorte o valor unitário (logo abaixo de R$ 10 mil) ANTES de agrupar
    
GROUP BY
    -- 3. Consolide por pagador
    
-- 4. Recorrência mínima de 3 envios (depois de agrupar):
-- HAVING ...
-- ORDER BY ...
;`,
  'matriz-criticidade': `SELECT
    -- 1. Conta de origem (com alias), quantidade de envios e volume acumulado
    
FROM transacoes_pix
GROUP BY
    -- 2. Consolide por pagador
    
-- 3. Os dois critérios do grupo precisam valer juntos:
-- HAVING ... AND ...
-- ORDER BY ...
;`,
};

const LEVEL2_SKELETON: Readonly<Record<string, string>> = {
  'enriquecimento-alto-valor': `SELECT
    -- 1. Identificador da liquidação, titular remetente, renda/faturamento, valor e data/hora
    
FROM transacoes_pix t
JOIN contas c
    ON
    -- 2. Cruze pela conta de ORIGEM
    
WHERE
    -- 3. Piso de valor unitário (R$ 30.000,00)
    
-- ORDER BY ...
;`,
  'quadro-societario-admin': `SELECT
    -- 1. Razão social, nome do administrador e percentual de participação
    
FROM contas c
JOIN socios_empresas s
    ON
    -- 2. Cruze o cadastro da empresa com o quadro de sócios
    
WHERE
    -- 3. Pessoa jurídica E sócio com poderes de administração
    
-- ORDER BY ...
;`,
  'contas-dormentes': `SELECT
    -- 1. Identificador, titular e tipo de pessoa
    
FROM contas c
LEFT JOIN transacoes_pix t
    ON
    -- 2. Tente localizar envios (origem) sem perder cadastros sem PIX
    
WHERE
    -- 3. Quem ficou sem correspondência como remetente?
    
-- ORDER BY ...
;`,
  'volumetria-pep': `SELECT
    -- 1. Titular PEP, ocupação, quantidade de envios e volume acumulado
    
FROM contas c
JOIN transacoes_pix t
    ON
    -- 2. Cruze o cadastro com as originações
    
WHERE
    -- 3. Somente quem o cadastro classifica como PEP
    
GROUP BY
    -- 4. Consolide por titular e ocupação
    
-- ORDER BY ...
;`,
  'fluxos-intrabanco': `SELECT
    -- 1. Identificador da operação, titular remetente, titular recebedor e valor
    
FROM transacoes_pix t
JOIN contas rem
    ON
    -- 2. Cadastro do REMETENTE (conta de origem)
    
JOIN contas des
    ON
    -- 3. Cadastro do FAVORECIDO (conta de destino)
    
-- ORDER BY ...
;`,
};

const LEVEL3_SKELETON: Readonly<Record<string, string>> = {
  'limiar-noturno': `SELECT
    -- 1. Identificador, origem, destino, valor e data/hora
    
FROM transacoes_pix
WHERE
    -- 2. Piso de R$ 1.000,00 E faixa noturna (20h em diante OU antes das 6h)
    
-- ORDER BY ...
;`,
  'liquidacoes-fim-de-semana': `SELECT
    -- 1. Identificador, razão social da empresa, valor e data/hora
    
FROM transacoes_pix t
JOIN contas c
    ON
    -- 2. Cruze pela conta de ORIGEM
    
WHERE
    -- 3. Pessoa jurídica, piso de R$ 15.000,00 e sábado ou domingo
    
-- ORDER BY ...
;`,
  'volume-desproporcional-renda': `SELECT
    -- 1. Identificador, titular, renda declarada e soma dos envios
    
FROM contas c
JOIN transacoes_pix t
    ON
    -- 2. Cruze o cadastro com as originações
    
WHERE
    -- 3. Somente pessoa física
    
GROUP BY
    -- 4. Repita as colunas cadastrais (não agregadas) da projeção
    
-- 5. Volume acumulado ≥ 3 vezes a renda declarada:
-- HAVING ...
-- ORDER BY ...
;`,
  'rajada-mesma-data': `SELECT
    -- 1. Conta de origem, dia civil, quantidade de envios e volume do dia
    
FROM transacoes_pix
GROUP BY
    -- 2. Pagador e dia (sem a hora)
    
-- 3. Pelo menos 4 envios no mesmo dia civil:
-- HAVING ...
-- ORDER BY ...
;`,
  'telemetria-ato-janela': `SELECT
    -- 1. Conta, cidade do acesso, status do dispositivo, valor e data/hora do PIX
    
FROM transacoes_pix t
JOIN acessos_digitais a
    ON
    -- 2. Mesma conta E diferença em segundos entre 0 e 900 (15 minutos)
    
WHERE
    -- 3. Acesso com status diferente de confiável
    
-- ORDER BY ...
;`,
};

const LEVEL4_SKELETON: Readonly<Record<string, string>> = {
  'sequenciamento-cronologico': `SELECT
    -- 1. Identificador, origem, data/hora, valor e numeração cronológica por conta
    
FROM transacoes_pix
-- 2. Numere os envios de cada origem no tempo (desempate pelo identificador):
-- ROW_NUMBER() OVER (PARTITION BY ... ORDER BY ...)
-- ORDER BY ...
;`,
  'ultima-movimentacao': `WITH operacoes_ranqueadas AS (
    SELECT
        -- 1. Campos da liquidação e ranking do mais recente para o mais antigo
        
    FROM transacoes_pix
)
SELECT
    -- 2. Projete só as colunas pedidas (sem o ranking)
    
FROM operacoes_ranqueadas
WHERE
    -- 3. Fique apenas com a posição 1 de cada conta
    
-- ORDER BY ...
;`,
  'intervalo-entre-disparos': `SELECT
    -- 1. Identificador, origem, data/hora atual, data/hora anterior e segundos entre elas
    
FROM transacoes_pix
-- 2. Horário anterior da mesma conta + diferença em segundos:
-- LAG(data_hora) OVER (...)
-- unixepoch(...) - unixepoch(LAG(...))
-- ORDER BY ...
;`,
  'montante-acumulado': `SELECT
    -- 1. Identificador, origem, data/hora, valor e soma até o instante corrente
    
FROM transacoes_pix
-- 2. Acúmulo cronológico incluindo o PIX atual:
-- SUM(valor) OVER (... ROWS BETWEEN UNBOUNDED PRECEDING AND CURRENT ROW)
-- ORDER BY ...
;`,
  'salto-variacao-consecutiva': `WITH historico_valores AS (
    SELECT
        -- 1. Valor atual e valor do envio imediatamente anterior da mesma conta
        
    FROM transacoes_pix
)
SELECT
    -- 2. Inclua a diferença (atual − anterior)
    
FROM historico_valores
WHERE
    -- 3. Descarte o primeiro envio de cada conta (sem antecessor)
    
-- ORDER BY ...
;`,
};

const LEVEL5_SKELETON: Readonly<Record<string, string>> = {
  'ubo-pep-credito': `SELECT
    -- 1. Identificador do crédito, razão social, sócio, participação e valor
    
FROM transacoes_pix t
JOIN contas c_emp
    ON
    -- 2. Cadastro da empresa FAVORECIDA
    
JOIN socios_empresas s
    ON
    -- 3. Quadro societário da receptora
    
JOIN contas c_pep
    ON
    -- 4. Cadastro pessoal do sócio (documento = CPF do QSA)
    
WHERE
    -- 5. PJ, piso de R$ 50 mil, participação ≥ 25% e classificação PEP
    
-- ORDER BY ...
;`,
  'conta-passagem-dwell': `SELECT
    -- 1. Conta de passagem, ids de entrada/saída, valores e segundos entre elas
    
FROM transacoes_pix t_in
JOIN transacoes_pix t_out
    ON
    -- 2. Destino da entrada = origem da saída; saída depois do crédito; no máximo 600 s
    
WHERE
    -- 3. Crédito de entrada ≥ R$ 20.000,00
    
-- ORDER BY ...
;`,
  'vetor-geografico-impossivel': `WITH sessoes_sequenciais AS (
    SELECT
        -- 1. Cidade e horário atuais + cidade e horário da sessão anterior da mesma conta
        
    FROM acessos_digitais
)
SELECT
    -- 2. Conta, cidade de origem, cidade de destino e intervalo em segundos
    
FROM sessoes_sequenciais
WHERE
    -- 3. Há sessão anterior, as cidades diferem e o intervalo é de até 1 hora
    
-- ORDER BY ...
;`,
  'triangulacao-societaria': `SELECT
    -- 1. Conta A, intermediária B, destino C e os dois valores da cadeia
    
FROM transacoes_pix t_ab
JOIN transacoes_pix t_bc
    ON
    -- 2. A→B depois B→C, com valor de B→C entre 90% e 110% de A→B
    
JOIN socios_empresas s_a
    ON
    -- 3. QSA da conta A
    
JOIN socios_empresas s_c
    ON
    -- 4. QSA da conta C
    
WHERE
    -- 5. Mesmo CPF nos dois quadros e A diferente de C
    
-- ORDER BY ...
;`,
  'dossie-coaf-pj': `WITH volumetria_empresas AS (
    SELECT
        -- 1. Origem, quantidade, soma e ticket médio (piso de volume no grupo)
        
    FROM transacoes_pix
    GROUP BY
        -- 2. Consolide por pagador
        
),
empresas_com_administrador AS (
    SELECT
        -- 3. Empresas com ao menos um administrador formal
        
    FROM socios_empresas
)
SELECT
    -- 4. Razão social, faturamento, montante, ticket e quantidade
    
FROM volumetria_empresas v
JOIN contas c
    ON
    -- 5. Cadastro da origem
    
JOIN empresas_com_administrador adm
    ON
    -- 6. QSA com administrador
    
WHERE
    -- 7. Somente pessoa jurídica
    
-- ORDER BY ...
;`,
  'ubo-aurora': `SELECT
    s.nome_socio,
    s.cpf_socio,
    s.percentual_participacao,
    s.cnpj_empresa
FROM socios_empresas AS s
JOIN contas AS c
    ON c.id_conta = s.id_conta_empresa
WHERE
    -- 2. Empresa do smurfing, piso de participação e administrador
    s.id_conta_empresa = '...'
    AND s.percentual_participacao >= ...
    AND s.eh_administrador = ...
ORDER BY s.percentual_participacao DESC, s.nome_socio;`,
  'ato-dispositivo': `SELECT
    a.id_conta,
    a.device_id,
    a.geolocalizacao_cidade,
    t.valor AS valor_transacao
FROM acessos_digitais AS a
JOIN contas AS c
    ON c.id_conta = a.id_conta
JOIN transacoes_pix AS t
    ON t.id_conta_origem = a.id_conta
WHERE
    -- 2. Login ok, cidade diferente do KYC, PIX alto e janela de minutos
    a.sucesso = 1
    AND a.geolocalizacao_cidade <> c.cidade
    AND t.valor >= ...
    AND unixepoch(t.data_hora) - unixepoch(a.data_hora) BETWEEN 0 AND ...
ORDER BY t.valor DESC, a.id_conta;`,
  'consorcio-especie': `SELECT
    id_conta,
    tipo_produto,
    valor_aporte,
    forma_liquidacao
FROM operacoes_produtos
WHERE
    -- 2. Lance de consórcio, espécie e bem já contemplado
    tipo_produto = '...'
    AND forma_liquidacao = '...'
    AND status_contemplacao = ...
ORDER BY valor_aporte DESC, id_conta;`,
};

function headerComments(scenario: InvestigationScenario): string[] {
  const columns = scenario.colunasEsperadas.join(', ');
  return [
    ...wrapComment(scenario.titulo, '-- Desafio: '),
    ...wrapComment(ensureRelatorioColunas(scenario.objetivo, scenario.colunasEsperadas), '-- Objetivo: '),
    ...wrapComment(columns, '-- Colunas esperadas na resposta: '),
    `-- Nível ${scenario.nivel} — ${TRAIL_LEVELS[scenario.nivel].titulo}`,
    '',
  ];
}

/** Primeira tabela real do gabarito (ignora o nome da CTE quando o FROM interno vem antes). */
export function principalTableOf(scenario: InvestigationScenario): string {
  const stripped = scenario.gabaritoSql.replace(/--[^\n]*/g, ' ');
  const match = /\bFROM\s+([A-Za-z_][\w]*)/i.exec(stripped);
  return match?.[1] ?? 'transacoes_pix';
}

/** Cabeçalho e esqueleto SQL guiado para o desafio ativo. */
export function buildStarterTemplate(scenario: InvestigationScenario): string {
  const skeleton =
    LEVEL0_SKELETON[scenario.id] ??
    LEVEL1_SKELETON[scenario.id] ??
    LEVEL2_SKELETON[scenario.id] ??
    LEVEL3_SKELETON[scenario.id] ??
    LEVEL4_SKELETON[scenario.id] ??
    LEVEL5_SKELETON[scenario.id];
  if (skeleton) return `${headerComments(scenario).join('\n')}${skeleton}`;

  const table = principalTableOf(scenario);
  return [
    ...headerComments(scenario),
    'SELECT',
    '    -- 1. Quais colunas e agregações foram pedidas?',
    '    ',
    `FROM ${table}`,
    'WHERE',
    '    -- 2. Quais filtros de conta, período ou valor devem ser aplicados?',
    '    ',
    '-- 3. Se necessário, agrupe ou ordene os dados:',
    '-- GROUP BY ...',
    '-- HAVING ...',
    `-- ORDER BY ${scenario.ordenacao};`,
  ].join('\n');
}
