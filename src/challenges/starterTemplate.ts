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

function missionLine(objetivo: string): string {
  const text = plain(objetivo);
  const stop = text.search(/[.!?]/);
  const sentence = (stop >= 0 ? text.slice(0, stop + 1) : text).trim();
  return sentence;
}

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
  const skeleton = LEVEL5_SKELETON[scenario.id];
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
