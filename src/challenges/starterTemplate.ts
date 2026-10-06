import { TRAIL_LEVELS, type InvestigationScenario, type TrailLevel } from './scenarios.ts';

function cabecalho(scenario: InvestigationScenario): string {
  return [
    `-- Sua missão: ${scenario.titulo}`,
    `-- Nível ${scenario.nivel} · ${TRAIL_LEVELS[scenario.nivel].titulo}`,
    '-- Escreva sua consulta SQL abaixo:',
    '',
  ].join('\n');
}

/** Esqueleto vazio por degrau da trilha: só comentários de estrutura, sem filtros nem gabarito. */
function esqueletoDoNivel(nivel: TrailLevel): string {
  if (nivel === 0) {
    return `SELECT
    -- indique as colunas solicitadas
FROM
    -- qual tabela concentra os dados desta investigação?
-- WHERE
--     -- recorte de linhas, se a missão pedir
-- ORDER BY
--     -- ordenação pedida no enunciado
;`;
  }

  if (nivel === 1) {
    return `SELECT
    -- indique as colunas e, se preciso, as agregações (COUNT, SUM, AVG…)
FROM
    -- tabela-base da investigação
-- WHERE
--     -- filtros sobre cada linha (antes de agrupar)
-- GROUP BY
--     -- como consolidar os grupos
-- HAVING
--     -- corte sobre o grupo já agregado
-- ORDER BY
--     -- ordenação pedida no enunciado
;`;
  }

  if (nivel === 2) {
    return `SELECT
    -- indique as colunas solicitadas
FROM
    -- tabela principal
-- JOIN
--     -- outra tabela cadastral
--     ON -- chave de relacionamento
-- WHERE
--     -- recorte de negócio (você define os predicados)
-- ORDER BY
--     -- ordenação pedida no enunciado
;`;
  }

  if (nivel === 3) {
    return `SELECT
    -- indique as colunas solicitadas
FROM
    -- tabela principal
-- JOIN
--     -- cadastro ou telemetria, se a missão cruzar fontes
--     ON -- chave de relacionamento
-- WHERE
--     -- recortes de data/hora ou de valor (você escolhe as funções e os limiares)
-- GROUP BY
--     -- consolidação, se a missão pedir
-- HAVING
--     -- corte de grupo, se a missão pedir
-- ORDER BY
--     -- ordenação pedida no enunciado
;`;
  }

  if (nivel === 4) {
    return `-- Dica de estrutura: funções de janela (ROW_NUMBER, LAG, SUM OVER) e, se quiser, uma CTE.
-- WITH etapa AS (
--     SELECT
--         -- colunas e métricas de janela
--     FROM
--         -- tabela-base
-- )
SELECT
    -- indique as colunas solicitadas
FROM
    -- tabela-base ou a CTE acima
-- WHERE
--     -- corte sobre a métrica já calculada, se a missão pedir
-- ORDER BY
--     -- ordenação pedida no enunciado
;`;
  }

  return `-- Dica de estrutura: uma ou mais CTEs (WITH) ajudam a montar a investigação em etapas.
-- WITH
--     etapa_1 AS (
--         SELECT
--             -- projeções desta etapa
--         FROM
--             -- tabela-base
--     )
--     -- , etapa_2 AS ( ... )
SELECT
    -- indique as colunas solicitadas
FROM
    -- etapa anterior e, se preciso, JOINs adicionais
-- WHERE
--     -- recorte final (você define as regras)
-- ORDER BY
--     -- ordenação pedida no enunciado
;`;
}

/** Cabeçalho e esqueleto SQL guiado para o desafio ativo — nunca a solução. */
export function buildStarterTemplate(scenario: InvestigationScenario): string {
  return `${cabecalho(scenario)}${esqueletoDoNivel(scenario.nivel)}`;
}
