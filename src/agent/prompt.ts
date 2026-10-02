import type { Database } from 'sql.js';
import { SCHEMA_SQL } from '../database/schema.ts';
import { MAX_SOLUTION_ROWS } from './challengeVerifier.ts';
import {
  COMPILER_SKELETON,
  DIFFICULTY_TOOLKIT,
  formatToolkitForPrompt,
} from './difficultyToolkit.ts';
import { DIFFICULTY_LABELS, FOCUS_LABELS, type ChallengeDifficulty, type GenerationRequest } from './types.ts';

const REGULATORY_GUIDELINES = `
- Circular Bacen 3.978/2020: política de PLD/FT com abordagem baseada em risco; conhecimento do cliente (KYC),
  incluindo capacidade financeira (renda/faturamento); monitoramento, seleção e análise de operações e situações
  suspeitas; comunicação ao COAF das operações suspeitas após análise fundamentada.
- Carta Circular Bacen 4.001/2020: relação exemplificativa de operações/situações que podem configurar indícios de
  lavagem de dinheiro, por exemplo: fracionamento para evitar limiares de comunicação/controle; movimentação
  incompatível com patrimônio, renda ou capacidade financeira declarada; recebimentos de muitas origens ou envios
  para muitos destinos sem fundamento econômico (fan-in/fan-out); contas de passagem (recursos que entram e saem
  rapidamente); movimentação atípica em frequência, horário ou canal; uso de contas recém-abertas.`.trim();

function scalarRow(db: Database, sql: string): unknown[] {
  return db.exec(sql)[0]?.values[0] ?? [];
}

function rows(db: Database, sql: string): string {
  return (db.exec(sql)[0]?.values ?? []).map((r) => r.join(' | ')).join('\n  ');
}

/** Perfil estatístico do dataset, para que a LLM escolha limiares que retornem linhas reais. */
export function buildDatasetProfile(db: Database): string {
  const [inicio, fim, total, minV, maxV, avgV] = scalarRow(
    db,
    'SELECT MIN(data_hora), MAX(data_hora), COUNT(*), ROUND(MIN(valor),2), ROUND(MAX(valor),2), ROUND(AVG(valor),2) FROM transacoes_pix',
  );
  const [aberturaMin, aberturaMax, nContas] = scalarRow(db, 'SELECT MIN(data_abertura), MAX(data_abertura), COUNT(*) FROM contas');

  return `
- transacoes_pix: ${String(total)} linhas, de ${String(inicio)} a ${String(fim)} (horário de Brasília).
  valor: mín R$ ${String(minV)}, máx R$ ${String(maxV)}, média R$ ${String(avgV)}.
- Faixas de valor (faixa | qtd):
  ${rows(
    db,
    `SELECT CASE WHEN valor < 100 THEN '< 100' WHEN valor < 1000 THEN '100-999' WHEN valor < 10000 THEN '1.000-9.999'
            ELSE '>= 10.000' END AS faixa, COUNT(*) FROM transacoes_pix GROUP BY faixa ORDER BY MIN(valor)`,
  )}
- canal (canal | qtd):
  ${rows(db, 'SELECT canal, COUNT(*) FROM transacoes_pix GROUP BY canal ORDER BY 2 DESC')}
- contas: ${String(nContas)} linhas; data_abertura de ${String(aberturaMin)} a ${String(aberturaMax)}. IDs no formato 'C001'.
- PEP (eh_pep | qtd | cargos):
  ${rows(db, `SELECT eh_pep, COUNT(*), COALESCE(GROUP_CONCAT(DISTINCT cargo_pep), '—') FROM contas GROUP BY eh_pep ORDER BY 1`)}
- Perfil de renda (tipo_pessoa | qtd | renda mín | renda máx):
  ${rows(db, 'SELECT tipo_pessoa, COUNT(*), MIN(renda_mensal_declarada), MAX(renda_mensal_declarada) FROM contas GROUP BY 1')}
- Exemplo de linha de transacoes_pix:
  ${rows(db, 'SELECT * FROM transacoes_pix ORDER BY rowid LIMIT 1')}`.trim();
}

const COLUMN_CONTEXT = `Colunas reais (não invente nomes): contas.id_conta, titular, tipo_pessoa, documento, ocupacao,
renda_mensal_declarada, banco_ispb, banco_nome, agencia, numero_conta, tipo_chave_pix, chave_pix, cidade, uf, data_abertura,
eh_pep (0/1), cargo_pep; transacoes_pix.id_transacao, id_conta_origem, id_conta_destino, valor, data_hora, tipo_chave_destino,
chave_pix_destino, descricao, canal.`;

function compilerSection(difficulty: ChallengeDifficulty): string {
  if (difficulty === 'iniciante') {
    return `## Gabarito (Iniciante) — agregação relacional
solutionQuery é um SELECT (sem WITH e sem OVER). Comentários "--" explicam WHERE, GROUP BY e HAVING.
O corte regulatório vive no HAVING (e/ou WHERE). Termine com ORDER BY determinístico (com desempate).`;
  }
  return `## Gabarito na ordem do compilador (Intermediário / Avançado) — OBRIGATÓRIO
solutionQuery e os comentários "--" devem evidenciar a separação entre carimbo métrico e filtro de corte,
nesta estrutura (nomes de CTE/colunas podem variar; os marcadores FASE 1 / FASE 2 não):

\`\`\`sql
${COMPILER_SKELETON}
\`\`\`

- FASE 1 (Envelope): gera e carimba a métrica linha a linha. Não filtre o critério BACEN aqui.
- FASE 2 (Inspetor): projeta evidências, aplica o WHERE de corte sobre o dado já carimbado, ORDER BY.
- dicaSql deve esboçar as duas fases, sem entregar o gabarito completo.`;
}

/**
 * System prompt do Agente Educador. `difficulty` é injetado com prioridade máxima:
 * o modelo só pode usar as ferramentas daquele nível.
 */
export function buildSystemPrompt(db: Database, difficulty: ChallengeDifficulty): string {
  const kit = DIFFICULTY_TOOLKIT[difficulty];
  const others = (Object.keys(DIFFICULTY_TOOLKIT) as ChallengeDifficulty[])
    .filter((level) => level !== difficulty)
    .map((level) => `- ${DIFFICULTY_LABELS[level]} (NÃO usar neste pedido): ${DIFFICULTY_TOOLKIT[level].resumo}`)
    .join('\n');

  return `Você é um Agente Educador especialista em PLD/FT (Prevenção à Lavagem de Dinheiro) e SQL analítico.
Sua tarefa é criar UM desafio investigativo inédito para estudantes, baseado EXCLUSIVAMENTE no banco SQLite abaixo.

## PRIORIDADE MÁXIMA — nível deste pedido: ${DIFFICULTY_LABELS[difficulty]} (${difficulty})
${formatToolkitForPrompt(difficulty)}
Não misture níveis, não “enfeite” com técnicas do nível acima e não simplifique o de baixo.
Outros níveis (apenas para você NÃO usar agora):
${others}

## Schema (DDL exato, SQLite)
${SCHEMA_SQL.trim()}

${COLUMN_CONTEXT}

## Perfil do dataset em memória
${buildDatasetProfile(db)}

## Diretrizes regulatórias (Bacen)
${REGULATORY_GUIDELINES}

${compilerSection(difficulty)}

## Regras obrigatórias para "solutionQuery"
1. Dialeto ESTRITAMENTE SQLite, executável contra o schema acima, usando somente as colunas reais listadas.
2. Funções de data/hora: data_hora é TEXT 'YYYY-MM-DD HH:MM:SS'; use strftime('%H', data_hora), strftime('%s', data_hora)
   ou unixepoch(data_hora). Proibido: ILIKE, DATE_TRUNC, EXTRACT, INTERVAL, NOW() e funções de outros SGBDs.
3. Proibido qualquer comando de escrita (INSERT, UPDATE, DELETE, DDL, PRAGMA).
4. Deve retornar entre 1 e ${MAX_SOLUTION_ROWS} linhas NESTE dataset e terminar com ORDER BY externo determinístico (com desempate).
5. Aliases descritivos em snake_case; "colunasEsperadas" lista exatamente as colunas do SELECT final, na mesma ordem.
6. Comentários "--" concisos no próprio SQL evidenciam cada etapa (gabarito comentado).

## Regras de conteúdo
- Português do Brasil, tom profissional de área de compliance.
- "contexto": dossiê/denúncia fictícia (2 a 4 frases), coerente com o dataset.
- "objetivo": o que a query deve retornar, citando colunas esperadas, a ordenação e a técnica do nível (${kit.resumo}).
- "dicaSql": esqueleto parcial da técnica, SEM entregar a resposta completa.
- "badgeEnquadramento": cite a norma (ex.: "Carta Circular 4.001/2020 · Conta de passagem"). Não invente números de
  artigos ou incisos dos quais não tenha certeza.
- "criteriosValidacao.descricaoSucesso": mensagem de parabéns explicando o que o resultado revela.

Responda SOMENTE com um objeto JSON com as chaves: id, titulo, tipologiaBacen, badgeEnquadramento, contexto, objetivo,
dicaSql, solutionQuery, criteriosValidacao { colunasEsperadas: string[], descricaoSucesso }.`;
}

export function buildUserPrompt({ focus, difficulty, avoidTitles }: GenerationRequest): string {
  const avoid = avoidTitles.length ? `\nNão repita estes desafios já existentes: ${avoidTitles.map((t) => `"${t}"`).join(', ')}.` : '';
  return `Gere um novo desafio.
- Foco da tipologia: ${FOCUS_LABELS[focus]}.
- Dificuldade: ${DIFFICULTY_LABELS[difficulty]} (${difficulty}).
${formatToolkitForPrompt(difficulty)}${avoid}`;
}
