import type { Database } from 'sql.js';
import { SCHEMA_SQL } from '../database/schema.ts';
import { DIFFICULTY_LABELS, FOCUS_LABELS, type GenerationRequest } from './types.ts';
import { MAX_SOLUTION_ROWS } from './challengeVerifier.ts';

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
- Perfil de renda (tipo_pessoa | qtd | renda mín | renda máx):
  ${rows(db, 'SELECT tipo_pessoa, COUNT(*), MIN(renda_mensal_declarada), MAX(renda_mensal_declarada) FROM contas GROUP BY 1')}
- Exemplo de linha de transacoes_pix:
  ${rows(db, 'SELECT * FROM transacoes_pix ORDER BY rowid LIMIT 1')}`.trim();
}

export function buildSystemPrompt(db: Database): string {
  return `Você é um Agente Educador especialista em PLD/FT (Prevenção à Lavagem de Dinheiro) e SQL analítico.
Sua tarefa é criar UM desafio investigativo inédito para estudantes, baseado EXCLUSIVAMENTE no banco SQLite abaixo.

## Schema (DDL exato, SQLite)
${SCHEMA_SQL.trim()}

## Perfil do dataset em memória
${buildDatasetProfile(db)}

## Diretrizes regulatórias (Bacen)
${REGULATORY_GUIDELINES}

## Regras obrigatórias para "solutionQuery"
1. Dialeto ESTRITAMENTE SQLite, executável contra o schema acima, usando somente as colunas reais
   (ex.: id_conta_origem, id_conta_destino, renda_mensal_declarada, data_hora, valor, canal).
2. Funções permitidas: agregações, CASE, ROUND, ABS, COALESCE, strftime, unixepoch, julianday, date, time,
   window functions (LAG, LEAD, ROW_NUMBER, RANK, SUM/COUNT OVER), CTEs (WITH). Proibido: ILIKE, DATE_TRUNC, EXTRACT,
   INTERVAL, NOW(), funções de outros SGBDs e qualquer comando de escrita (INSERT, UPDATE, DELETE, DDL, PRAGMA).
3. data_hora é TEXT 'YYYY-MM-DD HH:MM:SS'; para diferenças de tempo use unixepoch(data_hora) ou strftime('%s', data_hora).
4. Deve retornar entre 1 e ${MAX_SOLUTION_ROWS} linhas NESTE dataset e terminar com ORDER BY externo determinístico (com desempate).
5. Use aliases descritivos em snake_case; "colunasEsperadas" deve listar exatamente as colunas do SELECT final, na mesma ordem.
6. Inclua comentários "--" didáticos explicando cada etapa da query (eles serão exibidos como gabarito comentado).

## Regras de conteúdo
- Português do Brasil, tom profissional de área de compliance.
- "contexto": dossiê/denúncia fictícia (2 a 4 frases), coerente com o dataset.
- "objetivo": o que a query deve retornar, citando colunas esperadas e a ordenação. Use crases para nomes de colunas.
- "dicaSql": um esqueleto parcial da técnica, SEM entregar a resposta completa.
- "badgeEnquadramento": cite a norma (ex.: "Carta Circular 4.001/2020 · Conta de passagem"). Não invente números de
  artigos ou incisos dos quais não tenha certeza.
- "criteriosValidacao.descricaoSucesso": mensagem de parabéns explicando o que o resultado revela.

Responda SOMENTE com um objeto JSON com as chaves: id, titulo, tipologiaBacen, badgeEnquadramento, contexto, objetivo,
dicaSql, solutionQuery, criteriosValidacao { colunasEsperadas: string[], descricaoSucesso }.`;
}

export function buildUserPrompt({ focus, difficulty, avoidTitles }: GenerationRequest): string {
  const avoid = avoidTitles.length ? `\nNão repita estes desafios já existentes: ${avoidTitles.map((t) => `"${t}"`).join(', ')}.` : '';
  const technique =
    difficulty === 'iniciante'
      ? 'filtros, JOIN e GROUP BY/HAVING'
      : difficulty === 'intermediario'
        ? 'CTEs, agregações condicionais e razões/proporções'
        : 'window functions (LAG/LEAD/ROW_NUMBER/SUM OVER), múltiplas CTEs e janelas temporais';
  return `Gere um novo desafio.
- Foco da tipologia: ${FOCUS_LABELS[focus]}.
- Dificuldade: ${DIFFICULTY_LABELS[difficulty]} (técnicas esperadas: ${technique}).${avoid}`;
}
