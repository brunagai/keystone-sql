import { TRAIL_LEVELS, type InvestigationScenario } from './scenarios.ts';

const LINE_WIDTH = 78;

const ORIGIN_TAG: Record<InvestigationScenario['origem'], string> = {
  base: 'Desafio base',
  ia: 'Desafio gerado por IA',
  offline: 'Desafio gerado offline',
};

const plain = (text: string): string => text.replace(/`/g, '').replace(/\s+/g, ' ').trim();

function wrapComment(text: string, prefix: string): string[] {
  const continuation = `--${' '.repeat(prefix.length - 2)}`;
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

/** Cabeçalho comentado com o enunciado do desafio, pronto para a aluna escrever a consulta abaixo. */
export function buildStarterTemplate(scenario: InvestigationScenario): string {
  const origin = scenario.modelo ? `${ORIGIN_TAG[scenario.origem]} · ${scenario.modelo}` : ORIGIN_TAG[scenario.origem];
  const level = TRAIL_LEVELS[scenario.nivel];
  return [
    `-- Nível ${scenario.nivel} — ${level.titulo} (${level.tecnica})`,
    `-- ${origin}: ${plain(scenario.titulo)}`,
    ...wrapComment(scenario.enquadramento, '-- Enquadramento: '),
    '--',
    '-- Objetivo:',
    ...wrapComment(scenario.objetivo, '--   '),
    '--',
    ...wrapComment(scenario.colunasEsperadas.join(', '), '-- Colunas esperadas: '),
    ...wrapComment(`ORDER BY ${scenario.ordenacao}`, '-- Ordenação: '),
    '-- Selecione o miolo do WITH e use Testar CTE (Ctrl+Enter).',
    '-- "Validar Desafio" compara o resultado com o gabarito.',
    '--',
    '-- 1. De onde vêm os dados?',
    '-- 2. Qual conta ou período vamos filtrar no WHERE?',
    '-- 3. Que métricas e colunas queremos exibir?',
    '',
    'SELECT ',
  ].join('\n');
}
