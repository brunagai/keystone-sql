import type { QueryExecResult } from 'sql.js';
import { formatBRL, formatDecimal } from '../ui/format.ts';

export type ScenarioId = string;

export type ScenarioOrigin = 'base' | 'ia' | 'offline';

export interface SuccessSummary {
  message: string;
  entities: string[];
  details?: string[];
}

export interface DivergenceHints {
  /** Aluno retornou mais linhas que o gabarito (filtro frouxo). */
  excesso: string;
  /** Aluno retornou menos linhas que o gabarito (filtro restritivo). */
  falta: string;
  /** Mesmas entidades, métricas diferentes. */
  valores: string;
  ordenacao: string;
}

export interface InvestigationScenario {
  id: ScenarioId;
  origem: ScenarioOrigin;
  /** Modelo de IA que gerou o desafio (apenas origem 'ia'). */
  modelo?: string;
  titulo: string;
  /** Rótulo regulatório exibido no badge da tipologia. */
  enquadramento: string;
  dossie: string;
  /** Aceita `código` inline. */
  objetivo: string;
  colunasEsperadas: readonly string[];
  ordenacao: string;
  dicaTexto: string;
  dicaSql: string;
  /** Query de referência (ground truth). Os comentários `--` fazem parte do gabarito comentado. */
  gabaritoSql: string;
  /** Coluna do gabarito usada para apontar entidades faltantes/excedentes. */
  colunaChave: string;
  rotuloEntidade: { singular: string; plural: string };
  dicasDivergencia: DivergenceHints;
  resumirSucesso(gabarito: QueryExecResult): SuccessSummary;
}

function columnValues(result: QueryExecResult, column: string): unknown[] {
  const index = result.columns.indexOf(column);
  return index < 0 ? [] : result.values.map((row) => row[index]);
}

const distinct = (values: unknown[]): string[] => [...new Set(values.map(String))];
const sum = (values: unknown[]): number => values.reduce<number>((acc, v) => acc + Number(v), 0);

export const SCENARIOS: readonly InvestigationScenario[] = [
  {
    id: 'smurfing',
    origem: 'base',
    titulo: 'Smurfing para a receptora Aurora (C025)',
    enquadramento: 'Carta Circular Bacen 4.001/2020 · Inciso I - Fracionamento',
    dossie:
      'A área de monitoramento recebeu alerta sobre a PJ "Comercial Aurora Importados Ltda" (C025), aberta em junho/2026 ' +
      'com faturamento declarado de R$ 18 mil. Em poucos dias ela recebeu dezenas de milhares de reais de pessoas físicas ' +
      'recém-cadastradas, sempre em valores logo abaixo do limiar de comunicação de R$ 10.000,00.',
    objetivo:
      'Identifique os remetentes que enviaram PIX individuais entre R$ 9.700,00 e R$ 9.999,00 para a conta `C025`, ' +
      'com pelo menos 2 operações (`HAVING COUNT(*) >= 2`). Retorne `conta_origem` (alias de `id_conta_origem`), ' +
      '`total_operacoes` e `valor_total`.',
    colunasEsperadas: ['conta_origem', 'total_operacoes', 'valor_total'],
    ordenacao: 'valor_total DESC',
    dicaTexto: 'Filtre destino e faixa de valor no WHERE, agrupe por remetente e aplique a recorrência no HAVING.',
    dicaSql: `SELECT id_conta_origem AS conta_origem,
       COUNT(*)   AS ...,
       SUM(valor) AS ...
FROM transacoes_pix
WHERE id_conta_destino = '...'
  AND valor BETWEEN ... AND ...
GROUP BY ...
HAVING ...
ORDER BY ...;`,
    gabaritoSql: `-- Gabarito comentado · Smurfing para a Comercial Aurora (C025)
SELECT
  t.id_conta_origem AS conta_origem,     -- remetente (possível "laranja")
  COUNT(*)          AS total_operacoes,  -- quantas vezes fracionou
  SUM(t.valor)      AS valor_total       -- montante total pulverizado
FROM transacoes_pix AS t
WHERE t.id_conta_destino = 'C025'        -- receptora sob alerta
  AND t.valor BETWEEN 9700 AND 9999      -- logo abaixo do limiar de R$ 10 mil (BETWEEN é inclusivo)
GROUP BY t.id_conta_origem               -- uma linha por remetente
HAVING COUNT(*) >= 2                     -- recorrência: padrão de fracionamento, não evento isolado
ORDER BY valor_total DESC;               -- maior exposição primeiro`,
    colunaChave: 'conta_origem',
    rotuloEntidade: { singular: 'remetente', plural: 'remetentes' },
    dicasDivergencia: {
      excesso:
        'Há remetentes a mais. Confira se filtrou o destino `C025`, a faixa `BETWEEN 9700 AND 9999` e se aplicou `HAVING COUNT(*) >= 2`.',
      falta:
        'Faltam remetentes. Os limites do `BETWEEN` são inclusivos; confira também se o `HAVING` não ficou mais restritivo que `>= 2`.',
      valores: 'Os remetentes estão certos, mas as métricas não. `total_operacoes` deve ser `COUNT(*)` e `valor_total` deve ser `SUM(valor)`.',
      ordenacao: 'Os dados estão corretos, mas a ordem não. Ordene por `valor_total DESC`.',
    },
    resumirSucesso(gabarito) {
      const remetentes = distinct(columnValues(gabarito, 'conta_origem'));
      const total = sum(columnValues(gabarito, 'valor_total'));
      return {
        message: `Excelente! Você capturou com precisão os ${remetentes.length} remetentes de smurfing e a conta receptora C025, que concentraram ${formatBRL(total)} em operações fracionadas.`,
        entities: [...remetentes, 'C025 (receptora)'],
        details: ['Próximo passo de um analista: verificar para onde a C025 repassou os recursos (siga o dinheiro!).'],
      };
    },
  },
  {
    id: 'burst',
    origem: 'base',
    titulo: 'Burst / alta frequência em janela curta',
    enquadramento: 'Carta Circular Bacen 4.001/2020 · Inciso IV - Alta Frequência',
    dossie:
      'Um parceiro de arranjo reportou picos de liquidação via API durante a madrugada envolvendo uma intermediadora de ' +
      'pagamentos e pessoas físicas no Rio de Janeiro. O padrão sugere automação para pulverizar recursos em cadeia ' +
      '(layering) sem propósito comercial aparente.',
    objetivo:
      'Liste todas as transações cujo intervalo para a transação imediatamente anterior da MESMA conta de origem seja ' +
      '`<= 60` segundos. Use `LAG(data_hora) OVER (PARTITION BY id_conta_origem ORDER BY data_hora)` e calcule o delta ' +
      "com `strftime('%s', ...)`. Retorne `id_transacao`, `conta_origem`, `conta_destino`, `valor`, `data_hora` e " +
      '`intervalo_segundos`.',
    colunasEsperadas: ['id_transacao', 'conta_origem', 'conta_destino', 'valor', 'data_hora', 'intervalo_segundos'],
    ordenacao: 'conta_origem ASC, data_hora ASC',
    dicaTexto:
      'Funções de janela não podem ser filtradas diretamente no WHERE do mesmo SELECT: calcule o LAG em uma CTE e filtre na consulta externa.',
    dicaSql: `WITH sequencia AS (
  SELECT *,
         LAG(data_hora) OVER (
           PARTITION BY id_conta_origem
           ORDER BY data_hora
         ) AS lag_data_hora
  FROM transacoes_pix
)
SELECT ...,
       strftime('%s', data_hora) - strftime('%s', lag_data_hora) AS intervalo_segundos
FROM sequencia
WHERE ...;`,
    gabaritoSql: `-- Gabarito comentado · Burst / alta frequência (LAG)
WITH sequencia AS (
  SELECT
    t.id_transacao,
    t.id_conta_origem  AS conta_origem,
    t.id_conta_destino AS conta_destino,
    t.valor,
    t.data_hora,
    LAG(t.data_hora) OVER (          -- horário do PIX anterior...
      PARTITION BY t.id_conta_origem -- ...da MESMA conta de origem
      ORDER BY t.data_hora           -- em ordem cronológica
    ) AS lag_data_hora
  FROM transacoes_pix AS t
),
intervalos AS (
  SELECT
    *,
    -- strftime('%s') converte para epoch (segundos); a diferença é o intervalo
    CAST(strftime('%s', data_hora) AS INTEGER)
      - CAST(strftime('%s', lag_data_hora) AS INTEGER) AS intervalo_segundos
  FROM sequencia
  WHERE lag_data_hora IS NOT NULL    -- a 1ª transação de cada conta não tem anterior
)
SELECT id_transacao, conta_origem, conta_destino, valor, data_hora, intervalo_segundos
FROM intervalos
WHERE intervalo_segundos <= 60       -- janela de alta frequência (inclusiva)
ORDER BY conta_origem ASC, data_hora ASC;`,
    colunaChave: 'id_transacao',
    rotuloEntidade: { singular: 'transação', plural: 'transações' },
    dicasDivergencia: {
      excesso:
        'Há transações a mais. Confira o filtro `intervalo_segundos <= 60` e se o `LAG` está ordenado por `data_hora`.',
      falta:
        'Faltam transações. Particione apenas por `id_conta_origem` (não pelo par origem/destino) e use `<= 60` (inclusivo).',
      valores:
        "As transações estão certas, mas alguma métrica diverge. `intervalo_segundos` deve ser `strftime('%s', data_hora) - strftime('%s', lag_data_hora)`.",
      ordenacao: 'Os dados estão corretos, mas a ordem não. Ordene por `conta_origem ASC, data_hora ASC`.',
    },
    resumirSucesso(gabarito) {
      const contas = distinct(columnValues(gabarito, 'conta_origem'));
      return {
        message: `Precisão cirúrgica! Você isolou as ${gabarito.values.length} transações com intervalo de até 60 s, distribuídas entre ${contas.length} contas de origem.`,
        entities: contas,
        details: [
          'Repare que nem todo alerta é suspeito: pagamentos de folha e repasses de aluguel em lote (PJs C021 e C022) também caem na janela. A diligência do analista separa automação legítima de layering.',
        ],
      };
    },
  },
  {
    id: 'incompatibilidade',
    origem: 'base',
    titulo: 'Incompatibilidade patrimonial bruta',
    enquadramento: 'Circular Bacen 3.978/2020, Art. 38 c/c Carta Circular 4.001/2020, Inciso II',
    dossie:
      'Comunicação interna aponta que clientes de baixa renda declarada (estudante, aposentada e MEI) passaram a ' +
      'movimentar centenas de milhares de reais em agosto/2026, em operações com uma holding recém-constituída.',
    objetivo:
      'Identifique transações individuais com `valor >= 30 * renda_mensal` do titular da conta de ORIGEM. Retorne ' +
      '`id_transacao`, `conta_origem`, `titular`, `renda_mensal` (alias de `renda_mensal_declarada`), `valor` e ' +
      '`fator_incompatibilidade` = `ROUND(valor / renda_mensal, 2)`.',
    colunasEsperadas: ['id_transacao', 'conta_origem', 'titular', 'renda_mensal', 'valor', 'fator_incompatibilidade'],
    ordenacao: 'fator_incompatibilidade DESC',
    dicaTexto: 'Faça JOIN da transação com a conta pela ORIGEM e compare o valor com um múltiplo da renda declarada.',
    dicaSql: `SELECT t.id_transacao,
       ...,
       ROUND(t.valor / c.renda_mensal_declarada, 2) AS fator_incompatibilidade
FROM transacoes_pix t
JOIN contas c ON c.id_conta = t.id_conta_origem
WHERE ...
ORDER BY ...;`,
    gabaritoSql: `-- Gabarito comentado · Incompatibilidade patrimonial (ratio valor/renda)
SELECT
  t.id_transacao,
  t.id_conta_origem        AS conta_origem,
  c.titular,                                   -- titular da conta de ORIGEM
  c.renda_mensal_declarada AS renda_mensal,    -- capacidade financeira declarada (KYC)
  t.valor,
  ROUND(t.valor / c.renda_mensal_declarada, 2) AS fator_incompatibilidade  -- quantas rendas em um único PIX
FROM transacoes_pix AS t
JOIN contas AS c
  ON c.id_conta = t.id_conta_origem            -- quem ENVIA o recurso
WHERE c.renda_mensal_declarada > 0             -- protege contra divisão por zero
  AND t.valor >= 30 * c.renda_mensal_declarada -- desproporção grave: 30x a renda mensal
ORDER BY fator_incompatibilidade DESC;         -- casos mais graves primeiro`,
    colunaChave: 'id_transacao',
    rotuloEntidade: { singular: 'transação', plural: 'transações' },
    dicasDivergencia: {
      excesso:
        'Há transações a mais. Garanta que a renda comparada é a da conta de ORIGEM (`JOIN ... ON c.id_conta = t.id_conta_origem`) e que o fator mínimo é 30.',
      falta: 'Faltam transações. Use `>=` (inclusivo) e compare `valor` com `30 * renda_mensal_declarada` da conta de origem.',
      valores:
        'As transações estão certas, mas alguma métrica diverge. `fator_incompatibilidade` deve ser `ROUND(valor / renda_mensal, 2)`.',
      ordenacao: 'Os dados estão corretos, mas a ordem não. Ordene por `fator_incompatibilidade DESC`.',
    },
    resumirSucesso(gabarito) {
      const titulares = distinct(columnValues(gabarito, 'titular'));
      const fatores = columnValues(gabarito, 'fator_incompatibilidade').map(Number);
      const pico = fatores.length > 0 ? Math.max(...fatores) : 0;
      return {
        message: `Excelente! Você identificou as ${gabarito.values.length} transações com desproporção grave (≥ 30x a renda), com pico de ${formatDecimal(pico)}x a renda declarada.`,
        entities: titulares,
        details: ['Esses titulares são fortes candidatos a "contas de passagem"; o próximo passo é mapear a origem dos recursos.'],
      };
    },
  },
];