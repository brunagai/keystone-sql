import { TRAIL_LEVELS, type InvestigationScenario } from './scenarios.ts';

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

function firstSentence(text: string): string {
  for (let i = 0; i < text.length; i += 1) {
    const ch = text[i];
    if (ch !== '.' && ch !== '!' && ch !== '?') continue;
    const prev = text[i - 1];
    const next = text[i + 1];
    if (ch === '.' && prev !== undefined && next !== undefined && /\d/.test(prev) && /\d/.test(next)) continue;
    return text.slice(0, i + 1).trim();
  }
  return text;
}

function missionLine(objetivo: string): string {
  return firstSentence(plain(objetivo));
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

const LEVEL5_SKELETON: Readonly<Record<string, string>> = {
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
    ...wrapComment(missionLine(scenario.objetivo), '-- Objetivo: '),
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
