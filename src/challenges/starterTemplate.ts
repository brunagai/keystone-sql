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
  const sentence = text.split(/(?<=[.!?])\s+/)[0] ?? text;
  return sentence;
}

/** Primeira tabela real do gabarito (ignora o nome da CTE quando o FROM interno vem antes). */
export function principalTableOf(scenario: InvestigationScenario): string {
  const stripped = scenario.gabaritoSql.replace(/--[^\n]*/g, ' ');
  const match = /\bFROM\s+([A-Za-z_][\w]*)/i.exec(stripped);
  return match?.[1] ?? 'transacoes_pix';
}

/** Cabeçalho e esqueleto SQL guiado para o desafio ativo. */
export function buildStarterTemplate(scenario: InvestigationScenario): string {
  const table = principalTableOf(scenario);
  const columns = scenario.colunasEsperadas.join(', ');
  return [
    ...wrapComment(scenario.titulo, '-- Desafio: '),
    ...wrapComment(missionLine(scenario.objetivo), '-- Objetivo: '),
    ...wrapComment(columns, '-- Colunas esperadas na resposta: '),
    `-- Nível ${scenario.nivel} — ${TRAIL_LEVELS[scenario.nivel].titulo}`,
    '',
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
