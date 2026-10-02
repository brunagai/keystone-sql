import { maskSql } from '../database/sqlText.ts';
import type { ChallengeDifficulty } from './types.ts';

export interface DifficultyToolkit {
  /** Uma linha para o seletor / user prompt. */
  resumo: string;
  obrigatorio: string;
  proibido: string;
}

export const DIFFICULTY_TOOLKIT: Record<ChallengeDifficulty, DifficultyToolkit> = {
  iniciante: {
    resumo: 'GROUP BY, HAVING e filtros lógicos (sem window functions)',
    obrigatorio:
      'Use apenas filtros (`WHERE`), `JOIN` quando necessário, `GROUP BY` e `HAVING`. O corte regulatório deve estar no `HAVING` ou no `WHERE` (limiares, `BETWEEN`, `AND`/`OR`).',
    proibido:
      'PROIBIDO: `OVER`, `LAG`, `LEAD`, `ROW_NUMBER`, `RANK`, `DENSE_RANK`, `NTILE` e qualquer window function. Não use CTE só para “parecer avançado”: se usar `WITH`, o corpo deve continuar sendo agregação clássica, sem janelas.',
  },
  intermediario: {
    resumo: 'ROW_NUMBER() ou RANK() para ordenação e corte posicional',
    obrigatorio:
      'Obrigatório: `ROW_NUMBER()` ou `RANK()` com `OVER (PARTITION BY … ORDER BY …)` para ranquear e um corte posicional (`WHERE posicao = 1`, `<= N`, etc.). Prefira um `WITH` para carimbar a posição linha a linha e filtrar fora.',
    proibido:
      'Não resolva só com `GROUP BY`/`HAVING` se o corte for posicional (maior PIX, top-N, primeiro/último do grupo). `LAG`/`LEAD` ficam para o nível Avançado.',
  },
  avancado: {
    resumo: 'WITH (CTE) + LAG/LEAD ou múltiplas janelas de partição',
    obrigatorio:
      'Obrigatório: estrutura `WITH` (uma ou mais CTEs) combinada com `LAG()`/`LEAD()` **ou** pelo menos duas janelas (`OVER`) em partições distintas. Calcule métricas de linha do tempo/histórico no envelope e corte no `SELECT` externo.',
    proibido: 'Não entregue um `SELECT` plano sem CTE. Não use só `GROUP BY`/`HAVING` como solução principal.',
  },
};

const WINDOW_FN = /\b(LAG|LEAD|ROW_NUMBER|RANK|DENSE_RANK|NTILE)\s*\(/i;
const OVER = /\bOVER\s*\(/i;
const ROW_OR_RANK = /\b(ROW_NUMBER|RANK)\s*\(/i;
const LAG_OR_LEAD = /\b(LAG|LEAD)\s*\(/i;
const WITH_HEAD = /^\s*WITH\b/i;
const GROUP_BY = /\bGROUP\s+BY\b/i;
const HAVING = /\bHAVING\b/i;
const ENVELOPE_MARK = /bloco\s+envelope/i;
const INSPECTOR_MARK = /bloco\s+inspetor/i;

const countMatches = (text: string, pattern: RegExp): number => {
  const flags = pattern.flags.includes('g') ? pattern.flags : `${pattern.flags}g`;
  return [...text.matchAll(new RegExp(pattern.source, flags))].length;
};

/** Confere se o gabarito respeita a amarração de ferramentas do nível. `null` = ok. */
export function checkDifficultyToolkit(sql: string, difficulty: ChallengeDifficulty): string | null {
  const code = maskSql(sql);
  const comments = sql;

  if (!ENVELOPE_MARK.test(comments) || !INSPECTOR_MARK.test(comments)) {
    return (
      'A solutionQuery deve estruturar o raciocínio em dois blocos comentados: ' +
      '"-- === Bloco Envelope (criação da métrica / linha do tempo) ===" e ' +
      '"-- === Bloco Inspetor de Risco (corte e enriquecimento) ===".'
    );
  }

  if (difficulty === 'iniciante') {
    if (WINDOW_FN.test(code) || OVER.test(code)) {
      return 'Nível Iniciante: remova window functions (`OVER`, `LAG`, `LEAD`, `ROW_NUMBER`, `RANK`). Use GROUP BY/HAVING e filtros.';
    }
    if (!GROUP_BY.test(code) || !HAVING.test(code)) {
      return 'Nível Iniciante: a solutionQuery deve ter GROUP BY e HAVING (agregação + corte por limiar).';
    }
    return null;
  }

  if (difficulty === 'intermediario') {
    if (LAG_OR_LEAD.test(code)) {
      return 'Nível Intermediário: não use LAG/LEAD (reserve para Avançado). Use ROW_NUMBER() ou RANK() com corte posicional.';
    }
    if (!ROW_OR_RANK.test(code) || !OVER.test(code)) {
      return 'Nível Intermediário: é obrigatório ROW_NUMBER() ou RANK() com OVER (PARTITION BY … ORDER BY …) e um corte posicional no Inspetor.';
    }
    return null;
  }

  if (!WITH_HEAD.test(code)) {
    return 'Nível Avançado: a solutionQuery deve começar com WITH (CTE) — o Bloco Envelope vive na CTE.';
  }
  const overCount = countMatches(code, OVER);
  if (!LAG_OR_LEAD.test(code) && overCount < 2) {
    return 'Nível Avançado: combine a CTE com LAG()/LEAD() ou com pelo menos duas janelas OVER (partições/métricas distintas).';
  }
  return null;
}

export function formatToolkitForPrompt(difficulty: ChallengeDifficulty): string {
  const kit = DIFFICULTY_TOOLKIT[difficulty];
  return `AMARRAÇÃO OBRIGATÓRIA deste pedido (${difficulty}):
- Ferramentas: ${kit.resumo}
- ${kit.obrigatorio}
- ${kit.proibido}`;
}
