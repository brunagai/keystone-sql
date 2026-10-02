import { maskSql } from '../database/sqlText.ts';
import type { ChallengeDifficulty } from './types.ts';

export interface DifficultyToolkit {
  resumo: string;
  obrigatorio: string;
  proibido: string;
  foco: string;
}

export const ENVELOPE_HEADING = '-- FASE 1: O ENVELOPE ANALÍTICO (Criação da linha do tempo e carimbo de métricas linha a linha)';
export const INSPECTOR_HEADING = '-- FASE 2: O INSPETOR DE RISCO (Corte regulatório e enriquecimento sobre os dados já carimbados)';

/** Esqueleto didático injetado no system prompt (Intermediário e Avançado). */
export const COMPILER_SKELETON = `${ENVELOPE_HEADING}
WITH envelope_metricas AS (
  SELECT
    id_transacao,
    id_conta_origem,
    valor,
    data_hora
    -- métrica analítica (ROW_NUMBER/RANK no Intermediário; LAG/LEAD no Avançado)
  FROM transacoes_pix
)
${INSPECTOR_HEADING}
SELECT
  -- colunas de evidência
FROM envelope_metricas
WHERE /* critério de corte regulatório BACEN */
ORDER BY /* ordenação determinística */;`;

export const DIFFICULTY_TOOLKIT: Record<ChallengeDifficulty, DifficultyToolkit> = {
  iniciante: {
    resumo: 'Agregação relacional: GROUP BY, HAVING e WHERE (sem janelas e sem CTE)',
    obrigatorio:
      'Obrigatório: `GROUP BY`, `HAVING`, agregações clássicas (`COUNT`, `SUM`, `AVG`, `MAX`, `MIN`) e filtros lógicos no `WHERE` (múltiplos limiares, `BETWEEN`, `IN`, `AND`/`OR`). `JOIN` com `contas` quando o critério envolver KYC (`renda_mensal_declarada`, `titular`).',
    proibido:
      'PROIBIDO de forma expressa: Window Functions (`OVER (...)`, `LAG`, `LEAD`, `ROW_NUMBER`, `RANK`, `DENSE_RANK`, `NTILE`) e CTEs (`WITH`). O foco é puramente agregação relacional (volumetria e fracionamento básico).',
    foco: 'Detecção de volumetria e fracionamento básico (várias operações logo abaixo de um limiar, concentração por remetente/destino).',
  },
  intermediario: {
    resumo: 'Classificação posicional: ROW_NUMBER() / RANK() / DENSE_RANK() no envelope WITH',
    obrigatorio:
      'Obrigatório: `WITH envelope_metricas AS (...)` carimbando `ROW_NUMBER() OVER (PARTITION BY … ORDER BY …)` ou `RANK()`/`DENSE_RANK() OVER (...)`, e corte posicional no Inspetor (`WHERE posicao = 1`, `<= N`).',
    proibido:
      'Não resolva só com `GROUP BY`/`HAVING` se o corte for posicional (maior PIX, top-N, primeiro/último do grupo). `LAG`/`LEAD` ficam para o Avançado.',
    foco: 'Desduplicação de alertas, maior evento por conta em um período, isolamento de transações de pico relativo.',
  },
  avancado: {
    resumo: 'CTE + LAG/LEAD (ou múltiplas janelas) e corte no WHERE externo',
    obrigatorio:
      'Obrigatório: `WITH envelope_metricas AS (...)` combinado com `LAG()` ou `LEAD()` (desfasamento temporal) **ou** janelas `OVER` em partições distintas. As métricas são carimbadas no Envelope; o corte regulatório vai no `WHERE` do SELECT externo.',
    proibido: 'Não entregue um `SELECT` plano sem CTE. Não use só `GROUP BY`/`HAVING` como solução principal. Não omita o filtro externo sobre o dado já carimbado.',
    foco: 'Mudança abrupta de comportamento, velocidade anómala (burst) ou intervalos entre transações consecutivas com corte BACEN no WHERE externo.',
  },
};

const WINDOW_FN = /\b(LAG|LEAD|ROW_NUMBER|RANK|DENSE_RANK|NTILE)\s*\(/i;
const OVER = /\bOVER\s*\(/i;
const ROW_OR_RANK = /\b(ROW_NUMBER|RANK|DENSE_RANK)\s*\(/i;
const LAG_OR_LEAD = /\b(LAG|LEAD)\s*\(/i;
const WITH_ANY = /\bWITH\b/i;
const GROUP_BY = /\bGROUP\s+BY\b/i;
const HAVING = /\bHAVING\b/i;
const ENVELOPE_MARK = /fase\s*1\s*:\s*o\s*envelope\s*anal[ií]tico|bloco\s+envelope/i;
const INSPECTOR_MARK = /fase\s*2\s*:\s*o\s*inspetor\s+de\s+risco|bloco\s+inspetor/i;

const countMatches = (text: string, pattern: RegExp): number => {
  const flags = pattern.flags.includes('g') ? pattern.flags : `${pattern.flags}g`;
  return [...text.matchAll(new RegExp(pattern.source, flags))].length;
};

const requireTwoPhaseComments = (sql: string): string | null => {
  const envAt = sql.search(ENVELOPE_MARK);
  const insAt = sql.search(INSPECTOR_MARK);
  if (envAt < 0 || insAt < 0 || envAt > insAt) {
    return (
      'A solutionQuery deve separar Envelope e Inspetor, nesta ordem, com os comentários: ' +
      `"${ENVELOPE_HEADING}" e depois "${INSPECTOR_HEADING}".`
    );
  }
  return null;
};

/** Confere se o gabarito respeita a amarração do nível. `null` = ok. */
export function checkDifficultyToolkit(sql: string, difficulty: ChallengeDifficulty): string | null {
  const code = maskSql(sql);

  if (difficulty === 'iniciante') {
    if (WINDOW_FN.test(code) || OVER.test(code)) {
      return 'Nível Iniciante: remova Window Functions (`OVER`, `LAG`, `LEAD`, `ROW_NUMBER`, `RANK`). Use só GROUP BY, HAVING, agregações e WHERE.';
    }
    if (WITH_ANY.test(code)) {
      return 'Nível Iniciante: remova a CTE (`WITH`). O desafio deve ser agregação relacional pura (GROUP BY / HAVING / WHERE).';
    }
    if (!GROUP_BY.test(code) || !HAVING.test(code)) {
      return 'Nível Iniciante: a solutionQuery deve ter GROUP BY e HAVING (agregação + corte por limiar).';
    }
    return null;
  }

  const phase = requireTwoPhaseComments(sql);
  if (phase) return phase;

  if (difficulty === 'intermediario') {
    if (LAG_OR_LEAD.test(code)) {
      return 'Nível Intermediário: não use LAG/LEAD (reserve para Avançado). Use ROW_NUMBER(), RANK() ou DENSE_RANK() com corte posicional.';
    }
    if (!WITH_ANY.test(code)) {
      return 'Nível Intermediário: a solutionQuery deve usar WITH (Envelope) para carimbar ROW_NUMBER/RANK e cortar no SELECT externo (Inspetor).';
    }
    if (!ROW_OR_RANK.test(code) || !OVER.test(code)) {
      return 'Nível Intermediário: é obrigatório ROW_NUMBER(), RANK() ou DENSE_RANK() com OVER (PARTITION BY … ORDER BY …) e um corte posicional no Inspetor.';
    }
    return null;
  }

  if (!WITH_ANY.test(code)) {
    return 'Nível Avançado: a solutionQuery deve ter WITH envelope_metricas AS (...) — o Envelope vive na CTE.';
  }
  const overCount = countMatches(code, OVER);
  if (!LAG_OR_LEAD.test(code) && overCount < 2) {
    return 'Nível Avançado: combine a CTE com LAG()/LEAD() (desfasamento temporal) ou com pelo menos duas janelas OVER (partições distintas).';
  }
  return null;
}

export function formatToolkitForPrompt(difficulty: ChallengeDifficulty): string {
  const kit = DIFFICULTY_TOOLKIT[difficulty];
  const structure =
    difficulty === 'iniciante'
      ? '- Não use WITH nem OVER. Comentários "--" explicam o WHERE/GROUP BY/HAVING, sem fingir um envelope de janela.'
      : `- Estruture solutionQuery na ordem do compilador, com estes marcadores (nesta ordem):\n  ${ENVELOPE_HEADING}\n  ${INSPECTOR_HEADING}`;
  return `PRIORIDADE MÁXIMA — amarração deste pedido (${difficulty}):
- Ferramentas: ${kit.resumo}
- ${kit.obrigatorio}
- ${kit.proibido}
- Foco analítico: ${kit.foco}
${structure}`;
}
