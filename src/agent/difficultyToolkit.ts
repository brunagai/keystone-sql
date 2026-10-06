import { maskSql } from '../database/sqlText.ts';
import type { ChallengeDifficulty, ChallengeTrailLevel, GeneratedChallenge } from './types.ts';

export interface DifficultyToolkit {
  resumo: string;
  obrigatorio: string;
  proibido: string;
  foco: string;
  idPrefixo: string;
}

export const ENVELOPE_HEADING = '-- FASE 1: O ENVELOPE ANALÍTICO (Criação da linha do tempo e carimbo de métricas linha a linha)';
export const INSPECTOR_HEADING = '-- FASE 2: O INSPETOR DE RISCO (Corte regulatório e enriquecimento sobre os dados já carimbados)';

/** Esqueleto didático injetado no system prompt (Avançado). */
export const COMPILER_SKELETON = `${ENVELOPE_HEADING}
WITH envelope_metricas AS (
  SELECT
    id_transacao,
    id_conta_origem,
    valor,
    data_hora
    -- métrica analítica (ROW_NUMBER / LAG)
  FROM transacoes_pix
)
${INSPECTOR_HEADING}
SELECT
  -- colunas de evidência
FROM envelope_metricas
WHERE /* critério de corte regulatório BACEN */
ORDER BY /* ordenação determinística */;`;

/** Faixa da trilha 0–5 amarrada à dificuldade do Agente. */
export const DIFFICULTY_TRAIL_LEVELS: Record<ChallengeDifficulty, readonly ChallengeTrailLevel[]> = {
  iniciante: [0, 1],
  intermediario: [2, 3],
  avancado: [4, 5],
};

export const DIFFICULTY_TOOLKIT: Record<ChallengeDifficulty, DifficultyToolkit> = {
  iniciante: {
    resumo: 'Nível 0 (SELECT, WHERE, ORDER BY, LIMIT) ou Nível 1 (COUNT, SUM, AVG, GROUP BY simples)',
    obrigatorio:
      'O desafio DEVE ser Nível 0 ou Nível 1. Nível 0: um SELECT sobre uma tabela, com WHERE, ORDER BY e opcionalmente LIMIT. ' +
      'Nível 1: agregação básica (`COUNT`/`SUM`/`AVG`) com `GROUP BY` simples (HAVING opcional). Campo "id" com prefixo "0." ou "1." (ex.: "0.pix-alto", "1.volumetria"). ' +
      'Campo "nivel" numérico 0 ou 1.',
    proibido:
      'PROIBIDO: JOINs múltiplos, subconsultas (`(SELECT …)`), CTEs (`WITH`), Window Functions (`OVER`, `LAG`, `LEAD`, `ROW_NUMBER`, `RANK`). No máximo um JOIN simples, e só se for indispensável ao KYC.',
    foco: 'Fundamentos: filtrar, ordenar, limitar ou agregar volumetria sem cruzamentos cadastrais complexos nem janelas temporais avançadas.',
    idPrefixo: '0. ou 1.',
  },
  intermediario: {
    resumo: 'Nível 2 (JOINs cadastrais) ou Nível 3 (anomalias temporais com data/hora)',
    obrigatorio:
      'O desafio DEVE ser Nível 2 ou Nível 3. Nível 2: `JOIN`/`LEFT JOIN` com `contas` (e/ou cadastro) para cruzar titular, renda, PEP ou tipo de pessoa. ' +
      'Nível 3: anomalias de data/hora com `strftime`, `unixepoch`, `date()` ou `julianday` (horário, dia, intervalo). Campo "id" com prefixo "2." ou "3.". Campo "nivel" 2 ou 3.',
    proibido:
      'PROIBIDO neste pedido: Window Functions (`OVER`, `ROW_NUMBER`, `LAG`, `LEAD`, `RANK`) — isso é Nível 4. CTEs complexas com várias etapas — isso é Nível 5. Não atribua nivel 4 ou 5.',
    foco: 'Cruzamento cadastral (KYC) ou recorte temporal (hora, dia, janela unixepoch) com SQL relacional clássico.',
    idPrefixo: '2. ou 3.',
  },
  avancado: {
    resumo: 'Nível 4 (Window Functions: ROW_NUMBER, LAG) ou Nível 5 (investigações com CTEs)',
    obrigatorio:
      'O desafio DEVE ser Nível 4 ou Nível 5. Nível 4: `ROW_NUMBER`/`LAG`/`LEAD`/`SUM() OVER (...)`. Nível 5: CTE (`WITH`) para investigação em várias etapas. ' +
      'Campo "id" com prefixo "4." ou "5.". Campo "nivel" 4 ou 5.',
    proibido:
      'Não entregue um SELECT plano só com WHERE/GROUP BY (isso é Iniciante) nem um JOIN cadastral sem janela/CTE (isso é Intermediário). Não use nivel 0, 1, 2 ou 3.',
    foco: 'Ranking posicional, desfasamento temporal (LAG) ou dossiê multi-etapa com CTE.',
    idPrefixo: '4. ou 5.',
  },
};

const WINDOW_FN = /\b(LAG|LEAD|ROW_NUMBER|RANK|DENSE_RANK|NTILE)\s*\(/i;
const OVER = /\bOVER\s*\(/i;
const WITH_ANY = /\bWITH\b/i;
const GROUP_BY = /\bGROUP\s+BY\b/i;
const AGG = /\b(COUNT|SUM|AVG|MIN|MAX)\s*\(/i;
const JOIN = /\b(?:INNER\s+|LEFT\s+(?:OUTER\s+)?|RIGHT\s+(?:OUTER\s+)?|CROSS\s+|FULL\s+(?:OUTER\s+)?)?JOIN\b/i;
const SUBQUERY = /\(\s*SELECT\b/i;
const TEMPORAL = /\b(strftime|unixepoch|julianday)\b/i;

const countJoins = (code: string): number => {
  const flags = JOIN.flags.includes('g') ? JOIN.flags : `${JOIN.flags}g`;
  return [...code.matchAll(new RegExp(JOIN.source, flags))].length;
};

export function parseIdTrailLevel(id: string): ChallengeTrailLevel | null {
  const match = /^([0-5])(?:[.\-_]|$)/.exec(id.trim());
  if (!match) return null;
  const n = Number(match[1]);
  return n === 0 || n === 1 || n === 2 || n === 3 || n === 4 || n === 5 ? n : null;
}

export function isChallengeTrailLevel(value: unknown): value is ChallengeTrailLevel {
  return value === 0 || value === 1 || value === 2 || value === 3 || value === 4 || value === 5;
}

/** Infere o degrau 0–5 a partir do SQL (sem ainda recortar pela dificuldade). */
export function inferTrailLevelFromSql(sql: string): ChallengeTrailLevel {
  const code = maskSql(sql);
  if (WITH_ANY.test(code)) return 5;
  if (WINDOW_FN.test(code) || OVER.test(code)) return 4;
  if (TEMPORAL.test(code)) return 3;
  if (JOIN.test(code)) return 2;
  if (GROUP_BY.test(code) || AGG.test(code)) return 1;
  return 0;
}

/**
 * Nível efetivo na faixa da dificuldade: usa `nivel`/prefixo do id se forem compatíveis;
 * senão infere pelo SQL; se ainda for incompatível, força o degrau mais próximo da faixa.
 */
export function resolveTrailLevel(challenge: GeneratedChallenge, difficulty: ChallengeDifficulty): ChallengeTrailLevel {
  const allowed = DIFFICULTY_TRAIL_LEVELS[difficulty];
  const declared = isChallengeTrailLevel(challenge.nivel) ? challenge.nivel : parseIdTrailLevel(challenge.id);
  if (declared !== null && allowed.includes(declared)) return declared;
  const inferred = inferTrailLevelFromSql(challenge.solutionQuery);
  if (allowed.includes(inferred)) return inferred;
  if (difficulty === 'iniciante') return inferred >= 1 ? 1 : 0;
  if (difficulty === 'intermediario') return inferred >= 3 ? 3 : 2;
  return inferred <= 4 ? 4 : 5;
}

export function sanitizeGeneratedChallenge(challenge: GeneratedChallenge, difficulty: ChallengeDifficulty): GeneratedChallenge {
  const nivel = resolveTrailLevel(challenge, difficulty);
  const rest = challenge.id.replace(/^[0-5][.\-_]?/, '').replace(/[^a-zA-Z0-9-]+/g, '-') || 'caso';
  return { ...challenge, nivel, id: `${nivel}.${rest}` };
}

/** Confere se o gabarito respeita a faixa da dificuldade. `null` = ok. */
export function checkDifficultyToolkit(sql: string, difficulty: ChallengeDifficulty): string | null {
  const code = maskSql(sql);
  const joins = countJoins(code);

  if (difficulty === 'iniciante') {
    if (WINDOW_FN.test(code) || OVER.test(code)) {
      return 'Nível Iniciante (0–1): remova Window Functions (`OVER`, `LAG`, `LEAD`, `ROW_NUMBER`). Use SELECT/WHERE/ORDER BY/LIMIT ou GROUP BY simples.';
    }
    if (WITH_ANY.test(code)) {
      return 'Nível Iniciante (0–1): remova a CTE (`WITH`). CTEs são Nível 5 (Avançado).';
    }
    if (SUBQUERY.test(code)) {
      return 'Nível Iniciante (0–1): remova subconsultas. Use um SELECT direto, no máximo com um JOIN simples.';
    }
    if (joins > 1) {
      return 'Nível Iniciante (0–1): no máximo um JOIN. JOINs múltiplos são Nível 2 (Intermediário).';
    }
    if (TEMPORAL.test(code)) {
      return 'Nível Iniciante (0–1): não use strftime/unixepoch/julianday (Nível 3). Use WHERE em valor/canal ou GROUP BY simples.';
    }
    return null;
  }

  if (difficulty === 'intermediario') {
    if (WINDOW_FN.test(code) || OVER.test(code)) {
      return 'Nível Intermediário (2–3): não use Window Functions (`OVER`, `ROW_NUMBER`, `LAG`). Isso é Nível 4. Use JOIN cadastral (nível 2) ou strftime/unixepoch (nível 3).';
    }
    if (WITH_ANY.test(code)) {
      return 'Nível Intermediário (2–3): não use CTE (`WITH`). Isso é Nível 5. Resolva com JOIN e/ou funções de data/hora.';
    }
    if (joins < 1 && !TEMPORAL.test(code)) {
      return 'Nível Intermediário (2–3): a solutionQuery deve ter JOIN cadastral (nível 2) ou recorte temporal com strftime/unixepoch/julianday (nível 3).';
    }
    return null;
  }

  if (!WITH_ANY.test(code) && !WINDOW_FN.test(code) && !OVER.test(code)) {
    return 'Nível Avançado (4–5): use Window Functions (`ROW_NUMBER`, `LAG`, `OVER`) no Nível 4 ou uma CTE (`WITH`) no Nível 5.';
  }
  return null;
}

export function formatToolkitForPrompt(difficulty: ChallengeDifficulty): string {
  const kit = DIFFICULTY_TOOLKIT[difficulty];
  const levels = DIFFICULTY_TRAIL_LEVELS[difficulty].join(' ou ');
  return `PRIORIDADE MÁXIMA — amarração deste pedido (${difficulty}):
- Faixa de nível OBRIGATÓRIA: ${levels} (proibido qualquer outro número em "nivel").
- Prefixo de "id": ${kit.idPrefixo}
- Ferramentas: ${kit.resumo}
- ${kit.obrigatorio}
- ${kit.proibido}
- Foco analítico: ${kit.foco}`;
}
