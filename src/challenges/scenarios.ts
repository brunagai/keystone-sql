import type { QueryExecResult } from 'sql.js';
import { formatBRL, formatDecimal } from '../ui/format.ts';

export type ScenarioId = string;

export type ScenarioOrigin = 'base' | 'ia' | 'offline';

/** Degraus da trilha; o 2 cobre JOIN cadastral/QSA; o 5 cobre telemetria/produtos e, em seguida, desafios gerados. */
export type TrailLevel = 0 | 1 | 2 | 3 | 4 | 5;

/** Caso aberto na primeira carga (Nível 0.1). */
export const DEFAULT_SCENARIO_ID: ScenarioId = 'cadastro-listagem';

export interface TrailLevelInfo {
  titulo: string;
  /** Técnica SQL que o nível exercita. */
  tecnica: string;
}

export const TRAIL_LEVELS: Record<TrailLevel, TrailLevelInfo> = {
  0: { titulo: 'Fundamentos de Consulta', tecnica: 'SELECT, FROM, WHERE, ORDER BY e GROUP BY' },
  1: { titulo: 'Fundamentos de Agregação', tecnica: 'GROUP BY, HAVING, JOIN e limiares' },
  2: { titulo: 'Cruzamentos Cadastrais e Relações Societárias', tecnica: 'JOIN, LEFT JOIN e duplo relacionamento de cadastro' },
  3: { titulo: 'Janelas Temporais e Anomalias Transacionais', tecnica: 'time/strftime, HAVING sobre renda, date() e unixepoch' },
  4: { titulo: 'Funções de Janela (Window Functions)', tecnica: 'ROW_NUMBER, LAG, SUM OVER e CTE em duas fases' },
  5: { titulo: 'Investigações Avançadas e Casos Complexos Bacen', tecnica: 'QSA/PEP, dwell time, telemetria, triangulação e dossiê COAF' },
};

const TRAIL_ORDER: readonly TrailLevel[] = [0, 1, 2, 3, 4, 5];

/** Filtros da navbar: Iniciante = 0–1, Intermediário = 2–3, Avançado = 4–5. */
export type TrailBand = 'todos' | 'iniciante' | 'intermediario' | 'avancado';

export const TRAIL_BAND_LEVELS: Record<TrailBand, readonly TrailLevel[]> = {
  todos: TRAIL_ORDER,
  iniciante: [0, 1],
  intermediario: [2, 3],
  avancado: [4, 5],
};

export function trailBandOf(nivel: TrailLevel): Exclude<TrailBand, 'todos'> {
  if (nivel <= 1) return 'iniciante';
  if (nivel <= 3) return 'intermediario';
  return 'avancado';
}

export function trailOptgroupLabel(nivel: TrailLevel): string {
  return `Nível ${nivel} · ${TRAIL_LEVELS[nivel].titulo}`;
}

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

/** Esteira analítica: carimbar métricas no WITH, cortar no WHERE externo. */
export interface TwoPhaseStep {
  titulo: string;
  /** Aceita `código` inline. */
  texto: string;
}

export interface TwoPhaseReasoning {
  fase1: TwoPhaseStep;
  fase2: TwoPhaseStep;
}

export interface PassoGabarito {
  linha: string;
  explicacao: string;
}

export interface ExplicacaoGabarito {
  raciocinio: string;
  passos: PassoGabarito[];
  atencao?: string;
}

export interface InvestigationScenario {
  id: ScenarioId;
  origem: ScenarioOrigin;
  nivel: TrailLevel;
  /** Modelo de IA que gerou o desafio (apenas origem 'ia'). */
  modelo?: string;
  titulo: string;
  /** Rótulo regulatório exibido no badge da tipologia. */
  enquadramento: string;
  dossie: string;
  /** Briefing executivo da missão (sem nomes técnicos de colunas). Aceita `código` inline só se necessário. */
  objetivo: string;
  colunasEsperadas: readonly string[];
  ordenacao: string;
  dicaTexto: string;
  dicaSql: string;
  /** Esteira WITH → WHERE; presente nos níveis 3–4 (e inferida nos desafios gerados). */
  decomposicao?: TwoPhaseReasoning;
  /** Query de referência (ground truth). Os comentários `--` fazem parte do gabarito comentado. */
  gabaritoSql: string;
  /** Mini-aula do card “Ver gabarito comentado”. O editor recebe só `gabaritoSql`. */
  explicacaoGabarito?: ExplicacaoGabarito;
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

const CATALOG: readonly InvestigationScenario[] = [
  {
    id: 'cadastro-listagem',
    origem: 'base',
    nivel: 0,
    titulo: 'Reconhecimento Cadastral: Listagem de Clientes',
    enquadramento: 'Circular Bacen 3.978/2020 · conhecimento do cliente (KYC)',
    dossie:
      'Antes de qualquer alerta de transação, a esteira de PLD precisa conhecer a base cadastral: quem são os titulares, ' +
      'se a conta é de pessoa física ou jurídica e qual renda ou faturamento foi declarado. Este primeiro recorte monta a ' +
      'ficha-mãe dos clientes no laboratório.',
    objetivo:
      'Preciso da ficha-mãe da nossa base antes de qualquer alerta. Identifique cada conta, o titular, se é pessoa física ou jurídica e a renda ou o faturamento declarado.',
    colunasEsperadas: ['id_conta', 'titular', 'tipo_pessoa', 'renda_mensal_declarada'],
    ordenacao: 'id_conta',
    dicaTexto:
      'Comece projetando as colunas cadastrais e indique de qual tabela elas vêm. Ainda não é preciso filtrar nem agrupar.',
    dicaSql: `-- SELECT escolhe as colunas; FROM indica a tabela
SELECT coluna_a, coluna_b
FROM nome_da_tabela;`,
    gabaritoSql: `-- Gabarito · reconhecimento cadastral (KYC)
SELECT
  id_conta,
  titular,
  tipo_pessoa,
  renda_mensal_declarada
FROM contas;`,
    colunaChave: 'id_conta',
    rotuloEntidade: { singular: 'cliente', plural: 'clientes' },
    dicasDivergencia: {
      excesso: 'Há contas a mais. Use somente a tabela de cadastro, sem cruzar PIX nem aplicar filtros extras.',
      falta: 'Faltam clientes. Não restrinja a listagem: o recorte pede toda a base cadastrada.',
      valores:
        'Os identificadores batem, mas algum campo diverge. Projete titular, tipo de pessoa e a renda/faturamento declarado, sem aliases desnecessários.',
      ordenacao: 'Os dados estão corretos, mas a ordem não. Ordene pelo identificador da conta.',
    },
    resumirSucesso(gabarito) {
      return {
        message: `Base cadastral mapeada: ${gabarito.values.length} cliente(s) com titular, tipo de pessoa e renda/faturamento declarado.`,
        entities: distinct(columnValues(gabarito, 'id_conta')).slice(0, 8),
        details: ['Próximo passo: isolar quem o cadastro marca como Pessoa Exposta Politicamente.'],
      };
    },
  },
  {
    id: 'triagem-pep',
    origem: 'base',
    nivel: 0,
    titulo: 'Triagem de Risco: Pessoas Expostas Politicamente (PEP)',
    enquadramento: 'Circular Bacen 3.978/2020 · escrutínio reforçado de PEP',
    dossie:
      'Titulares com cargo público relevante exigem monitoramento mais rigoroso. O cadastro já traz o sinalizador de ' +
      'Pessoa Exposta Politicamente; a triagem inicial é listar essas contas para a mesa de PLD.',
    objetivo:
      'Antes de olhar transação, quero o recorte de escrutínio reforçado: identifique a conta, o titular e a ocupação declarada de quem o cadastro marca como Pessoa Exposta Politicamente.',
    colunasEsperadas: ['id_conta', 'titular', 'ocupacao'],
    ordenacao: 'id_conta',
    dicaTexto:
      'Depois de escolher as colunas, mantenha só as linhas que satisfazem uma condição cadastral (o sinalizador PEP).',
    dicaSql: `-- WHERE filtra linhas que atendem a uma condição
SELECT coluna_a, coluna_b
FROM nome_da_tabela
WHERE coluna_filtro = ...;`,
    gabaritoSql: `-- Gabarito · triagem de PEP
SELECT
  id_conta,
  titular,
  ocupacao
FROM contas
WHERE eh_pep = 1;`,
    explicacaoGabarito: {
      raciocinio:
        'Identificamos clientes com exposição política filtrando o indicador booleano cadastral e selecionando apenas os dados necessários para triagem.',
      passos: [
        {
          linha: 'SELECT id_conta, titular, ocupacao',
          explicacao:
            'Projeta exatamente as colunas solicitadas para o relatório, evitando transferir campos dispensáveis.',
        },
        {
          linha: 'FROM contas',
          explicacao: 'Consulta a base cadastral de clientes do banco.',
        },
        {
          linha: 'WHERE eh_pep = 1',
          explicacao: 'Filtra registros onde o sinalizador de Pessoa Politicamente Exposta está ativo.',
        },
      ],
      atencao:
        'No SQLite, sinalizadores booleanos são gravados como números inteiros: utilize 1 para verdadeiro e 0 para falso.',
    },
    colunaChave: 'id_conta',
    rotuloEntidade: { singular: 'conta PEP', plural: 'contas PEP' },
    dicasDivergencia: {
      excesso: 'Há contas a mais. Mantenha apenas quem o cadastro marca como PEP (`eh_pep = 1`).',
      falta: 'Faltam contas PEP. Confira o sinalizador cadastral (`eh_pep`) e não filtre por cargo ou cidade.',
      valores: 'As contas estão certas, mas titular ou ocupação divergem. Projete os campos cadastrais pedidos.',
      ordenacao: 'Os dados estão corretos, mas a ordem não. Ordene pelo identificador da conta.',
    },
    resumirSucesso(gabarito) {
      const contas = distinct(columnValues(gabarito, 'id_conta'));
      const titulares = distinct(columnValues(gabarito, 'titular'));
      return {
        message: `Triagem PEP: ${gabarito.values.length} conta(s) com escrutínio reforçado (${titulares.join(', ') || '—'}).`,
        entities: contas,
        details: ['No laboratório, C013 (Deputado Estadual) e C004 (Prefeito) são o recorte plantado.'],
      };
    },
  },
  {
    id: 'pix-alto-valor',
    origem: 'base',
    nivel: 0,
    titulo: 'Comunicação Obrigatória: Operações de Alto Valor',
    enquadramento: 'Carta Circular Bacen 4.001/2020 · operações em espécie ou de elevado valor',
    dossie:
      'Valores individuais elevados concentram risco de comunicação e de revisão manual. A mesa pediu o mapa de PIX cujo ' +
      'montante unitário alcança ou supera R$ 50.000,00, priorizando os maiores valores.',
    objetivo:
      'A mesa precisa das liquidações de alto valor para comunicação e revisão manual. Levante todo PIX de R$ 50.000,00 ou mais, identificando a transação, a conta remetente, a conta favorecida, o valor e o momento da liquidação, com os maiores montantes no topo da fila.',
    colunasEsperadas: ['id_transacao', 'id_conta_origem', 'id_conta_destino', 'valor', 'data_hora'],
    ordenacao: 'valor DESC',
    dicaTexto:
      'Filtre as liquidações pelo limiar de valor e, em seguida, organize o resultado do maior montante para o menor.',
    dicaSql: `-- WHERE compara números; ORDER BY DESC coloca os maiores primeiro
SELECT ...
FROM transacoes_pix
WHERE valor >= ...
ORDER BY valor DESC;`,
    gabaritoSql: `-- Gabarito · PIX de alto valor (R$ 50 mil)
SELECT
  id_transacao,
  id_conta_origem,
  id_conta_destino,
  valor,
  data_hora
FROM transacoes_pix
WHERE valor >= 50000
ORDER BY valor DESC;`,
    colunaChave: 'id_transacao',
    rotuloEntidade: { singular: 'transferência', plural: 'transferências' },
    dicasDivergencia: {
      excesso: 'Há PIX a mais. Use o limiar inclusivo de R$ 50.000,00 (`valor >= 50000`) e somente a tabela de transações.',
      falta: 'Faltam operações. O corte é inclusivo: R$ 50.000,00 entra. Não restrinja por data, canal ou conta.',
      valores: 'As transações estão certas, mas algum campo diverge. Projete origem, destino, valor e data/hora.',
      ordenacao: 'Os dados estão corretos, mas a ordem não. Ordene pelo valor do maior para o menor.',
    },
    resumirSucesso(gabarito) {
      const total = sum(columnValues(gabarito, 'valor'));
      return {
        message: `Alto valor: ${gabarito.values.length} PIX ≥ R$ 50 mil, somando ${formatBRL(total)}.`,
        entities: distinct(columnValues(gabarito, 'id_transacao')).slice(0, 8),
        details: ['O próximo degrau é combinar tipo de pessoa e um teto de renda cadastral.'],
      };
    },
  },
  {
    id: 'baixa-renda-pf',
    origem: 'base',
    nivel: 0,
    titulo: 'Perfil Vulnerável: Baixa Renda Cadastral',
    enquadramento: 'Circular Bacen 3.978/2020 · abordagem baseada em risco e perfil do cliente',
    dossie:
      'A mesa de PLD recortou a base PF de baixa renda para cruzar, depois, movimentação incompatível. O primeiro passo é ' +
      'isolar quem se declara pessoa física com renda mensal estritamente abaixo de R$ 3.000,00.',
    objetivo:
      'A mesa de compliance precisa monitorar o perfil de clientes pessoa física de baixa renda para cruzar com movimentações suspeitas. Me traga um levantamento dos clientes que declararam renda estritamente abaixo de R$ 3.000,00, identificando a conta, o titular, a ocupação cadastrada e o valor da renda declarada.',
    colunasEsperadas: ['id_conta', 'titular', 'ocupacao', 'renda_mensal_declarada'],
    ordenacao: 'renda_mensal_declarada ASC',
    dicaTexto:
      'Combine duas condições cadastrais: o tipo de pessoa e um teto de renda (menor que o valor de corte, sem incluir o próprio piso).',
    dicaSql: `-- AND exige que as duas condições sejam verdadeiras ao mesmo tempo
SELECT ...
FROM contas
WHERE tipo_pessoa = '...'
  AND renda_mensal_declarada < ...
ORDER BY renda_mensal_declarada ASC;`,
    gabaritoSql: `-- Gabarito · PF com renda estritamente abaixo de R$ 3.000
SELECT
  id_conta,
  titular,
  ocupacao,
  renda_mensal_declarada
FROM contas
WHERE tipo_pessoa = 'PF'
  AND renda_mensal_declarada < 3000;`,
    colunaChave: 'id_conta',
    rotuloEntidade: { singular: 'cliente', plural: 'clientes' },
    dicasDivergencia: {
      excesso: 'Há contas a mais. Mantenha só PF e renda estritamente menor que R$ 3.000,00 (`< 3000`, não `<=`).',
      falta: 'Faltam clientes. Não exclua renda zero ou valores quebrados; o corte é exclusivo em R$ 3.000,00.',
      valores: 'Os identificadores batem, mas ocupação ou renda divergem. Projete os quatro campos cadastrais pedidos.',
      ordenacao: 'Os dados estão corretos, mas a ordem não. Ordene pela renda declarada, da menor para a maior.',
    },
    resumirSucesso(gabarito) {
      return {
        message: `Perfil vulnerável: ${gabarito.values.length} PF(s) com renda declarada abaixo de R$ 3.000,00.`,
        entities: distinct(columnValues(gabarito, 'id_conta')).slice(0, 8),
        details: ['Esse recorte alimenta depois a análise de incompatibilidade patrimonial (nível 1).'],
      };
    },
  },
  {
    id: 'volumetria-remetente',
    origem: 'base',
    nivel: 0,
    titulo: 'Volumetria Transacional: Consolidação por Remetente',
    enquadramento: 'Circular Bacen 3.978/2020 · monitoramento de movimentação por cliente',
    dossie:
      'Depois de ver operações isoladas, a esteira consolida o comportamento de cada pagador: quantas remessas partem da ' +
      'conta e qual o volume financeiro acumulado. Essa visão alimenta o ranking de exposição antes dos cortes de fracionamento.',
    objetivo:
      'Preciso de uma visão consolidada por remetente para a nossa esteira de monitoramento. Identifique cada conta que enviou recursos, quantas transferências realizou no período e a soma total transacionada.',
    colunasEsperadas: ['conta_origem', 'total_operacoes', 'valor_total'],
    ordenacao: 'total_operacoes DESC',
    dicaTexto:
      'Agrupe as liquidações pela conta pagadora e, em cada grupo, conte as remessas e some os valores. Ainda não aplique recorrência mínima (isso vem no caso 1.1).',
    dicaSql: `-- GROUP BY consolida linhas; COUNT e SUM viram métricas por grupo
SELECT id_conta_origem AS conta_origem,
       COUNT(*)        AS total_operacoes,
       SUM(valor)      AS valor_total
FROM transacoes_pix
GROUP BY id_conta_origem
ORDER BY total_operacoes DESC;`,
    gabaritoSql: `-- Gabarito · volumetria por remetente
SELECT
  id_conta_origem AS conta_origem,
  COUNT(*)        AS total_operacoes,
  SUM(valor)      AS valor_total
FROM transacoes_pix
GROUP BY id_conta_origem;`,
    colunaChave: 'conta_origem',
    rotuloEntidade: { singular: 'remetente', plural: 'remetentes' },
    dicasDivergencia: {
      excesso: 'Há contas a mais. Agrupe só pela origem do PIX, sem filtrar destino nem faixa de valor.',
      falta: 'Faltam remetentes. Não use corte de quantidade mínima: toda conta que enviou PIX entra na consolidação.',
      valores:
        'Os remetentes estão certos, mas as métricas não. `total_operacoes` é a quantidade de envios e `valor_total` é a soma dos valores.',
      ordenacao: 'Os dados estão corretos, mas a ordem não. Ordene pela quantidade de remessas, da maior para a menor.',
    },
    resumirSucesso(gabarito) {
      const contas = distinct(columnValues(gabarito, 'conta_origem'));
      const total = sum(columnValues(gabarito, 'valor_total'));
      return {
        message: `Volumetria: ${gabarito.values.length} conta(s) de origem, com ${formatBRL(total)} enviados no período.`,
        entities: contas.slice(0, 8),
        details: ['No Caso 1.1 você vai cruzar faixa logo abaixo de R$ 10 mil, destino C025 e recorrência mínima.'],
      };
    },
  },
  {
    id: 'capilaridade-destinatarios',
    origem: 'base',
    nivel: 0,
    titulo: 'Capilaridade de Rede: Destinatários Distintos',
    enquadramento: 'Circular Bacen 3.978/2020 · monitoramento de relacionamento transacional',
    dossie:
      'Além do volume financeiro, a esteira observa a amplitude da rede de cada pagador: para quantas contas favorecidas ' +
      'distintas cada remetente enviou recursos. Essa capilaridade ajuda a separar relações habituais de pulverização.',
    objetivo:
      'Além do volume, quero a amplitude da rede. Identifique cada remetente e quantas contas favorecidas distintas receberam recursos — isso separa relação habitual de pulverização.',
    colunasEsperadas: ['conta_origem', 'total_destinatarios_distintos'],
    ordenacao: 'total_destinatarios_distintos DESC',
    dicaTexto:
      'Consolide pela conta pagadora e, em cada grupo, conte quantos destinos únicos aparecem — não a quantidade de PIX.',
    dicaSql: `-- COUNT(DISTINCT ...) conta valores únicos dentro do grupo
SELECT id_conta_origem AS conta_origem,
       COUNT(DISTINCT id_conta_destino) AS total_destinatarios_distintos
FROM transacoes_pix
GROUP BY id_conta_origem
ORDER BY total_destinatarios_distintos DESC;`,
    gabaritoSql: `-- Gabarito · destinatários distintos por remetente
SELECT
  id_conta_origem AS conta_origem,
  COUNT(DISTINCT id_conta_destino) AS total_destinatarios_distintos
FROM transacoes_pix
GROUP BY id_conta_origem;`,
    colunaChave: 'conta_origem',
    rotuloEntidade: { singular: 'remetente', plural: 'remetentes' },
    dicasDivergencia: {
      excesso: 'Há contas a mais. Agrupe só pela origem do PIX, sem filtrar valor, canal ou período.',
      falta: 'Faltam remetentes. Toda conta que enviou ao menos um PIX deve aparecer, mesmo com um único favorecido.',
      valores:
        'Os remetentes estão certos, mas a métrica não. `total_destinatarios_distintos` conta contas de destino únicas, não o número de remessas.',
      ordenacao: 'Os dados estão corretos, mas a ordem não. Ordene pela quantidade de favorecidos distintos, da maior para a menor.',
    },
    resumirSucesso(gabarito) {
      const contas = distinct(columnValues(gabarito, 'conta_origem'));
      return {
        message: `Capilaridade: ${gabarito.values.length} remetente(s) com rede de favorecidos distintos mapeada.`,
        entities: contas.slice(0, 8),
        details: ['No Nível 1 a consolidação ganha filtros de faixa, destino e recorrência mínima.'],
      };
    },
  },
  {
    id: 'smurfing',
    origem: 'base',
    nivel: 1,
    titulo: 'Smurfing para a receptora Aurora (C025)',
    enquadramento: 'Carta Circular Bacen 4.001/2020 · Inciso I - Fracionamento',
    dossie:
      'A área de monitoramento recebeu alerta sobre a PJ "Comercial Aurora Importados Ltda" (C025), aberta em junho/2026 ' +
      'com faturamento declarado de R$ 18 mil. Em poucos dias ela recebeu dezenas de milhares de reais de pessoas físicas ' +
      'recém-cadastradas, sempre em valores logo abaixo do limiar de comunicação de R$ 10.000,00.',
    objetivo:
      'A Aurora (C025) está concentrando PIX logo abaixo de R$ 10 mil. Identifique os remetentes que mandaram pelo menos duas operações entre R$ 9.700,00 e R$ 9.999,00 para essa conta, com a quantidade de disparos e o volume consolidado, priorizando os maiores montantes.',
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
    explicacaoGabarito: {
      raciocinio:
        'O recorte isola quem pulveriza PIX logo abaixo de R$ 10 mil para a Aurora (C025): filtra destino e faixa, consolida por remetente e só então exige recorrência.',
      passos: [
        {
          linha: 'SELECT t.id_conta_origem AS conta_origem, COUNT(*) AS total_operacoes, SUM(t.valor) AS valor_total',
          explicacao:
            'Uma linha por remetente, com a quantidade de envios e o montante pulverizado — as três colunas do relatório.',
        },
        {
          linha: 'FROM transacoes_pix AS t',
          explicacao:
            'Toda a evidência está na liquidação. Não há JOIN com o cadastro: titular e renda não entram neste recorte.',
        },
        {
          linha: "WHERE t.id_conta_destino = 'C025' AND t.valor BETWEEN 9700 AND 9999",
          explicacao:
            'Restringe à receptora sob alerta e à faixa unitária logo abaixo do limiar de comunicação. O `BETWEEN` é inclusivo nas duas pontas.',
        },
        {
          linha: 'GROUP BY t.id_conta_origem',
          explicacao: 'Agrupa os PIX filtrados para que COUNT e SUM descrevam cada conta de origem, não cada transação.',
        },
        {
          linha: 'HAVING COUNT(*) >= 2',
          explicacao:
            'O corte de recorrência vale sobre o grupo. `WHERE` não enxerga agregados: um único PIX na faixa não caracteriza smurfing.',
        },
        {
          linha: 'ORDER BY valor_total DESC',
          explicacao: 'Prioriza os maiores montantes, como pede o enunciado da fila de exposição.',
        },
      ],
      atencao:
        'Não coloque `COUNT(*)` no `WHERE`. Recorrência é predicado de grupo (`HAVING`). Quem envia um único PIX de R$ 9.850 para a C025 deve ficar de fora.',
    },
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
    id: 'alta-recorrencia',
    origem: 'base',
    nivel: 1,
    titulo: 'Alta Recorrência: Pulverização Sistemática de Envios',
    enquadramento: 'Carta Circular Bacen 4.001/2020 · Inciso IV - Alta Frequência',
    dossie:
      'A mesa de monitoramento observou pagadores com rotina de disparos muito acima do uso habitual. O recorte pede ' +
      'quem pulverizou envios no período, independentemente do valor unitário ou do favorecido, para priorizar contas ' +
      'com comportamento repetitivo.',
    objetivo:
      'A esteira precisa priorizar quem pulveriza envios. Identifique as contas que realizaram dez ou mais transferências no período, com a quantidade de disparos e o volume acumulado — independentemente do valor unitário ou do favorecido.',
    colunasEsperadas: ['conta_origem', 'total_operacoes', 'valor_total'],
    ordenacao: 'total_operacoes DESC',
    dicaTexto:
      'Consolide os envios por conta de origem e, só depois, mantenha os grupos cuja quantidade de remessas atinge o piso de 10.',
    dicaSql: `-- HAVING filtra GRUPOS (depois do agrupamento), não linhas isoladas
-- COUNT(*) no HAVING corta quem tem poucas ocorrências
SELECT id_conta_origem AS conta_origem,
       COUNT(*)        AS total_operacoes,
       SUM(valor)      AS valor_total
FROM transacoes_pix
GROUP BY id_conta_origem
HAVING COUNT(*) >= ...
ORDER BY total_operacoes DESC;`,
    gabaritoSql: `-- Gabarito · alta recorrência de envios (≥ 10)
SELECT
  id_conta_origem AS conta_origem,
  COUNT(*)        AS total_operacoes,
  SUM(valor)      AS valor_total
FROM transacoes_pix
GROUP BY id_conta_origem
HAVING COUNT(*) >= 10;`,
    colunaChave: 'conta_origem',
    rotuloEntidade: { singular: 'remetente', plural: 'remetentes' },
    dicasDivergencia: {
      excesso:
        'Há remetentes a mais. O corte de quantidade vale sobre o grupo: `HAVING COUNT(*) >= 10`. Sem piso, a listagem vira volumetria do Nível 0.',
      falta:
        'Faltam remetentes. O piso é inclusivo (`>= 10`). Não restrinja valor, destino ou canal: qualquer envio conta.',
      valores:
        'Os remetentes estão certos, mas as métricas não. `total_operacoes` é `COUNT(*)` e `valor_total` é `SUM(valor)`.',
      ordenacao: 'Os dados estão corretos, mas a ordem não. Ordene pela quantidade de envios, da maior para a menor.',
    },
    resumirSucesso(gabarito) {
      const contas = distinct(columnValues(gabarito, 'conta_origem'));
      const total = sum(columnValues(gabarito, 'valor_total'));
      return {
        message: `Alta recorrência: ${gabarito.values.length} remetente(s) com 10 ou mais envios, somando ${formatBRL(total)}.`,
        entities: contas.slice(0, 8),
        details: ['O próximo recorte inverte o olhar: concentração de créditos no favorecido, não no pagador.'],
      };
    },
  },
  {
    id: 'concentracao-creditos',
    origem: 'base',
    nivel: 1,
    titulo: 'Concentração Atípica de Créditos Recebidos',
    enquadramento: 'Carta Circular Bacen 4.001/2020 · Inciso I - Fracionamento / fan-in',
    dossie:
      'Receptoras que acumulam entradas relevantes em curto período concentram risco de pass-through. A esteira pediu as ' +
      'contas favorecidas cujo crédito acumulado ultrapassa R$ 100.000,00, com o ticket médio de cada crédito para ' +
      'distinguir poucos aportes grandes de muitos recebimentos menores.',
    objetivo:
      'Inverta o olhar para o favorecido. Identifique as contas que concentraram mais de R$ 100.000,00 em créditos no período, com o montante recebido e o ticket médio de cada entrada.',
    colunasEsperadas: ['conta_destino', 'total_recebido', 'valor_medio_operacao'],
    ordenacao: 'total_recebido DESC',
    dicaTexto:
      'Agrupe pelo favorecido, some os créditos e calcule o ticket médio. Mantenha só quem ultrapassa o piso acumulado de R$ 100.000,00.',
    dicaSql: `-- SUM no HAVING corta pelo volume acumulado do grupo
-- AVG devolve o ticket médio das operações daquele favorecido
SELECT id_conta_destino AS conta_destino,
       SUM(valor)       AS total_recebido,
       AVG(valor)       AS valor_medio_operacao
FROM transacoes_pix
GROUP BY id_conta_destino
HAVING SUM(valor) > ...
ORDER BY total_recebido DESC;`,
    gabaritoSql: `-- Gabarito · concentração de créditos recebidos (> R$ 100 mil)
SELECT
  id_conta_destino AS conta_destino,
  SUM(valor)       AS total_recebido,
  AVG(valor)       AS valor_medio_operacao
FROM transacoes_pix
GROUP BY id_conta_destino
HAVING SUM(valor) > 100000;`,
    colunaChave: 'conta_destino',
    rotuloEntidade: { singular: 'favorecido', plural: 'favorecidos' },
    dicasDivergencia: {
      excesso:
        'Há favorecidos a mais. O corte é estritamente acima de R$ 100.000,00 (`HAVING SUM(valor) > 100000`, não `>=`). Agrupe pelo destino, não pela origem.',
      falta:
        'Faltam favorecidas. Some todos os créditos da conta, sem recortar faixa unitária. Quem soma exatamente R$ 100.000,00 fica de fora.',
      valores:
        'Os destinos estão certos, mas as métricas não. `total_recebido` é `SUM(valor)` e `valor_medio_operacao` é `AVG(valor)`.',
      ordenacao: 'Os dados estão corretos, mas a ordem não. Ordene pelo volume recebido, do maior para o menor.',
    },
    resumirSucesso(gabarito) {
      const contas = distinct(columnValues(gabarito, 'conta_destino'));
      const total = sum(columnValues(gabarito, 'total_recebido'));
      return {
        message: `Concentração: ${gabarito.values.length} favorecido(s) acima de R$ 100 mil, com ${formatBRL(total)} em créditos acumulados.`,
        entities: contas.slice(0, 8),
        details: ['Depois, cruze faixa unitária abaixo do limiar de R$ 10 mil com recorrência mínima de envios.'],
      };
    },
  },
  {
    id: 'fracionamento-limiar',
    origem: 'base',
    nivel: 1,
    titulo: 'Fracionamento Sistêmico Abaixo do Limiar Regulatório',
    enquadramento: 'Carta Circular Bacen 4.001/2020 · Inciso I - Fracionamento',
    dossie:
      'Diferente do Caso 1.1, aqui não há uma receptora única: o padrão é o próprio pagador reiterar valores logo abaixo ' +
      'de R$ 10.000,00 para quaisquer favorecidos. O recorte pede quem sustentou essa prática no período.',
    objetivo:
      'Preciso do padrão de fracionamento sistêmico, não do evento isolado. Identifique remetentes que emitiram três ou mais PIX entre R$ 8.000,00 e R$ 9.999,00, para qualquer favorecido, com a quantidade de operações nessa faixa e o volume correspondente.',
    colunasEsperadas: ['conta_origem', 'total_operacoes_fracionadas', 'valor_total_fracionado'],
    ordenacao: 'total_operacoes_fracionadas DESC',
    dicaTexto:
      'Primeiro isole as liquidações cuja faixa unitária está logo abaixo de R$ 10 mil; depois consolide por remetente e mantenha quem repetiu o padrão pelo menos três vezes.',
    dicaSql: `-- WHERE recorta linhas (valor de cada PIX) ANTES de agrupar
-- HAVING recorta grupos (recorrência) DEPOIS de agrupar
SELECT id_conta_origem AS conta_origem,
       COUNT(*)        AS total_operacoes_fracionadas,
       SUM(valor)      AS valor_total_fracionado
FROM transacoes_pix
WHERE valor BETWEEN ... AND ...
GROUP BY id_conta_origem
HAVING COUNT(*) >= ...
ORDER BY total_operacoes_fracionadas DESC;`,
    gabaritoSql: `-- Gabarito · fracionamento sistêmico (R$ 8 mil a R$ 9.999, recorrência ≥ 3)
SELECT
  id_conta_origem AS conta_origem,
  COUNT(*)        AS total_operacoes_fracionadas,
  SUM(valor)      AS valor_total_fracionado
FROM transacoes_pix
WHERE valor BETWEEN 8000 AND 9999
GROUP BY id_conta_origem
HAVING COUNT(*) >= 3;`,
    colunaChave: 'conta_origem',
    rotuloEntidade: { singular: 'remetente', plural: 'remetentes' },
    dicasDivergencia: {
      excesso:
        'Há remetentes a mais. Recorte a faixa unitária `valor BETWEEN 8000 AND 9999` nas linhas e só então `HAVING COUNT(*) >= 3`. Não fixe destino.',
      falta:
        'Faltam remetentes. Os extremos da faixa entram (`8000` e `9999`). Qualquer favorecido vale; o piso de recorrência é 3.',
      valores:
        'Os remetentes estão certos, mas as métricas não. Use `total_operacoes_fracionadas` (`COUNT(*)`) e `valor_total_fracionado` (`SUM(valor)`).',
      ordenacao: 'Os dados estão corretos, mas a ordem não. Ordene pela quantidade de PIX fracionados, da maior para a menor.',
    },
    resumirSucesso(gabarito) {
      const contas = distinct(columnValues(gabarito, 'conta_origem'));
      const total = sum(columnValues(gabarito, 'valor_total_fracionado'));
      return {
        message: `Fracionamento sistêmico: ${gabarito.values.length} remetente(s) com 3+ PIX na faixa R$ 8–9,9 mil, somando ${formatBRL(total)}.`,
        entities: contas.slice(0, 8),
        details: ['Falta combinar frequência e volume no mesmo recorte de grupo (matriz de criticidade).'],
      };
    },
  },
  {
    id: 'matriz-criticidade',
    origem: 'base',
    nivel: 1,
    titulo: 'Matriz de Criticidade: Volume e Recorrência Combinados',
    enquadramento: 'Circular Bacen 3.978/2020 · monitoramento contínuo e abordagem baseada em risco',
    dossie:
      'Alertas isolados de frequência ou de montante geram ruído. A matriz pede quem acumula os dois sinais ao mesmo ' +
      'tempo: rotina mínima de envios e relevância financeira, para a fila de revisão priorizar exposição combinada.',
    objetivo:
      'Monte a matriz de criticidade: frequência e volume ao mesmo tempo. Identifique quem fez pelo menos cinco envios e acumulou R$ 40.000,00 ou mais, trazendo a conta remetente, a quantidade de operações e o montante — quem só tem um dos dois critérios sai da fila.',
    colunasEsperadas: ['conta_origem', 'total_operacoes', 'valor_total'],
    ordenacao: 'valor_total DESC',
    dicaTexto:
      'Consolide por pagador e mantenha só os grupos que atendem às duas condições ao mesmo tempo: quantidade mínima de envios e piso de volume acumulado.',
    dicaSql: `-- Vários predicados agregados no mesmo HAVING, ligados por AND
-- Os dois critérios precisam valer no grupo (não na linha isolada)
SELECT id_conta_origem AS conta_origem,
       COUNT(*)        AS total_operacoes,
       SUM(valor)      AS valor_total
FROM transacoes_pix
GROUP BY id_conta_origem
HAVING COUNT(*) >= ...
   AND SUM(valor) >= ...
ORDER BY valor_total DESC;`,
    gabaritoSql: `-- Gabarito · matriz frequência × volume (≥ 5 envios e ≥ R$ 40 mil)
SELECT
  id_conta_origem AS conta_origem,
  COUNT(*)        AS total_operacoes,
  SUM(valor)      AS valor_total
FROM transacoes_pix
GROUP BY id_conta_origem
HAVING COUNT(*) >= 5
   AND SUM(valor) >= 40000;`,
    colunaChave: 'conta_origem',
    rotuloEntidade: { singular: 'remetente', plural: 'remetentes' },
    dicasDivergencia: {
      excesso:
        'Há remetentes a mais. Os dois cortes são cumulativos: `HAVING COUNT(*) >= 5 AND SUM(valor) >= 40000`. Quem só tem frequência ou só tem volume sai.',
      falta:
        'Faltam remetentes. Os pisos são inclusivos (5 envios e R$ 40.000,00). Não recorte faixa unitária nem destino.',
      valores:
        'Os remetentes estão certos, mas as métricas não. `total_operacoes` é `COUNT(*)` e `valor_total` é `SUM(valor)`.',
      ordenacao: 'Os dados estão corretos, mas a ordem não. Ordene pelo volume acumulado, do maior para o menor.',
    },
    resumirSucesso(gabarito) {
      const contas = distinct(columnValues(gabarito, 'conta_origem'));
      const total = sum(columnValues(gabarito, 'valor_total'));
      return {
        message: `Matriz de criticidade: ${gabarito.values.length} remetente(s) com ≥ 5 envios e ≥ R$ 40 mil, somando ${formatBRL(total)}.`,
        entities: contas.slice(0, 8),
        details: ['No Nível 2 a análise deixa de consolidar grupos e passa a classificar linhas em janelas.'],
      };
    },
  },
  {
    id: 'limiar-noturno',
    origem: 'base',
    nivel: 3,
    titulo: 'Limiar Noturno: Monitoramento de Transferências de Risco',
    enquadramento: 'Resolução BCB 142/2021 · limites de segurança do PIX no período noturno',
    dossie:
      'A Resolução BCB 142/2021 trata o horário noturno como faixa de maior risco de coação, furto de dispositivo e ' +
      'limites reduzidos. A mesa pediu originações de valor relevante liquidadas entre o fim da noite e o início da manhã.',
    objetivo:
      'O recorte noturno é prioridade de segurança. Identifique cada PIX de R$ 1.000,00 ou mais liquidado entre 20h e 6h, com a transação, a conta remetente, a conta favorecida, o valor e o momento da liquidação.',
    colunasEsperadas: ['id_transacao', 'id_conta_origem', 'id_conta_destino', 'valor', 'data_hora'],
    ordenacao: 'data_hora DESC',
    dicaTexto:
      'Combine o piso de valor com o recorte de horário. A madrugada atravessa a meia-noite: nenhuma marcação é, ao mesmo tempo, depois das 20h e antes das 6h — use a união das duas faixas.',
    dicaSql: `-- Nenhuma hora é >= 20:00 E < 06:00 ao mesmo tempo: use OR
SELECT id_transacao, id_conta_origem, id_conta_destino, valor, data_hora
FROM transacoes_pix
WHERE valor >= ...
  AND (time(data_hora) >= '20:00:00' OR time(data_hora) < '06:00:00')
ORDER BY data_hora DESC;`,
    gabaritoSql: `-- Gabarito · PIX noturno ≥ R$ 1.000 (20h–6h, virada da meia-noite)
SELECT
  id_transacao,
  id_conta_origem,
  id_conta_destino,
  valor,
  data_hora
FROM transacoes_pix
WHERE valor >= 1000
  AND (time(data_hora) >= '20:00:00' OR time(data_hora) < '06:00:00');`,
    colunaChave: 'id_transacao',
    rotuloEntidade: { singular: 'transferência', plural: 'transferências' },
    dicasDivergencia: {
      excesso:
        'Há PIX a mais. O piso é `valor >= 1000` e o horário é `(time(data_hora) >= \'20:00:00\' OR time(data_hora) < \'06:00:00\')`. AND no horário esvazia o resultado.',
      falta:
        'Faltam operações. Inclua 20h–23h59 e 00h–05h59. O corte das 6h é exclusivo (`< \'06:00:00\'`). O piso de R$ 1.000,00 é inclusivo.',
      valores: 'As transações estão certas, mas algum campo diverge. Projete origem, destino, valor e data/hora.',
      ordenacao: 'Os dados estão corretos, mas a ordem não. Ordene pela data/hora, da mais recente para a mais antiga.',
    },
    resumirSucesso(gabarito) {
      const total = sum(columnValues(gabarito, 'valor'));
      return {
        message: `Limiar noturno: ${gabarito.values.length} PIX ≥ R$ 1 mil entre 20h e 6h, somando ${formatBRL(total)}.`,
        entities: distinct(columnValues(gabarito, 'id_transacao')).slice(0, 8),
        details: ['O próximo recorte cruza calendário comercial: PJ com envio relevante no fim de semana.'],
      };
    },
  },
  {
    id: 'liquidacoes-fim-de-semana',
    origem: 'base',
    nivel: 3,
    titulo: 'Atipicidade de Calendário: Liquidações em Finais de Semana',
    enquadramento: 'Carta Circular Bacen 4.001/2020 · operações incompatíveis com o objeto social',
    dossie:
      'Pessoas jurídicas raramente liquidam valores elevados no sábado ou no domingo fora de plantão operacional. ' +
      'Envios relevantes nesses dias fogem do ciclo comercial habitual e pedem diligência de atipicidade.',
    objetivo:
      'Quero atividade empresarial fora do ciclo comercial. Identifique cada saída de R$ 15.000,00 ou mais feita por pessoa jurídica no sábado ou no domingo, com o identificador da transação, a razão social, o valor e o momento da liquidação.',
    colunasEsperadas: ['id_transacao', 'razao_social', 'valor', 'data_hora'],
    ordenacao: 'data_hora ASC',
    dicaTexto:
      'Cruze a originação com o cadastro da empresa, recorte o piso de valor e mantenha só liquidações em sábado ou domingo.',
    dicaSql: `-- strftime('%w') devolve o dia da semana: '0' = domingo, '6' = sábado
SELECT t.id_transacao, c.titular AS razao_social, t.valor, t.data_hora
FROM transacoes_pix t
JOIN contas c ON t.id_conta_origem = c.id_conta
WHERE c.tipo_pessoa = 'PJ'
  AND t.valor >= ...
  AND strftime('%w', t.data_hora) IN ('0', '6')
ORDER BY t.data_hora ASC;`,
    gabaritoSql: `-- Gabarito · PIX de PJ ≥ R$ 15 mil no sábado ou domingo
SELECT
  t.id_transacao,
  c.titular AS razao_social,
  t.valor,
  t.data_hora
FROM transacoes_pix t
JOIN contas c ON t.id_conta_origem = c.id_conta
WHERE c.tipo_pessoa = 'PJ'
  AND t.valor >= 15000
  AND strftime('%w', t.data_hora) IN ('0', '6');`,
    colunaChave: 'id_transacao',
    rotuloEntidade: { singular: 'liquidação', plural: 'liquidações' },
    dicasDivergencia: {
      excesso:
        'Há PIX a mais. Mantenha PJ, `valor >= 15000` e `strftime(\'%w\', data_hora) IN (\'0\', \'6\')` (domingo e sábado).',
      falta:
        'Faltam operações. O `%w` do SQLite é texto (`\'0\'` e `\'6\'`, não 0 e 6 numéricos). O piso de R$ 15.000,00 é inclusivo.',
      valores: 'As transações estão certas, mas a razão social ou o valor divergem. `razao_social` é o titular da conta de origem.',
      ordenacao: 'Os dados estão corretos, mas a ordem não. Ordene pela data/hora, da mais antiga para a mais recente.',
    },
    resumirSucesso(gabarito) {
      const total = sum(columnValues(gabarito, 'valor'));
      return {
        message: `Fim de semana: ${gabarito.values.length} envio(s) de PJ ≥ R$ 15 mil, somando ${formatBRL(total)}.`,
        entities: distinct(columnValues(gabarito, 'razao_social')).slice(0, 8),
        details: ['Depois, a incompatibilidade deixa de ser o PIX isolado e passa a ser o volume acumulado versus a renda PF.'],
      };
    },
  },
  {
    id: 'volume-desproporcional-renda',
    origem: 'base',
    nivel: 3,
    titulo: 'Incompatibilidade Cadastral: Volume Desproporcional à Renda',
    enquadramento: 'Circular Bacen 3.978/2020, Art. 38 · incompatibilidade com a capacidade econômico-financeira',
    dossie:
      'Diferente do alerta de um único PIX desproporcional, aqui a mesa soma tudo o que a pessoa física enviou no período ' +
      'e compara com a renda mensal declarada. O recorte captura quem pulveriza valores menores que, juntos, estouram o perfil.',
    objetivo:
      'Diferente do PIX isolado, aqui somamos tudo o que a pessoa física enviou. Identifique a conta e o titular que acumularam envios iguais ou superiores a três vezes a renda mensal declarada, mostrando a renda informada e o total enviado.',
    colunasEsperadas: ['id_conta', 'titular', 'renda_mensal_declarada', 'total_enviado'],
    ordenacao: 'total_enviado DESC',
    dicaTexto:
      'Consolide os envios por cliente PF e compare o volume acumulado com o triplo da renda declarada. Toda coluna cadastral projetada precisa ir junto na consolidação.',
    dicaSql: `-- Colunas não agregadas do SELECT repetem no GROUP BY (ANSI)
-- A comparação com a renda ocorre DEPOIS de somar (HAVING)
SELECT c.id_conta, c.titular, c.renda_mensal_declarada,
       SUM(t.valor) AS total_enviado
FROM contas c
JOIN transacoes_pix t ON c.id_conta = t.id_conta_origem
WHERE c.tipo_pessoa = 'PF'
GROUP BY c.id_conta, c.titular, c.renda_mensal_declarada
HAVING SUM(t.valor) >= 3 * c.renda_mensal_declarada
ORDER BY total_enviado DESC;`,
    gabaritoSql: `-- Gabarito · PF com volume enviado ≥ 3× a renda mensal declarada
SELECT
  c.id_conta,
  c.titular,
  c.renda_mensal_declarada,
  SUM(t.valor) AS total_enviado
FROM contas c
JOIN transacoes_pix t ON c.id_conta = t.id_conta_origem
WHERE c.tipo_pessoa = 'PF'
GROUP BY c.id_conta, c.titular, c.renda_mensal_declarada
HAVING SUM(t.valor) >= 3 * c.renda_mensal_declarada;`,
    colunaChave: 'id_conta',
    rotuloEntidade: { singular: 'cliente', plural: 'clientes' },
    dicasDivergencia: {
      excesso:
        'Há contas a mais. Restrinja a PF, some só envios e corte `HAVING SUM(t.valor) >= 3 * c.renda_mensal_declarada`.',
      falta:
        'Faltam clientes. O múltiplo é inclusivo (3 vezes). Repita `id_conta`, `titular` e `renda_mensal_declarada` no agrupamento.',
      valores:
        'Os identificadores batem, mas renda ou `total_enviado` divergem. `total_enviado` é `SUM(t.valor)` dos PIX de origem.',
      ordenacao: 'Os dados estão corretos, mas a ordem não. Ordene pelo volume enviado, do maior para o menor.',
    },
    resumirSucesso(gabarito) {
      const total = sum(columnValues(gabarito, 'total_enviado'));
      return {
        message: `Incompatibilidade acumulada: ${gabarito.values.length} PF(s) com envios ≥ 3× a renda, somando ${formatBRL(total)}.`,
        entities: distinct(columnValues(gabarito, 'id_conta')).slice(0, 8),
        details: ['O próximo sinal é operacional: muitos disparos na mesma data civil, independentemente do valor unitário.'],
      };
    },
  },
  {
    id: 'rajada-mesma-data',
    origem: 'base',
    nivel: 3,
    titulo: 'Rajada Transacional: Concentração de Disparos na Mesma Data',
    enquadramento: 'Carta Circular Bacen 4.001/2020 · Inciso IV - Alta Frequência',
    dossie:
      'Rajadas no mesmo dia civil sugerem automação, lote de laranjas ou tentativa de esgotar limites. A esteira pede ' +
      'quem originou quatro ou mais liquidações na mesma data, com a contagem e o volume daquele dia.',
    objetivo:
      'Estamos vendo rajada no mesmo dia civil. Identifique a conta remetente, a data civil, a quantidade de disparos e o volume daquele dia quando houver quatro ou mais transferências na mesma data.',
    colunasEsperadas: ['conta_origem', 'data_operacao', 'total_operacoes', 'valor_total_dia'],
    ordenacao: 'total_operacoes DESC, valor_total_dia DESC',
    dicaTexto:
      'Consolide cada pagador por dia (sem a hora) e mantenha só os pares conta–data com pelo menos quatro envios.',
    dicaSql: `-- date(data_hora) trunca o instante para o dia civil (balde diário)
SELECT id_conta_origem AS conta_origem,
       date(data_hora) AS data_operacao,
       COUNT(*)        AS total_operacoes,
       SUM(valor)      AS valor_total_dia
FROM transacoes_pix
GROUP BY id_conta_origem, date(data_hora)
HAVING COUNT(*) >= ...
ORDER BY total_operacoes DESC, valor_total_dia DESC;`,
    gabaritoSql: `-- Gabarito · 4 ou mais PIX da mesma origem no mesmo dia civil
SELECT
  id_conta_origem AS conta_origem,
  date(data_hora) AS data_operacao,
  COUNT(*)        AS total_operacoes,
  SUM(valor)      AS valor_total_dia
FROM transacoes_pix
GROUP BY id_conta_origem, date(data_hora)
HAVING COUNT(*) >= 4;`,
    colunaChave: 'conta_origem',
    rotuloEntidade: { singular: 'conta-dia', plural: 'contas-dia' },
    dicasDivergencia: {
      excesso:
        'Há linhas a mais. Agrupe por origem e `date(data_hora)` (não pela data/hora completa) e corte `HAVING COUNT(*) >= 4`.',
      falta:
        'Faltam rajadas. O piso é inclusivo (4 envios). `data_operacao` é o dia civil (`date(data_hora)`), sem a hora.',
      valores:
        'As contas/datas batem, mas as métricas não. `total_operacoes` é `COUNT(*)` e `valor_total_dia` é `SUM(valor)`.',
      ordenacao: 'Os dados estão corretos, mas a ordem não. Ordene pela quantidade e, em empate, pelo volume do dia.',
    },
    resumirSucesso(gabarito) {
      return {
        message: `Rajadas: ${gabarito.values.length} par(es) conta–data com 4 ou mais envios no mesmo dia civil.`,
        entities: distinct(columnValues(gabarito, 'conta_origem')).slice(0, 8),
        details: ['Falta cruzar a originação com a telemetria de acesso nos quinze minutos anteriores.'],
      };
    },
  },
  {
    id: 'telemetria-ato-janela',
    origem: 'base',
    nivel: 3,
    titulo: 'Telemetria de Acesso: Janela Crítica Pré-Transacional (ATO)',
    enquadramento: 'Circular Bacen 3.978/2020 · canais eletrônicos e indícios de Account Takeover',
    dossie:
      'Account takeover costuma preceder o saque: sessão marcada como não confiável ou suspeita e, em seguida, a ' +
      'originação. A mesa pede o cruzamento em janela curta (até quinze minutos) para não misturar logins antigos com o PIX.',
    objetivo:
      'Account takeover costuma preceder o saque. Cruze a originação com o acesso digital: identifique a conta, a cidade do login, o status do dispositivo, o valor da saída e o momento da liquidação quando o envio ocorrer em até quinze minutos após um acesso classificado como não confiável ou suspeito.',
    colunasEsperadas: ['id_conta', 'geolocalizacao_cidade', 'status_dispositivo', 'valor', 'data_hora'],
    ordenacao: 'data_hora DESC',
    dicaTexto:
      'Associe cada envio ao acesso da mesma conta e meça os segundos entre os dois instantes (no máximo quinze minutos, acesso antes ou no mesmo momento do PIX). Descarte sessões classificadas como confiáveis.',
    dicaSql: `-- unixepoch devolve segundos; 15 min = 900 s. BETWEEN 0 AND 900 evita produto cartesiano frouxo
SELECT t.id_conta_origem AS id_conta,
       a.geolocalizacao_cidade,
       a.status_dispositivo,
       t.valor,
       t.data_hora
FROM transacoes_pix t
JOIN acessos_digitais a ON t.id_conta_origem = a.id_conta
  AND (unixepoch(t.data_hora) - unixepoch(a.data_hora)) BETWEEN 0 AND 900
WHERE a.status_dispositivo != 'CONFIÁVEL'
ORDER BY t.data_hora DESC;`,
    gabaritoSql: `-- Gabarito · PIX até 15 min após acesso não confiável (unixepoch)
SELECT
  t.id_conta_origem AS id_conta,
  a.geolocalizacao_cidade,
  a.status_dispositivo,
  t.valor,
  t.data_hora
FROM transacoes_pix t
JOIN acessos_digitais a ON t.id_conta_origem = a.id_conta
  AND (unixepoch(t.data_hora) - unixepoch(a.data_hora)) BETWEEN 0 AND 900
WHERE a.status_dispositivo != 'CONFIÁVEL';`,
    colunaChave: 'id_conta',
    rotuloEntidade: { singular: 'evento ATO', plural: 'eventos ATO' },
    dicasDivergencia: {
      excesso:
        'Há linhas a mais. A janela é `(unixepoch(t.data_hora) - unixepoch(a.data_hora)) BETWEEN 0 AND 900` e o status não pode ser `CONFIÁVEL`.',
      falta:
        'Faltam eventos. O acesso precisa ser da mesma conta, anterior ou simultâneo ao PIX, em até 900 segundos. `!= \'CONFIÁVEL\'` inclui suspeito e demais status.',
      valores:
        'As contas batem, mas cidade, status, valor ou horário divergem. Projete os cinco campos pedidos; `id_conta` é a origem do PIX.',
      ordenacao: 'Os dados estão corretos, mas a ordem não. Ordene pela data/hora da transação, da mais recente para a mais antiga.',
    },
    resumirSucesso(gabarito) {
      return {
        message: `ATO em janela de 15 min: ${gabarito.values.length} originação(ões) após acesso não confiável.`,
        entities: distinct(columnValues(gabarito, 'id_conta')).slice(0, 8),
        details: ['Os casos homologados seguintes no nível aprofundam rajada subminuto (LAG) e o recorte noturno da Res. BCB 142.'],
      };
    },
  },
  {
    id: 'burst',
    origem: 'base',
    nivel: 3,
    titulo: 'Burst / alta frequência em janela curta',
    enquadramento: 'Carta Circular Bacen 4.001/2020 · Inciso IV - Alta Frequência',
    dossie:
      'Um parceiro de arranjo reportou picos de liquidação via API durante a madrugada envolvendo uma intermediadora de ' +
      'pagamentos e pessoas físicas no Rio de Janeiro. O padrão sugere automação para pulverizar recursos em cadeia ' +
      '(layering) sem propósito comercial aparente.',
    objetivo:
      'Isolar rajada incompatível com uso humano. Identifique a transação, a conta remetente, a conta favorecida, o valor, o momento da liquidação e o intervalo em segundos até o envio imediatamente anterior da mesma conta, quando esse intervalo for de no máximo 60 segundos.',
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
    decomposicao: {
      fase1: {
        titulo: 'Fase 1 — O envelope `WITH`',
        texto:
          'Calcule, linha a linha, o horário do PIX anterior da mesma conta de origem com `LAG(data_hora) OVER (PARTITION BY id_conta_origem ORDER BY data_hora)` e o `intervalo_segundos` (`strftime(\'%s\', …)`). Faça isso no `WITH`: funções de janela não podem ir no `WHERE` do mesmo `SELECT`. Selecione o miolo da CTE e use Testar Seleção / CTE para ver o carimbo antes de filtrar.',
      },
      fase2: {
        titulo: 'Fase 2 — O filtro do `WHERE` externo',
        texto:
          'No `SELECT` externo, isole apenas as linhas já carimbadas em que `intervalo_segundos <= 60` (janela de alta frequência da Carta Circular 4.001/2020). A primeira transação de cada conta não tem `LAG` (`NULL`) e sai nesta fase.',
      },
    },
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
WHERE intervalo_segundos <= 60;      -- janela de alta frequência (inclusiva)`,
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
    id: 'noturno-coacao',
    origem: 'base',
    nivel: 3,
    titulo: 'Nível 3.2 — Transferência Noturna Sob Coação (Sequestro / Madrugada)',
    enquadramento:
      'Carta Circular Bacen 4.001/2020 c/c Resolução BCB 142/2021 (Regulamentação de Limite Noturno do PIX)',
    dossie:
      'A Resolução BCB 142/2021 restringe o PIX noturno precisamente porque sequestro relâmpago, furto de celular e ' +
      'transferência forçada concentram-se entre o fim da noite e a madrugada, quando o titular não opera o aplicativo ' +
      'por rotina comercial. A área de PLD quer a esteira listando originações de valor relevante nesse fuso, inclusive ' +
      'a advogada C005 (perfil estritamente diurno) que passou a enviar PIX elevados a uma intermediadora (C032) após 23h30.',
    objetivo:
      'A Resolução do PIX noturno existe por causa de coação e sequestro relâmpago. Identifique a transação, a conta remetente, a conta favorecida, o valor, o momento da liquidação e a hora civil de originações de R$ 5.000,00 ou mais entre 20h e 5h59, priorizando os maiores valores e, em empate, a ordem cronológica.',
    colunasEsperadas: ['id_transacao', 'conta_origem', 'conta_destino', 'valor', 'data_hora', 'hora_transacao'],
    ordenacao: 'valor DESC, data_hora ASC',
    dicaTexto:
      "Carimbe a hora no envelope com `CAST(strftime('%H', data_hora) AS INTEGER)`. O `WHERE` do SQLite não aceita alias da mesma projeção: " +
      'use a CTE (FASE 1) e filtre `hora_transacao` e `valor` no SELECT externo (FASE 2).',
    dicaSql: `-- FASE 1
WITH envelope_metricas AS (
  SELECT t.id_transacao, t.id_conta_origem AS conta_origem, t.id_conta_destino AS conta_destino,
         t.valor, t.data_hora,
         CAST(strftime('%H', t.data_hora) AS INTEGER) AS hora_transacao
  FROM transacoes_pix t
)
-- FASE 2
SELECT ...
FROM envelope_metricas
WHERE valor >= ...
  AND (hora_transacao >= 20 OR hora_transacao < 6)
ORDER BY ...;`,
    decomposicao: {
      fase1: {
        titulo: 'Fase 1 — O envelope `WITH`',
        texto:
          "Na CTE, projete as colunas de evidência e carimbe `hora_transacao` com `CAST(strftime('%H', data_hora) AS INTEGER)`. Não aplique o recorte noturno nem o limiar de valor aqui — o compilador precisa da coluna já materializada.",
      },
      fase2: {
        titulo: 'Fase 2 — O filtro do `WHERE` externo',
        texto:
          'No inspetor, corte `valor >= 5000` e `(hora_transacao >= 20 OR hora_transacao < 6)` (20h–5h59, horário de Brasília). A Res. BCB 142 trata esse fuso como de risco elevado para PIX forçado.',
      },
    },
    gabaritoSql: `-- FASE 1: O ENVELOPE ANALÍTICO (Criação da linha do tempo e carimbo de métricas linha a linha)
WITH envelope_metricas AS (
  SELECT
    t.id_transacao,
    t.id_conta_origem  AS conta_origem,
    t.id_conta_destino AS conta_destino,
    t.valor,
    t.data_hora,
    -- Hora cheia 0–23 (Brasília); o alias só existe depois desta CTE
    CAST(strftime('%H', t.data_hora) AS INTEGER) AS hora_transacao
  FROM transacoes_pix AS t
)
-- FASE 2: O INSPETOR DE RISCO (Corte regulatório e enriquecimento sobre os dados já carimbados)
SELECT
  id_transacao,
  conta_origem,
  conta_destino,
  valor,
  data_hora,
  hora_transacao
FROM envelope_metricas
WHERE valor >= 5000
  AND (hora_transacao >= 20 OR hora_transacao < 6)  -- noturno / madrugada (Res. BCB 142)
ORDER BY valor DESC, data_hora ASC;`,
    colunaChave: 'id_transacao',
    rotuloEntidade: { singular: 'transação', plural: 'transações' },
    dicasDivergencia: {
      excesso:
        'Há transações a mais. Confira `valor >= 5000` e o recorte `(hora >= 20 OR hora < 6)`. `strftime(\'%H\')` devolve texto; faça o `CAST` no envelope.',
      falta:
        'Faltam transações. Inclua 20h–23h e 00h–05h (`hora < 6`). C005→C032 após 23h30 e rajadas noturnas da C032 com valor ≥ R$ 5 mil devem entrar.',
      valores:
        'As transações estão certas, mas `hora_transacao` diverge. Use `CAST(strftime(\'%H\', data_hora) AS INTEGER)` (0 a 23), sem fuso extra.',
      ordenacao: 'Os dados estão corretos, mas a ordem não. Ordene por `valor DESC, data_hora ASC`.',
    },
    resumirSucesso(gabarito) {
      const origens = distinct(columnValues(gabarito, 'conta_origem'));
      const total = sum(columnValues(gabarito, 'valor'));
      return {
        message: `Recorte noturno da Res. BCB 142: ${gabarito.values.length} PIX ≥ R$ 5 mil entre 20h e 5h59 (${origens.length} origens; volume ${formatBRL(total)}).`,
        entities: origens,
        details: [
          'Compare com o perfil diurno da C005: honorários e rotina comercial não explicam PIX de R$ 8.500 e R$ 9.200 à C032 depois das 23h30 — típico de coação ou drible de limite noturno.',
        ],
      };
    },
  },
  {
    id: 'incompatibilidade',
    origem: 'base',
    nivel: 1,
    titulo: 'Incompatibilidade patrimonial bruta',
    enquadramento: 'Circular Bacen 3.978/2020, Art. 38 c/c Carta Circular 4.001/2020, Inciso II',
    dossie:
      'Comunicação interna aponta que clientes de baixa renda declarada (estudante, aposentada e MEI) passaram a ' +
      'movimentar centenas de milhares de reais em agosto/2026, em operações com uma holding recém-constituída.',
    objetivo:
      'Quero desproporção grave em um único disparo. Identifique a transação, a conta remetente, o titular, a renda mensal declarada, o valor enviado e o grau de distorção quando o disparo equivaler a 30 vezes ou mais a renda de quem originou.',
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
  AND t.valor >= 30 * c.renda_mensal_declarada; -- desproporção grave: 30x a renda mensal`,
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
  {
    id: 'enriquecimento-alto-valor',
    origem: 'base',
    nivel: 2,
    titulo: 'Enriquecimento Cadastral: Remetentes de Alto Valor',
    enquadramento: 'Circular Bacen 3.978/2020 · conhecimento do cliente (KYC) nas operações',
    dossie:
      'A mesa precisa ver, na mesma ficha, o PIX de montante elevado e o perfil de quem envia. Sem o titular e a renda ' +
      'ou faturamento declarados, o valor isolado não sustenta a avaliação de incompatibilidade inicial.',
    objetivo:
      'O valor isolado não fecha o dossiê. Identifique cada PIX de R$ 30.000,00 ou mais com o identificador da transação, o nome de quem envia, a renda ou o faturamento declarado e o momento da liquidação.',
    colunasEsperadas: ['id_transacao', 'titular_remetente', 'renda_mensal_declarada', 'valor', 'data_hora'],
    ordenacao: 'valor DESC',
    dicaTexto:
      'Cruze a liquidação com o cadastro pela conta de origem e mantenha só os envios cujo valor unitário alcança o piso de R$ 30.000,00.',
    dicaSql: `-- JOIN ... ON liga a transação ao cadastro pela chave da conta
SELECT t.id_transacao,
       c.titular AS titular_remetente,
       c.renda_mensal_declarada,
       t.valor,
       t.data_hora
FROM transacoes_pix t
JOIN contas c ON t.id_conta_origem = c.id_conta
WHERE t.valor >= ...
ORDER BY t.valor DESC;`,
    gabaritoSql: `-- Gabarito · enriquecimento cadastral de PIX ≥ R$ 30 mil
SELECT
  t.id_transacao,
  c.titular AS titular_remetente,
  c.renda_mensal_declarada,
  t.valor,
  t.data_hora
FROM transacoes_pix t
JOIN contas c ON t.id_conta_origem = c.id_conta
WHERE t.valor >= 30000;`,
    colunaChave: 'id_transacao',
    rotuloEntidade: { singular: 'transferência', plural: 'transferências' },
    dicasDivergencia: {
      excesso:
        'Há PIX a mais. Cruze pela origem (`t.id_conta_origem = c.id_conta`) e recorte `t.valor >= 30000`.',
      falta:
        'Faltam operações. O piso é inclusivo (R$ 30.000,00). Não restrinja tipo de pessoa, canal ou destino.',
      valores:
        'As transações estão certas, mas algum campo diverge. `titular_remetente` vem do cadastro; `renda_mensal_declarada` e `valor`/`data_hora` da ficha e da liquidação.',
      ordenacao: 'Os dados estão corretos, mas a ordem não. Ordene pelo valor, do maior para o menor.',
    },
    resumirSucesso(gabarito) {
      const total = sum(columnValues(gabarito, 'valor'));
      return {
        message: `Enriquecimento: ${gabarito.values.length} PIX ≥ R$ 30 mil, com titular e renda/faturamento, somando ${formatBRL(total)}.`,
        entities: distinct(columnValues(gabarito, 'titular_remetente')).slice(0, 8),
        details: ['O próximo recorte sai da transação e entra no quadro de administradores das PJ.'],
      };
    },
  },
  {
    id: 'quadro-societario-admin',
    origem: 'base',
    nivel: 2,
    titulo: 'Quadro Societário: Representação e Administração PJ',
    enquadramento: 'Circular Bacen 3.978/2020 · identificação de administradores e beneficiários',
    dossie:
      'Para escrutínio de pessoa jurídica, a esteira precisa saber quem assina pela empresa. O recorte pede sócios com ' +
      'poderes de administração formalmente designados no quadro societário, com razão social e participação detida.',
    objetivo:
      'Para escrutínio de pessoa jurídica, preciso saber quem assina pela empresa. Liste as PJ com sócio formalmente designado como administrador, trazendo a razão social, o nome de quem administra e a fatia do capital detida.',
    colunasEsperadas: ['razao_social', 'nome_administrador', 'percentual_participacao'],
    ordenacao: 'razao_social ASC',
    dicaTexto:
      'Associe o cadastro empresarial ao quadro de sócios e mantenha apenas pessoas jurídicas cujo sócio esteja marcado como administrador.',
    dicaSql: `-- Cadastro da empresa + quadro de sócios; eh_administrador = 1
SELECT c.titular AS razao_social,
       s.nome_socio AS nome_administrador,
       s.percentual_participacao
FROM contas c
JOIN socios_empresas s ON c.id_conta = s.id_conta_empresa
WHERE c.tipo_pessoa = '...'
  AND s.eh_administrador = ...
ORDER BY c.titular ASC;`,
    gabaritoSql: `-- Gabarito · administradores do quadro societário (PJ)
SELECT
  c.titular AS razao_social,
  s.nome_socio AS nome_administrador,
  s.percentual_participacao
FROM contas c
JOIN socios_empresas s ON c.id_conta = s.id_conta_empresa
WHERE c.tipo_pessoa = 'PJ'
  AND s.eh_administrador = 1;`,
    colunaChave: 'razao_social',
    rotuloEntidade: { singular: 'administrador', plural: 'administradores' },
    dicasDivergencia: {
      excesso:
        'Há linhas a mais. Restrinja a PJ (`tipo_pessoa = \'PJ\'`) e a quem tem poderes de administração (`eh_administrador = 1`).',
      falta:
        'Faltam administradores. Cruze `contas` com `socios_empresas` pela conta da empresa e não corte percentual mínimo.',
      valores:
        'As empresas estão certas, mas nome ou participação divergem. `razao_social` é o titular da PJ; `nome_administrador` é o sócio administrador.',
      ordenacao: 'Os dados estão corretos, mas a ordem não. Ordene pela razão social, em ordem alfabética.',
    },
    resumirSucesso(gabarito) {
      return {
        message: `Quadro societário: ${gabarito.values.length} administrador(es) com poderes formais nas PJ cadastradas.`,
        entities: distinct(columnValues(gabarito, 'razao_social')).slice(0, 8),
        details: ['Em seguida, a esteira olha quem está no cadastro mas não originou nenhum PIX no período.'],
      };
    },
  },
  {
    id: 'contas-dormentes',
    origem: 'base',
    nivel: 2,
    titulo: 'Contas Dormentes: Ausência Total de Movimentação Ativa',
    enquadramento: 'Circular Bacen 3.978/2020 · monitoramento de contas sem movimentação',
    dossie:
      'Contas abertas sem nenhum envio no período merecem revisão de uso e de risco de dormência. O recorte pede o ' +
      'cadastro completo de quem não originou transferência, ainda que possa ter recebido créditos.',
    objetivo:
      'Conta aberta sem nenhum envio no período merece revisão de dormência. Identifique a conta, o titular e o tipo de pessoa de quem não originou transferência — ainda que possa ter recebido crédito.',
    colunasEsperadas: ['id_conta', 'titular', 'tipo_pessoa'],
    ordenacao: 'id_conta ASC',
    dicaTexto:
      'Parta de todo o cadastro e preserve quem não encontra correspondência como remetente nas liquidações — a ausência de envio é o sinal, não a falta de crédito recebido.',
    dicaSql: `-- LEFT JOIN mantém todos os cadastros; IS NULL aponta quem não enviou
SELECT c.id_conta, c.titular, c.tipo_pessoa
FROM contas c
LEFT JOIN transacoes_pix t ON c.id_conta = t.id_conta_origem
WHERE t.id_transacao IS NULL
ORDER BY c.id_conta ASC;`,
    gabaritoSql: `-- Gabarito · contas sem nenhum PIX enviado
SELECT
  c.id_conta,
  c.titular,
  c.tipo_pessoa
FROM contas c
LEFT JOIN transacoes_pix t ON c.id_conta = t.id_conta_origem
WHERE t.id_transacao IS NULL;`,
    colunaChave: 'id_conta',
    rotuloEntidade: { singular: 'conta dormente', plural: 'contas dormentes' },
    dicasDivergencia: {
      excesso:
        'Há contas a mais. O sinal é ausência de envio (`t.id_transacao IS NULL` após cruzar a origem). Não use junção interna: ela elimina quem não enviou.',
      falta:
        'Faltam contas. Parta de `contas` e cruze à esquerda com PIX pela origem. Quem só recebeu (e nunca enviou) deve entrar.',
      valores: 'Os identificadores batem, mas titular ou tipo de pessoa divergem. Projete os três campos cadastrais pedidos.',
      ordenacao: 'Os dados estão corretos, mas a ordem não. Ordene pelo identificador da conta.',
    },
    resumirSucesso(gabarito) {
      return {
        message: `Dormentes: ${gabarito.values.length} conta(s) sem nenhum envio no período monitorado.`,
        entities: distinct(columnValues(gabarito, 'id_conta')).slice(0, 8),
        details: ['O próximo recorte volta aos PEP, agora consolidando a volumetria enviada por titular.'],
      };
    },
  },
  {
    id: 'volumetria-pep',
    origem: 'base',
    nivel: 2,
    titulo: 'Monitoramento Agregado de PEP: Volumetria por Titular Classificado',
    enquadramento: 'Circular Bacen 3.978/2020 · escrutínio reforçado de PEP',
    dossie:
      'A triagem cadastral de PEP (Nível 0) lista quem está marcado no cadastro. Aqui a mesa pede o comportamento ' +
      'financeiro desses titulares: quantos envios e qual o montante acumulado, com a ocupação declarada.',
    objetivo:
      'A triagem cadastral de PEP já existe; agora quero o comportamento financeiro. Consolide, por titular classificado como Pessoa Exposta Politicamente, a ocupação declarada, quantos envios fez e o montante enviado.',
    colunasEsperadas: ['titular_pep', 'ocupacao', 'total_operacoes', 'valor_total_enviado'],
    ordenacao: 'valor_total_enviado DESC',
    dicaTexto:
      'Cruze o cadastro com as originações, mantenha só quem está classificado como PEP e consolide por titular e ocupação as métricas de quantidade e volume.',
    dicaSql: `-- JOIN + recorte cadastral + consolidação por titular
SELECT c.titular AS titular_pep,
       c.ocupacao,
       COUNT(t.id_transacao) AS total_operacoes,
       SUM(t.valor)          AS valor_total_enviado
FROM contas c
JOIN transacoes_pix t ON c.id_conta = t.id_conta_origem
WHERE c.eh_pep = ...
GROUP BY c.titular, c.ocupacao
ORDER BY valor_total_enviado DESC;`,
    gabaritoSql: `-- Gabarito · volumetria enviada por titular PEP
SELECT
  c.titular AS titular_pep,
  c.ocupacao,
  COUNT(t.id_transacao) AS total_operacoes,
  SUM(t.valor)          AS valor_total_enviado
FROM contas c
JOIN transacoes_pix t ON c.id_conta = t.id_conta_origem
WHERE c.eh_pep = 1
GROUP BY c.titular, c.ocupacao;`,
    colunaChave: 'titular_pep',
    rotuloEntidade: { singular: 'titular PEP', plural: 'titulares PEP' },
    dicasDivergencia: {
      excesso:
        'Há titulares a mais. Mantenha só `eh_pep = 1` e agrupe por titular e ocupação. A junção é pela conta de origem (envios).',
      falta:
        'Faltam PEP. Quem está marcado no cadastro e enviou ao menos um PIX deve entrar. Use `COUNT(t.id_transacao)` e `SUM(t.valor)`.',
      valores:
        'Os titulares estão certos, mas as métricas não. `total_operacoes` conta envios e `valor_total_enviado` soma os valores.',
      ordenacao: 'Os dados estão corretos, mas a ordem não. Ordene pelo montante enviado, do maior para o menor.',
    },
    resumirSucesso(gabarito) {
      const total = sum(columnValues(gabarito, 'valor_total_enviado'));
      return {
        message: `PEP: ${gabarito.values.length} titular(es) com envios no período, somando ${formatBRL(total)}.`,
        entities: distinct(columnValues(gabarito, 'titular_pep')),
        details: ['Falta identificar remetente e favorecido na mesma liquidação, ambos no cadastro da instituição.'],
      };
    },
  },
  {
    id: 'fluxos-intrabanco',
    origem: 'base',
    nivel: 2,
    titulo: 'Fluxos Intrabanco: Identificação Completa de Remetente e Favorecido',
    enquadramento: 'Circular Bacen 3.978/2020 · rastreabilidade de origem e destino',
    dossie:
      'Cada PIX do laboratório liquida entre contas da própria base. A mesa quer a ficha nominal dos dois polos — quem ' +
      'envia e quem recebe — para seguir o dinheiro sem ficar só nos identificadores de conta.',
    objetivo:
      'Cada liquidação deste laboratório fecha entre correntistas nossos. Identifique a transação, o nome de quem envia, o nome de quem recebe e o valor transferido — sem ficar só no código da conta.',
    colunasEsperadas: ['id_transacao', 'titular_remetente', 'titular_destinatario', 'valor'],
    ordenacao: 'valor DESC',
    dicaTexto:
      'Relacione a liquidação duas vezes com o cadastro: uma pela conta de origem (remetente) e outra pela conta de destino (favorecido), cada polo com o seu apelido.',
    dicaSql: `-- A mesma tabela contas entra duas vezes, com aliases distintos
SELECT t.id_transacao,
       rem.titular AS titular_remetente,
       des.titular AS titular_destinatario,
       t.valor
FROM transacoes_pix t
JOIN contas rem ON t.id_conta_origem = rem.id_conta
JOIN contas des ON t.id_conta_destino = des.id_conta
ORDER BY t.valor DESC;`,
    gabaritoSql: `-- Gabarito · remetente e favorecido na mesma liquidação
SELECT
  t.id_transacao,
  rem.titular AS titular_remetente,
  des.titular AS titular_destinatario,
  t.valor
FROM transacoes_pix t
JOIN contas rem ON t.id_conta_origem = rem.id_conta
JOIN contas des ON t.id_conta_destino = des.id_conta;`,
    colunaChave: 'id_transacao',
    rotuloEntidade: { singular: 'transferência', plural: 'transferências' },
    dicasDivergencia: {
      excesso:
        'Há PIX a mais. Não há recorte de valor: qualquer liquidação entre duas contas cadastradas entra. Confira se não duplicou junções.',
      falta:
        'Faltam operações. Cruze origem e destino com `contas` (aliases distintos). Toda liquidação da base tem os dois polos cadastrados.',
      valores:
        'Os identificadores batem, mas os nomes divergem. `titular_remetente` vem da origem; `titular_destinatario` vem do destino.',
      ordenacao: 'Os dados estão corretos, mas a ordem não. Ordene pelo valor, do maior para o menor.',
    },
    resumirSucesso(gabarito) {
      const total = sum(columnValues(gabarito, 'valor'));
      return {
        message: `Intrabanco: ${gabarito.values.length} liquidação(ões) com remetente e favorecido nominais, somando ${formatBRL(total)}.`,
        entities: distinct(columnValues(gabarito, 'id_transacao')).slice(0, 8),
        details: ['O caso homologado seguinte no mesmo nível desduplica o pico diário por conta (classificação posicional).'],
      };
    },
  },
  {
    id: 'pico-diario',
    origem: 'base',
    nivel: 2,
    titulo: 'Pico individual por conta no dia 18/08 (ROW_NUMBER)',
    enquadramento: 'Carta Circular Bacen 4.001/2020 · Alta Frequência e Valores Atípicos',
    dossie:
      'Na madrugada de 18/08/2026 o monitoramento disparou dezenas de alertas para o mesmo dia, muitos repetidos para as ' +
      'mesmas contas. Para priorizar a fila, a gestão de PLD pediu uma visão desduplicada: uma única linha por conta de ' +
      'origem, mostrando o maior PIX enviado no dia e o volume total que a conta movimentou.',
    objetivo:
      'No dia 18/08/2026 a fila explodiu com alertas repetidos. Preciso de uma visão desduplicada: identifique a conta remetente, a transação do maior PIX daquele dia (em empate de valor, vale o mais antigo), o valor de pico, o momento da liquidação, quantos envios a conta fez e o volume total do dia.',
    colunasEsperadas: ['conta_origem', 'id_transacao', 'maior_pix', 'data_hora', 'qtd_no_dia', 'total_no_dia'],
    ordenacao: 'maior_pix DESC, conta_origem',
    dicaTexto:
      'Numere os PIX de cada conta numa CTE (posição 1 = maior valor) e, na consulta externa, mantenha só a posição 1. ' +
      'COUNT e SUM com OVER (PARTITION BY ...) trazem os totais do dia sem colapsar as linhas como o GROUP BY faria.',
    dicaSql: `WITH pix_do_dia AS (
  SELECT *,
         ROW_NUMBER() OVER (
           PARTITION BY id_conta_origem
           ORDER BY valor DESC, data_hora ASC
         ) AS posicao,
         COUNT(*)   OVER (PARTITION BY ...) AS qtd_no_dia,
         SUM(valor) OVER (PARTITION BY ...) AS soma_no_dia
  FROM transacoes_pix
  WHERE data_hora >= '...' AND data_hora < '...'
)
SELECT ...
FROM pix_do_dia
WHERE posicao = ...
ORDER BY ...;`,
    gabaritoSql: `-- Gabarito comentado · Pico individual por conta (ROW_NUMBER)
WITH pix_do_dia AS (
  SELECT
    t.id_conta_origem AS conta_origem,
    t.id_transacao,
    t.valor,
    t.data_hora,
    ROW_NUMBER() OVER (                   -- numera os PIX de cada conta...
      PARTITION BY t.id_conta_origem      -- ...reiniciando a contagem por remetente
      ORDER BY t.valor DESC,              -- 1 = maior valor do dia
               t.data_hora ASC            -- desempate determinístico: o PIX mais antigo
    ) AS posicao,
    COUNT(*)     OVER (PARTITION BY t.id_conta_origem) AS qtd_no_dia,   -- janela sem ORDER BY = total da partição
    SUM(t.valor) OVER (PARTITION BY t.id_conta_origem) AS soma_no_dia
  FROM transacoes_pix AS t
  WHERE t.data_hora >= '2026-08-18 00:00:00'   -- intervalo semiaberto: cobre o dia inteiro
    AND t.data_hora <  '2026-08-19 00:00:00'   -- e continua usando o índice de data_hora
)
SELECT
  conta_origem,
  id_transacao,
  valor                 AS maior_pix,
  data_hora,
  qtd_no_dia,
  ROUND(soma_no_dia, 2) AS total_no_dia
FROM pix_do_dia
WHERE posicao = 1;                      -- desduplicação: só o pico de cada conta`,
    colunaChave: 'conta_origem',
    rotuloEntidade: { singular: 'conta', plural: 'contas' },
    dicasDivergencia: {
      excesso:
        'Há linhas a mais: provavelmente mais de um PIX por conta. Filtre `posicao = 1` na consulta externa e garanta que o `PARTITION BY` é só `id_conta_origem`.',
      falta:
        'Faltam contas. Confira o recorte do dia (`>= 2026-08-18 00:00:00` e `< 2026-08-19 00:00:00`) e se nenhum filtro extra eliminou contas com um único PIX.',
      valores:
        'As contas estão certas, mas algum valor diverge. Se for `id_transacao`/`data_hora`, revise o desempate (`ORDER BY valor DESC, data_hora ASC`); se for `qtd_no_dia`/`total_no_dia`, use `COUNT`/`SUM` com `OVER (PARTITION BY id_conta_origem)` sobre todos os PIX do dia.',
      ordenacao: 'Os dados estão corretos, mas a ordem não. Ordene por `maior_pix DESC, conta_origem`.',
    },
    resumirSucesso(gabarito) {
      const contas = distinct(columnValues(gabarito, 'conta_origem'));
      const qtd = columnValues(gabarito, 'qtd_no_dia').map(Number);
      const rajadas = contas.flatMap((conta, i) => ((qtd[i] ?? 0) > 1 ? [`${conta} (${qtd[i]} PIX)`] : []));
      return {
        message: `Fila desduplicada! ${gabarito.values.length} contas, uma linha cada. ${rajadas.join(' e ')} enviaram vários PIX em poucos minutos, o que as coloca no topo da priorização.`,
        entities: contas,
        details: [
          'Repare no empate da C031 (dois PIX de R$ 4.990,00): sem o desempate por `data_hora`, o ROW_NUMBER escolheria um deles de forma arbitrária, e o resultado mudaria de uma execução para outra.',
        ],
      };
    },
  },
  {
    id: 'sequenciamento-cronologico',
    origem: 'base',
    nivel: 4,
    titulo: 'Rastreamento Cronológico: Sequenciamento de Operações por Conta',
    enquadramento: 'Circular Bacen 3.978/2020 · reconstituição da linha do tempo transacional',
    dossie:
      'A mesa precisa reconstruir a ordem dos envios de cada titular: qual foi o primeiro PIX, o segundo, o terceiro. ' +
      'Essa numeração cronológica é a base para cadência, salto de valor e acúmulo patrimonial nos recortes seguintes.',
    objetivo:
      'A mesa precisa reconstruir a linha do tempo de cada titular. Identifique a transação, a conta remetente, o momento, o valor e o número de ordem de cada envio, começando em 1 na primeira operação histórica de cada conta.',
    colunasEsperadas: ['id_transacao', 'id_conta_origem', 'data_hora', 'valor', 'sequencial_operacao'],
    ordenacao: 'id_conta_origem ASC, sequencial_operacao ASC',
    dicaTexto:
      'Numere os envios dentro de cada conta na ordem do tempo. Se dois PIX caírem no mesmo instante, use o identificador da liquidação como desempate estável.',
    dicaSql: `-- ROW_NUMBER reinicia em cada conta (PARTITION BY)
-- ORDER BY data_hora, id_transacao evita empate aleatório
SELECT id_transacao, id_conta_origem, data_hora, valor,
       ROW_NUMBER() OVER (
         PARTITION BY id_conta_origem
         ORDER BY data_hora ASC, id_transacao ASC
       ) AS sequencial_operacao
FROM transacoes_pix
ORDER BY id_conta_origem ASC, sequencial_operacao ASC;`,
    gabaritoSql: `-- Gabarito · sequencial cronológico por origem (desempate por id_transacao)
SELECT
  id_transacao,
  id_conta_origem,
  data_hora,
  valor,
  ROW_NUMBER() OVER (
    PARTITION BY id_conta_origem
    ORDER BY data_hora ASC, id_transacao ASC
  ) AS sequencial_operacao
FROM transacoes_pix
ORDER BY id_conta_origem ASC, sequencial_operacao ASC;`,
    colunaChave: 'id_transacao',
    rotuloEntidade: { singular: 'transferência', plural: 'transferências' },
    dicasDivergencia: {
      excesso:
        'Há linhas a mais. Não recorte valor nem período: toda originação entra, com um número por conta.',
      falta:
        'Faltam transações. Não filtre contas. O sequencial começa em 1 na operação mais antiga de cada origem.',
      valores:
        'Os identificadores batem, mas `sequencial_operacao` diverge. Use `ROW_NUMBER() OVER (PARTITION BY id_conta_origem ORDER BY data_hora ASC, id_transacao ASC)`.',
      ordenacao: 'Os dados estão corretos, mas a ordem não. Ordene por conta de origem e, dentro dela, pelo sequencial.',
    },
    resumirSucesso(gabarito) {
      return {
        message: `Linha do tempo: ${gabarito.values.length} envio(s) numerados cronologicamente por conta de origem.`,
        entities: distinct(columnValues(gabarito, 'id_conta_origem')).slice(0, 8),
        details: ['O próximo recorte fica só com o envio mais recente de cada pagador.'],
      };
    },
  },
  {
    id: 'ultima-movimentacao',
    origem: 'base',
    nivel: 4,
    titulo: 'Marco Recente: Identificação da Última Movimentação Ativa',
    enquadramento: 'Circular Bacen 3.978/2020 · última posição transacional do cliente',
    dossie:
      'Para fila de revisão e contato com o titular, a esteira precisa da última originação de cada conta — não do maior ' +
      'valor, e sim do envio mais recente no relógio. Empates de horário exigem desempate estável pelo identificador.',
    objetivo:
      'Para a fila de revisão, quero só a última movimentação ativa de cada pagador — o envio mais recente no relógio, não o de maior valor. Identifique a transação, a conta remetente, a conta favorecida, o valor e o momento da liquidação.',
    colunasEsperadas: ['id_transacao', 'id_conta_origem', 'id_conta_destino', 'valor', 'data_hora'],
    ordenacao: 'data_hora DESC',
    dicaTexto:
      'Primeiro numere os envios de cada conta do mais recente para o mais antigo; depois mantenha só a posição 1. O recorte da posição não pode ir na mesma etapa em que o número é calculado.',
    dicaSql: `-- SQLite não filtra função de janela no WHERE do mesmo SELECT
-- Fase 1 (WITH): carimba o ranking; Fase 2: ranking_recente = 1
WITH operacoes_ranqueadas AS (
  SELECT ...,
         ROW_NUMBER() OVER (
           PARTITION BY id_conta_origem
           ORDER BY data_hora DESC, id_transacao DESC
         ) AS ranking_recente
  FROM transacoes_pix
)
SELECT id_transacao, id_conta_origem, id_conta_destino, valor, data_hora
FROM operacoes_ranqueadas
WHERE ranking_recente = 1
ORDER BY data_hora DESC;`,
    gabaritoSql: `-- Gabarito · último PIX de cada origem (CTE em duas fases)
WITH operacoes_ranqueadas AS (
  SELECT
    id_transacao,
    id_conta_origem,
    id_conta_destino,
    valor,
    data_hora,
    ROW_NUMBER() OVER (
      PARTITION BY id_conta_origem
      ORDER BY data_hora DESC, id_transacao DESC
    ) AS ranking_recente
  FROM transacoes_pix
)
SELECT
  id_transacao,
  id_conta_origem,
  id_conta_destino,
  valor,
  data_hora
FROM operacoes_ranqueadas
WHERE ranking_recente = 1;`,
    colunaChave: 'id_transacao',
    rotuloEntidade: { singular: 'última movimentação', plural: 'últimas movimentações' },
    dicasDivergencia: {
      excesso:
        'Há mais de uma linha por conta. Carimbe o ranking do mais recente para o mais antigo e filtre `ranking_recente = 1` na consulta externa.',
      falta:
        'Faltam contas. Toda origem que enviou ao menos um PIX deve aparecer. Desempate com `id_transacao DESC` no mesmo instante.',
      valores:
        'As contas batem, mas destino, valor ou horário divergem. A linha é a mais recente da origem, não o maior valor.',
      ordenacao: 'Os dados estão corretos, mas a ordem não. Ordene pela data/hora da última movimentação, da mais nova para a mais antiga.',
    },
    resumirSucesso(gabarito) {
      return {
        message: `Última posição: ${gabarito.values.length} conta(s) de origem com o envio mais recente isolado.`,
        entities: distinct(columnValues(gabarito, 'id_conta_origem')).slice(0, 8),
        details: ['Em seguida, a esteira mede os segundos entre um envio e o anterior da mesma conta.'],
      };
    },
  },
  {
    id: 'intervalo-entre-disparos',
    origem: 'base',
    nivel: 4,
    titulo: 'Velocidade Transacional: Intervalo Temporal entre Disparos',
    enquadramento: 'Carta Circular Bacen 4.001/2020 · Inciso IV - Alta Frequência',
    dossie:
      'A cadência entre envios sucessivos distingue uso humano de automação. A mesa pede, ao lado de cada PIX, o horário ' +
      'do disparo anterior da mesma conta e quantos segundos separam os dois — o primeiro envio de cada titular fica sem antecessor.',
    objetivo:
      'A cadência entre disparos distingue uso humano de automação. Identifique a transação, a conta remetente, o momento atual, o horário do disparo anterior da mesma conta e quantos segundos separam os dois — o primeiro de cada titular fica sem antecessor.',
    colunasEsperadas: ['id_transacao', 'id_conta_origem', 'data_hora', 'data_hora_anterior', 'intervalo_segundos'],
    ordenacao: 'id_conta_origem ASC, data_hora ASC',
    dicaTexto:
      'Para cada envio, busque o horário imediatamente anterior da mesma conta e converta a diferença para segundos. O marco zero de cada titular não tem operação prévia.',
    dicaSql: `-- LAG pega a marcação anterior na mesma partição
-- unixepoch transforma data/hora em segundos (a 1ª linha de cada conta fica NULL)
SELECT id_transacao, id_conta_origem, data_hora,
       LAG(data_hora) OVER (
         PARTITION BY id_conta_origem
         ORDER BY data_hora ASC, id_transacao ASC
       ) AS data_hora_anterior,
       (unixepoch(data_hora) - unixepoch(LAG(data_hora) OVER (
         PARTITION BY id_conta_origem
         ORDER BY data_hora ASC, id_transacao ASC
       ))) AS intervalo_segundos
FROM transacoes_pix
ORDER BY id_conta_origem ASC, data_hora ASC;`,
    gabaritoSql: `-- Gabarito · intervalo em segundos até o PIX anterior da mesma origem
SELECT
  id_transacao,
  id_conta_origem,
  data_hora,
  LAG(data_hora) OVER (
    PARTITION BY id_conta_origem
    ORDER BY data_hora ASC, id_transacao ASC
  ) AS data_hora_anterior,
  (unixepoch(data_hora) - unixepoch(LAG(data_hora) OVER (
    PARTITION BY id_conta_origem
    ORDER BY data_hora ASC, id_transacao ASC
  ))) AS intervalo_segundos
FROM transacoes_pix;`,
    colunaChave: 'id_transacao',
    rotuloEntidade: { singular: 'transferência', plural: 'transferências' },
    dicasDivergencia: {
      excesso:
        'Há linhas a mais. Não recorte intervalo mínimo: o recorte pede todos os envios, inclusive o primeiro de cada conta (sem antecessor).',
      falta:
        'Faltam transações. Particione só pela origem e desempate por `data_hora, id_transacao`. Não elimine nulos da primeira operação.',
      valores:
        'Os identificadores batem, mas o intervalo diverge. `intervalo_segundos` é `unixepoch(data_hora) - unixepoch(LAG(data_hora) ...)`.',
      ordenacao: 'Os dados estão corretos, mas a ordem não. Ordene por origem e, dentro dela, pela data/hora crescente.',
    },
    resumirSucesso(gabarito) {
      return {
        message: `Cadência: ${gabarito.values.length} envio(s) com o horário anterior e o intervalo em segundos.`,
        entities: distinct(columnValues(gabarito, 'id_conta_origem')).slice(0, 8),
        details: ['O próximo recorte soma o patrimônio enviado até cada instante da linha do tempo.'],
      };
    },
  },
  {
    id: 'montante-acumulado',
    origem: 'base',
    nivel: 4,
    titulo: 'Curva Financeira: Evolução do Volume Acumulado no Tempo',
    enquadramento: 'Circular Bacen 3.978/2020 · evolução da movimentação do cliente',
    dossie:
      'O volume acumulado até cada PIX mostra quando a conta sai do perfil e entra em exposição relevante. A esteira ' +
      'pede a curva crescente por titular: cada linha traz o valor da operação e o total enviado até aquele momento.',
    objetivo:
      'Quero a curva de exposição de cada cliente. Identifique a transação, a conta remetente, o momento, o valor do envio e quanto aquela conta já tinha movimentado até aquele instante — incluindo a operação corrente.',
    colunasEsperadas: ['id_transacao', 'id_conta_origem', 'data_hora', 'valor', 'montante_acumulado'],
    ordenacao: 'id_conta_origem ASC, data_hora ASC',
    dicaTexto:
      'Some os valores da mesma conta em ordem cronológica, incluindo o envio corrente na soma até aquele ponto da linha do tempo.',
    dicaSql: `-- SUM analítico: frame da primeira linha da conta até a linha atual
SELECT id_transacao, id_conta_origem, data_hora, valor,
       SUM(valor) OVER (
         PARTITION BY id_conta_origem
         ORDER BY data_hora ASC, id_transacao ASC
         ROWS BETWEEN UNBOUNDED PRECEDING AND CURRENT ROW
       ) AS montante_acumulado
FROM transacoes_pix
ORDER BY id_conta_origem ASC, data_hora ASC;`,
    gabaritoSql: `-- Gabarito · montante acumulado até o PIX corrente (por origem)
SELECT
  id_transacao,
  id_conta_origem,
  data_hora,
  valor,
  SUM(valor) OVER (
    PARTITION BY id_conta_origem
    ORDER BY data_hora ASC, id_transacao ASC
    ROWS BETWEEN UNBOUNDED PRECEDING AND CURRENT ROW
  ) AS montante_acumulado
FROM transacoes_pix;`,
    colunaChave: 'id_transacao',
    rotuloEntidade: { singular: 'transferência', plural: 'transferências' },
    dicasDivergencia: {
      excesso:
        'Há linhas a mais. Não recorte valor: toda originação entra na curva, com o acumulado até aquele instante.',
      falta:
        'Faltam transações. O acumulado inclui o PIX atual (`ROWS BETWEEN UNBOUNDED PRECEDING AND CURRENT ROW`).',
      valores:
        'Os identificadores batem, mas `montante_acumulado` diverge. Some `valor` na partição da origem, em ordem cronológica com desempate por `id_transacao`.',
      ordenacao: 'Os dados estão corretos, mas a ordem não. Ordene por origem e data/hora crescente.',
    },
    resumirSucesso(gabarito) {
      return {
        message: `Curva acumulada: ${gabarito.values.length} envio(s) com o montante até cada instante da linha do tempo.`,
        entities: distinct(columnValues(gabarito, 'id_conta_origem')).slice(0, 8),
        details: ['Falta comparar cada valor com o envio imediatamente anterior e expurgar o marco zero.'],
      };
    },
  },
  {
    id: 'salto-variacao-consecutiva',
    origem: 'base',
    nivel: 4,
    titulo: 'Salto Atípico: Variação Patrimonial Brusca em Envios Consecutivos',
    enquadramento: 'Carta Circular Bacen 4.001/2020 · mudança abrupta de padrão transacional',
    dossie:
      'Saltos de valor entre PIX consecutivos da mesma conta indicam aquecimento, teste de canal ou mudança de propósito. ' +
      'A mesa pede a diferença entre o envio atual e o anterior, descartando a primeira operação — que não tem base de comparação.',
    objetivo:
      'Saltos de valor entre PIX consecutivos indicam aquecimento de canal. Identifique a transação e a conta remetente, compare o valor atual com o valor anterior da mesma conta, traga a diferença absoluta (pode ser negativa) e descarte a primeira operação — ela não tem base de comparação.',
    colunasEsperadas: ['id_transacao', 'id_conta_origem', 'valor_anterior', 'valor_atual', 'variacao_absoluta'],
    ordenacao: 'variacao_absoluta DESC',
    dicaTexto:
      'Carimbe o valor do envio anterior na mesma conta e, na etapa seguinte, elimine quem não tem antecessor. A variação é o valor atual menos o anterior (pode ser negativa).',
    dicaSql: `-- Fase 1: LAG(valor) na linha do tempo da conta
-- Fase 2: WHERE valor_anterior IS NOT NULL (expurga o marco zero)
WITH historico_valores AS (
  SELECT id_transacao, id_conta_origem, valor AS valor_atual,
         LAG(valor) OVER (
           PARTITION BY id_conta_origem
           ORDER BY data_hora ASC, id_transacao ASC
         ) AS valor_anterior
  FROM transacoes_pix
)
SELECT id_transacao, id_conta_origem, valor_anterior, valor_atual,
       (valor_atual - valor_anterior) AS variacao_absoluta
FROM historico_valores
WHERE valor_anterior IS NOT NULL
ORDER BY variacao_absoluta DESC;`,
    gabaritoSql: `-- Gabarito · variação vs. PIX anterior (sem a primeira operação da conta)
WITH historico_valores AS (
  SELECT
    id_transacao,
    id_conta_origem,
    valor AS valor_atual,
    LAG(valor) OVER (
      PARTITION BY id_conta_origem
      ORDER BY data_hora ASC, id_transacao ASC
    ) AS valor_anterior
  FROM transacoes_pix
)
SELECT
  id_transacao,
  id_conta_origem,
  valor_anterior,
  valor_atual,
  (valor_atual - valor_anterior) AS variacao_absoluta
FROM historico_valores
WHERE valor_anterior IS NOT NULL;`,
    colunaChave: 'id_transacao',
    rotuloEntidade: { singular: 'salto', plural: 'saltos' },
    dicasDivergencia: {
      excesso:
        'Há linhas a mais. Na consulta externa, elimine `valor_anterior IS NULL` — a primeira operação de cada conta não entra.',
      falta:
        'Faltam saltos. Carimbe `LAG(valor)` na origem, em ordem cronológica com desempate por `id_transacao`, e só então filtre nulos.',
      valores:
        'Os identificadores batem, mas a variação diverge. `variacao_absoluta` é `valor_atual - valor_anterior` (sinal algébrico, não o módulo).',
      ordenacao: 'Os dados estão corretos, mas a ordem não. Ordene pela variação, da maior (mais positiva) para a menor.',
    },
    resumirSucesso(gabarito) {
      return {
        message: `Saltos consecutivos: ${gabarito.values.length} envio(s) com antecessor e variação de valor calculada.`,
        entities: distinct(columnValues(gabarito, 'id_conta_origem')).slice(0, 8),
        details: ['Os casos homologados seguintes no nível combinam histórico curto, salto múltiplo e janela móvel de três PIX.'],
      };
    },
  },
  {
    id: 'conta-aquecida',
    origem: 'base',
    nivel: 4,
    titulo: 'Conta "aquecida": PIX de teste seguido de salto abrupto (CTE)',
    enquadramento: 'Circular Bacen 3.978/2020 (monitoramento) c/c Carta Circular 4.001/2020 · Mudança de padrão',
    dossie:
      'Uma tática comum de redes de laranjas é "aquecer" a conta: o titular faz um ou dois PIX de valor irrisório (padaria, ' +
      'mercado) para simular uso normal e, poucos dias depois, passa a movimentar valores dezenas de vezes maiores. A área de ' +
      'PLD quer uma regra que combine histórico curto, salto em relação ao próprio histórico e proximidade temporal.',
    objetivo:
      'Redes de laranja aquecem a conta com um ou dois PIX irrisórios e, em seguida, saltam o valor. Identifique a transação, a conta remetente, o titular, o valor, o momento, o intervalo em horas até o disparo anterior, a média histórica e o salto, nas originações com histórico curto (um a três envios anteriores), valor atual pelo menos dez vezes essa média e também de R$ 5.000,00 ou mais, em até dez dias depois do disparo anterior.',
    colunasEsperadas: [
      'id_transacao',
      'conta_origem',
      'titular',
      'valor',
      'data_hora',
      'intervalo_horas',
      'media_historica',
      'salto',
    ],
    ordenacao: 'salto DESC, id_transacao',
    dicaTexto:
      'Calcule todas as métricas de janela na CTE (o WHERE não enxerga funções de janela do mesmo SELECT). O frame "ROWS BETWEEN ' +
      'UNBOUNDED PRECEDING AND 1 PRECEDING" exclui o próprio PIX da média, então a primeira transação de cada conta fica com média NULL.',
    dicaSql: `WITH metricas AS (
  SELECT t.id_transacao, t.id_conta_origem AS conta_origem, c.titular, t.valor, t.data_hora,
         unixepoch(t.data_hora)
           - unixepoch(LAG(t.data_hora) OVER (PARTITION BY ... ORDER BY ...)) AS intervalo_segundos,
         AVG(t.valor) OVER (
           PARTITION BY ... ORDER BY ...
           ROWS BETWEEN UNBOUNDED PRECEDING AND 1 PRECEDING
         ) AS media_historica,
         COUNT(*) OVER (...mesmo frame...) AS qtd_historico
  FROM transacoes_pix t
  JOIN contas c ON ...
)
SELECT ...
FROM metricas
WHERE qtd_historico BETWEEN ... AND ...
  AND ...
ORDER BY ...;`,
    decomposicao: {
      fase1: {
        titulo: 'Fase 1 — O envelope `WITH`',
        texto:
          'Na CTE `metricas`, carimbe cada PIX com três métricas antes do corte: `intervalo_segundos` (`LAG` da mesma origem), `media_historica` (`AVG(valor) OVER` só dos PIX anteriores) e `qtd_historico` (mesmo frame). Selecione o `WITH metricas AS (...)` e use Testar Seleção / CTE para inspecionar médias e intervalos ainda sem filtro.',
      },
      fase2: {
        titulo: 'Fase 2 — O filtro do `WHERE` externo',
        texto:
          'No `WHERE` externo, aplique as regras em conjunto (`AND`) sobre o dado já carimbado: `qtd_historico BETWEEN 1 AND 3`, `valor >= 10 * media_historica`, `valor >= 5000` e `intervalo_segundos <= 864000` (10 dias). Cortar cedo demais (no envelope) impede de ver o histórico que sustenta o salto.',
      },
    },
    gabaritoSql: `-- Gabarito comentado · Conta "aquecida" (CTE + LAG + média histórica)
WITH metricas AS (
  SELECT
    t.id_transacao,
    t.id_conta_origem AS conta_origem,
    c.titular,
    t.valor,
    t.data_hora,
    -- Regra temporal: segundos desde o PIX anterior do MESMO remetente
    unixepoch(t.data_hora) - unixepoch(LAG(t.data_hora) OVER (
      PARTITION BY t.id_conta_origem ORDER BY t.data_hora
    )) AS intervalo_segundos,
    -- Linha de base: média só dos PIX ANTERIORES (o frame exclui a linha atual)
    AVG(t.valor) OVER (
      PARTITION BY t.id_conta_origem ORDER BY t.data_hora
      ROWS BETWEEN UNBOUNDED PRECEDING AND 1 PRECEDING
    ) AS media_historica,
    -- Tamanho do histórico que sustenta essa média
    COUNT(*) OVER (
      PARTITION BY t.id_conta_origem ORDER BY t.data_hora
      ROWS BETWEEN UNBOUNDED PRECEDING AND 1 PRECEDING
    ) AS qtd_historico
  FROM transacoes_pix AS t
  JOIN contas AS c ON c.id_conta = t.id_conta_origem
)
SELECT
  id_transacao,
  conta_origem,
  titular,
  valor,
  data_hora,
  ROUND(intervalo_segundos / 3600.0, 1) AS intervalo_horas,  -- 3600.0 força divisão real
  ROUND(media_historica, 2)             AS media_historica,
  ROUND(valor / media_historica, 2)     AS salto
FROM metricas
WHERE qtd_historico BETWEEN 1 AND 3        -- histórico curto: conta recém-"aquecida"
  AND valor >= 10 * media_historica        -- salto: 10x ou mais o padrão do próprio remetente
  AND valor >= 5000                        -- relevância: ignora saltos de centavos para reais
  AND intervalo_segundos <= 10 * 86400;    -- proximidade: até 10 dias após o PIX anterior`,
    colunaChave: 'id_transacao',
    rotuloEntidade: { singular: 'transação', plural: 'transações' },
    dicasDivergencia: {
      excesso:
        'Há transações a mais. Aplique TODAS as regras juntas (`AND`): histórico entre 1 e 3 PIX, `valor >= 10 * media_historica`, `valor >= 5000` e intervalo `<= 864000` s.',
      falta:
        'Faltam transações. A média deve considerar só os PIX ANTERIORES (`ROWS BETWEEN UNBOUNDED PRECEDING AND 1 PRECEDING`) e o `qtd_historico` usa o mesmo frame; confira também se os limites são inclusivos.',
      valores:
        'As transações estão certas, mas alguma métrica diverge. `intervalo_horas` = `ROUND(intervalo_segundos / 3600.0, 1)`; `media_historica` exclui o PIX atual; `salto` = `ROUND(valor / media_historica, 2)`.',
      ordenacao: 'Os dados estão corretos, mas a ordem não. Ordene por `salto DESC, id_transacao`.',
    },
    resumirSucesso(gabarito) {
      const titulares = distinct(columnValues(gabarito, 'titular'));
      const saltos = columnValues(gabarito, 'salto').map(Number);
      const pico = saltos.length > 0 ? Math.max(...saltos) : 0;
      return {
        message: `Regra composta certeira! ${gabarito.values.length} contas "aquecidas" saltaram até ${formatDecimal(pico)}x o próprio histórico, logo após PIX de teste de poucos reais.`,
        entities: titulares,
        details: [
          'Relaxe o critério de histórico (por exemplo, `qtd_historico <= 10`) e veja surgir clientes com perfil legítimo, como um pagamento pontual de caução a uma imobiliária. Combinar regras é o que reduz falsos positivos.',
        ],
      };
    },
  },
  {
    id: 'janela-movel',
    origem: 'base',
    nivel: 4,
    titulo: 'Acúmulo móvel: soma das últimas 3 originações (ROWS BETWEEN)',
    enquadramento: 'Carta Circular Bacen 4.001/2020 · Fracionamento / estruturação em janela curta',
    dossie:
      'Além do fracionamento clássico (várias operações isoladas abaixo de R$ 10 mil), redes estruturam volume em ' +
      'rajadas de três PIX consecutivos da mesma origem. Cada transferência isolada pode parecer rotineira; a soma móvel ' +
      'das últimas três originações revela o acúmulo. A esteira deve carimbar essa métrica linha a linha e só então aplicar o corte.',
    objetivo:
      'Cada PIX isolado pode parecer rotina; a soma das últimas três originações da mesma conta revela estruturação. Identifique a transação, a conta remetente, o titular, o valor unitário, o momento e o acúmulo móvel quando essa soma chegar a R$ 25.000,00 ou mais, priorizando os maiores volumes.',
    colunasEsperadas: ['id_transacao', 'conta_origem', 'titular', 'valor', 'data_hora', 'acumulado_movel_3'],
    ordenacao: 'acumulado_movel_3 DESC, id_transacao',
    dicaTexto:
      'O frame `ROWS BETWEEN 2 PRECEDING AND CURRENT ROW` inclui a linha atual e as duas anteriores da mesma partição. ' +
      'Nas primeiras linhas de cada conta a janela fica menor (1 ou 2 PIX) — o `SUM` ainda é válido. Não filtre a janela no mesmo `SELECT`.',
    dicaSql: `-- FASE 1
WITH envelope_metricas AS (
  SELECT t.id_transacao, t.id_conta_origem AS conta_origem, c.titular, t.valor, t.data_hora,
         SUM(t.valor) OVER (
           PARTITION BY t.id_conta_origem ORDER BY t.data_hora
           ROWS BETWEEN 2 PRECEDING AND CURRENT ROW
         ) AS acumulado_movel_3
  FROM transacoes_pix t
  JOIN contas c ON c.id_conta = t.id_conta_origem
)
-- FASE 2
SELECT ...
FROM envelope_metricas
WHERE acumulado_movel_3 >= ...
ORDER BY ...;`,
    decomposicao: {
      fase1: {
        titulo: 'Fase 1 — O envelope `WITH`',
        texto:
          'Na CTE `envelope_metricas`, carimbe cada originação com `SUM(valor) OVER (... ROWS BETWEEN 2 PRECEDING AND CURRENT ROW)` — a soma móvel das últimas 3 transações da mesma `id_conta_origem`. Selecione o `WITH` e use Testar Seleção / CTE para ver o acumulado ainda sem corte.',
      },
      fase2: {
        titulo: 'Fase 2 — O filtro do `WHERE` externo',
        texto:
          'No `SELECT` externo, isole as linhas já carimbadas com `acumulado_movel_3 >= 25000`. Esse é o corte regulatório: volume estruturado em janela de três PIX, mesmo que cada operação isolada fique abaixo de R$ 10 mil.',
      },
    },
    gabaritoSql: `-- FASE 1: O ENVELOPE ANALÍTICO (Criação da linha do tempo e carimbo de métricas linha a linha)
WITH envelope_metricas AS (
  SELECT
    t.id_transacao,
    t.id_conta_origem AS conta_origem,
    c.titular,
    t.valor,
    t.data_hora,
    -- Soma móvel: linha atual + 2 PIX anteriores da mesma origem
    ROUND(SUM(t.valor) OVER (
      PARTITION BY t.id_conta_origem
      ORDER BY t.data_hora
      ROWS BETWEEN 2 PRECEDING AND CURRENT ROW
    ), 2) AS acumulado_movel_3
  FROM transacoes_pix AS t
  JOIN contas AS c ON c.id_conta = t.id_conta_origem
)
-- FASE 2: O INSPETOR DE RISCO (Corte regulatório e enriquecimento sobre os dados já carimbados)
SELECT
  id_transacao,
  conta_origem,
  titular,
  valor,
  data_hora,
  acumulado_movel_3
FROM envelope_metricas
WHERE acumulado_movel_3 >= 25000   -- corte: acúmulo móvel de 3 originações
ORDER BY acumulado_movel_3 DESC;`,
    colunaChave: 'id_transacao',
    rotuloEntidade: { singular: 'transação', plural: 'transações' },
    dicasDivergencia: {
      excesso:
        'Há transações a mais. Confira o frame `ROWS BETWEEN 2 PRECEDING AND CURRENT ROW` (não use UNBOUNDED) e o corte `acumulado_movel_3 >= 25000` no WHERE externo.',
      falta:
        'Faltam transações. A janela inclui a linha atual; um único PIX de R$ 25 mil ou mais também entra. Confira `>= 25000` (inclusivo) e o `PARTITION BY id_conta_origem`.',
      valores:
        'As transações estão certas, mas `acumulado_movel_3` diverge. Use `ROUND(SUM(valor) OVER (...), 2)` com `ORDER BY data_hora` na partição da origem.',
      ordenacao: 'Os dados estão corretos, mas a ordem não. Ordene por `acumulado_movel_3 DESC, id_transacao`.',
    },
    resumirSucesso(gabarito) {
      const contas = distinct(columnValues(gabarito, 'conta_origem'));
      const picos = columnValues(gabarito, 'acumulado_movel_3').map(Number);
      const pico = picos.length > 0 ? Math.max(...picos) : 0;
      return {
        message:
          `Janela móvel de 3 PIX identificou ${gabarito.values.length} alerta(s) em ${contas.length} conta(s); o maior acumulado foi ${formatBRL(pico)}.`,
        entities: contas,
        details: [
          'Compare com um `SUM` / `GROUP BY` no dia inteiro: a janela `ROWS BETWEEN` pega estruturação que cruza viradas de dia e ignora o PIX isolado “limpo” no meio de uma sequência.',
        ],
      };
    },
  },
  {
    id: 'pep-escalada',
    origem: 'base',
    nivel: 4,
    titulo: 'Nível 4.3 — Escalada Rápida em PEP (Escrutínio Reforçado)',
    enquadramento:
      'Circular Bacen 3.978/2020 c/c Carta Circular 4.001/2020 (Escrutínio Reforçado em Pessoas Expostas Politicamente)',
    dossie:
      'Titulares PEP exigem monitoramento reforçado: o mesmo volume que em um cliente comum pode ser apenas ruído vira ' +
      'alerta quando o cargo público está no cadastro KYC. A denúncia aponta originações em sequência curta na conta de um ' +
      'deputado estadual (C013), cada PIX isolado abaixo de R$ 10 mil. A esteira deve cruzar `eh_pep` com a soma móvel das ' +
      'últimas três operações e só então aplicar o corte de escrutínio.',
    objetivo:
      'Titular com cargo público justifica alerta mais cedo. Identifique a transação, a conta remetente, o titular, o cargo público, o valor, o momento e o acúmulo móvel das últimas três originações quando essa soma superar R$ 20.000,00, priorizando os maiores acúmulos.',
    colunasEsperadas: [
      'id_transacao',
      'conta_origem',
      'titular',
      'cargo_pep',
      'valor',
      'data_hora',
      'acumulado_movel_pep',
    ],
    ordenacao: 'acumulado_movel_pep DESC, id_transacao ASC',
    dicaTexto:
      'Faça o JOIN de `transacoes_pix` com `contas` no envelope para carimbar a janela e o cargo. O corte `eh_pep = 1` e ' +
      '`acumulado_movel_pep > 20000` vai no `WHERE` externo — Window Function não entra no `WHERE` do mesmo `SELECT`.',
    dicaSql: `-- FASE 1
WITH envelope_metricas AS (
  SELECT t.id_transacao, t.id_conta_origem AS conta_origem, c.titular, c.eh_pep, c.cargo_pep,
         t.valor, t.data_hora,
         SUM(t.valor) OVER (
           PARTITION BY t.id_conta_origem ORDER BY t.data_hora
           ROWS BETWEEN 2 PRECEDING AND CURRENT ROW
         ) AS acumulado_movel_pep
  FROM transacoes_pix t
  JOIN contas c ON c.id_conta = t.id_conta_origem
)
-- FASE 2
SELECT ...
FROM envelope_metricas
WHERE eh_pep = 1 AND acumulado_movel_pep > ...
ORDER BY ...;`,
    decomposicao: {
      fase1: {
        titulo: 'Fase 1 — O envelope `WITH`',
        texto:
          'Faça o `JOIN` entre `transacoes_pix` e `contas` e carimbe `SUM(valor) OVER (PARTITION BY id_conta_origem ORDER BY data_hora ROWS BETWEEN 2 PRECEDING AND CURRENT ROW)` mais `eh_pep` e `cargo_pep`. A janela considera todas as originações da conta, não só as de PEP. Selecione o `WITH` e use Testar Seleção / CTE.',
      },
      fase2: {
        titulo: 'Fase 2 — O filtro do `WHERE` externo',
        texto:
          'No `SELECT` externo aplique o escrutínio reforçado: `eh_pep = 1` e `acumulado_movel_pep > 20000`. O Prefeito (C004) só entra se a soma móvel dele também romper o limiar; o recorte plantado é o Deputado (C013) em 27/08.',
      },
    },
    gabaritoSql: `-- FASE 1: O ENVELOPE ANALÍTICO (Criação da linha do tempo e carimbo de métricas linha a linha)
WITH envelope_metricas AS (
  SELECT
    t.id_transacao,
    t.id_conta_origem AS conta_origem,
    c.titular,
    c.eh_pep,
    c.cargo_pep,
    t.valor,
    t.data_hora,
    -- Soma móvel das últimas 3 originações (linha atual + 2 anteriores)
    ROUND(SUM(t.valor) OVER (
      PARTITION BY t.id_conta_origem
      ORDER BY t.data_hora
      ROWS BETWEEN 2 PRECEDING AND CURRENT ROW
    ), 2) AS acumulado_movel_pep
  FROM transacoes_pix AS t
  JOIN contas AS c ON c.id_conta = t.id_conta_origem
)
-- FASE 2: O INSPETOR DE RISCO (Corte regulatório e enriquecimento sobre os dados já carimbados)
SELECT
  id_transacao,
  conta_origem,
  titular,
  cargo_pep,
  valor,
  data_hora,
  acumulado_movel_pep
FROM envelope_metricas
WHERE eh_pep = 1                    -- escrutínio reforçado: só PEP
  AND acumulado_movel_pep > 20000   -- corte: janela de 3 PIX acima de R$ 20 mil
ORDER BY acumulado_movel_pep DESC;`,
    colunaChave: 'id_transacao',
    rotuloEntidade: { singular: 'transação', plural: 'transações' },
    dicasDivergencia: {
      excesso:
        'Há transações a mais. Filtre `eh_pep = 1` e `acumulado_movel_pep > 20000` (estrito) no WHERE externo. Não use o limiar de R$ 25 mil do desafio 4.2.',
      falta:
        'Faltam transações. Confira o JOIN com `contas`, o frame `ROWS BETWEEN 2 PRECEDING AND CURRENT ROW` e o corte `> 20000` (a terceira originação de C013 em 27/08 deve entrar).',
      valores:
        'As transações estão certas, mas `acumulado_movel_pep` ou `cargo_pep` divergem. Projeté `cargo_pep` do cadastro e `ROUND(SUM(valor) OVER (...), 2)`.',
      ordenacao: 'Os dados estão corretos, mas a ordem não. Ordene por `acumulado_movel_pep DESC, id_transacao ASC`.',
    },
    resumirSucesso(gabarito) {
      const titulares = distinct(columnValues(gabarito, 'titular'));
      const cargos = distinct(columnValues(gabarito, 'cargo_pep'));
      const picos = columnValues(gabarito, 'acumulado_movel_pep').map(Number);
      const pico = picos.length > 0 ? Math.max(...picos) : 0;
      return {
        message:
          `Escrutínio reforçado: ${gabarito.values.length} originação(ões) PEP com janela móvel acima de R$ 20 mil (pico ${formatBRL(pico)}; cargos: ${cargos.join(', ')}).`,
        entities: titulares,
        details: [
          'Compare o 4.2 (`>= 25000`, qualquer titular) com este corte (`> 20000` só em `eh_pep = 1`): o limiar cai porque o risco do cargo público justifica alerta mais cedo.',
        ],
      };
    },
  },
  {
    id: 'ubo-pep-credito',
    origem: 'base',
    nivel: 5,
    titulo: 'Rastreio de UBO: Beneficiário Efetivo e Exposição Política',
    enquadramento: 'Circular Bacen 3.978/2020 · beneficiário final e escrutínio reforçado de PEP',
    dossie:
      'Créditos de grande porte em pessoa jurídica só fecham o dossiê quando se sabe quem é o beneficiário efetivo. ' +
      'A mesa pediu operações em que a receptora é PJ, o sócio detém fatia relevante do capital e esse sócio está ' +
      'classificado no cadastro como Pessoa Exposta Politicamente.',
    objetivo:
      'Crédito de grande porte em pessoa jurídica só fecha o dossiê com o beneficiário efetivo. Identifique a transação, a razão social da receptora, o nome do sócio, a fatia do capital e o valor do crédito nas entradas de R$ 50.000,00 ou mais em PJ cujo quadro tenha sócio com 25% ou mais e classificação de Pessoa Exposta Politicamente no cadastro.',
    colunasEsperadas: ['id_transacao', 'razao_social', 'nome_socio', 'percentual_participacao', 'valor'],
    ordenacao: 'valor DESC',
    dicaTexto:
      'Cruze o crédito com a empresa favorecida, o quadro de sócios e o cadastro pessoal do sócio (pelo documento), mantendo só PJ, piso de valor, participação relevante e classificação PEP.',
    dicaSql: `-- Empresa receptora + QSA + cadastro do sócio (cpf_socio = documento) para ler eh_pep
SELECT t.id_transacao, c_emp.titular AS razao_social, s.nome_socio,
       s.percentual_participacao, t.valor
FROM transacoes_pix t
JOIN contas c_emp ON t.id_conta_destino = c_emp.id_conta
JOIN socios_empresas s ON c_emp.id_conta = s.id_conta_empresa
JOIN contas c_pep ON s.cpf_socio = c_pep.documento
WHERE c_emp.tipo_pessoa = 'PJ'
  AND t.valor >= ...
  AND s.percentual_participacao >= ...
  AND c_pep.eh_pep = ...
ORDER BY t.valor DESC;`,
    gabaritoSql: `-- Gabarito · crédito ≥ R$ 50 mil em PJ com sócio PEP (≥ 25%)
SELECT
  t.id_transacao,
  c_emp.titular AS razao_social,
  s.nome_socio,
  s.percentual_participacao,
  t.valor
FROM transacoes_pix t
JOIN contas c_emp ON t.id_conta_destino = c_emp.id_conta
JOIN socios_empresas s ON c_emp.id_conta = s.id_conta_empresa
JOIN contas c_pep ON s.cpf_socio = c_pep.documento
WHERE c_emp.tipo_pessoa = 'PJ'
  AND t.valor >= 50000
  AND s.percentual_participacao >= 25
  AND c_pep.eh_pep = 1;`,
    colunaChave: 'id_transacao',
    rotuloEntidade: { singular: 'crédito', plural: 'créditos' },
    dicasDivergencia: {
      excesso:
        'Há linhas a mais. A receptora é PJ, `valor >= 50000`, `percentual_participacao >= 25` e o sócio precisa estar PEP (`cpf_socio = documento` e `eh_pep = 1`).',
      falta:
        'Faltam operações. Cruze destino → empresa → QSA → cadastro do sócio. O piso de participação e o de valor são inclusivos.',
      valores:
        'Os identificadores batem, mas razão social, sócio ou participação divergem. `razao_social` é o titular da PJ favorecida.',
      ordenacao: 'Os dados estão corretos, mas a ordem não. Ordene pelo valor do crédito, do maior para o menor.',
    },
    resumirSucesso(gabarito) {
      const total = sum(columnValues(gabarito, 'valor'));
      return {
        message: `UBO PEP: ${gabarito.values.length} crédito(s) ≥ R$ 50 mil em PJ com sócio PEP relevante, somando ${formatBRL(total)}.`,
        entities: distinct(columnValues(gabarito, 'razao_social')).slice(0, 8),
        details: ['O próximo recorte observa o trânsito rápido: crédito relevante seguido de saída em minutos.'],
      };
    },
  },
  {
    id: 'conta-passagem-dwell',
    origem: 'base',
    nivel: 5,
    titulo: 'Conta de Passagem: Esvaziamento Imediato de Recursos (Dwell Time Crítico)',
    enquadramento: 'Carta Circular Bacen 4.001/2020 · contas de passagem e layering em janela curta',
    dossie:
      'Contas de passagem recebem um crédito relevante e esvaziam o saldo em minutos, no mesmo ciclo operacional. O ' +
      'dwell time crítico da esteira é de até dez minutos entre a entrada e a saída pela mesma conta intermediária.',
    objetivo:
      'Conta de passagem recebe e esvazia no mesmo ciclo. Identifique a conta intermediária, a transação de entrada, a transação de saída, o valor recebido, o valor reenviado e o intervalo em segundos quando o crédito for de R$ 20.000,00 ou mais e a saída ocorrer em até dez minutos, no mesmo dia.',
    colunasEsperadas: [
      'conta_passagem',
      'transacao_entrada',
      'transacao_saida',
      'valor_entrada',
      'valor_saida',
      'intervalo_segundos',
    ],
    ordenacao: 'intervalo_segundos ASC',
    dicaTexto:
      'Pareie cada crédito relevante com saídas posteriores da mesma conta, medindo os segundos entre a entrada e a saída e mantendo só o trânsito de até dez minutos.',
    dicaSql: `-- Autorelacionamento: destino da entrada = origem da saída; saída não pode preceder a entrada
SELECT t_in.id_conta_destino AS conta_passagem,
       t_in.id_transacao AS transacao_entrada,
       t_out.id_transacao AS transacao_saida,
       t_in.valor AS valor_entrada,
       t_out.valor AS valor_saida,
       (unixepoch(t_out.data_hora) - unixepoch(t_in.data_hora)) AS intervalo_segundos
FROM transacoes_pix t_in
JOIN transacoes_pix t_out ON t_in.id_conta_destino = t_out.id_conta_origem
  AND unixepoch(t_out.data_hora) >= unixepoch(t_in.data_hora)
  AND (unixepoch(t_out.data_hora) - unixepoch(t_in.data_hora)) <= 600
WHERE t_in.valor >= ...
ORDER BY intervalo_segundos ASC;`,
    gabaritoSql: `-- Gabarito · dwell time ≤ 600 s após crédito ≥ R$ 20 mil
SELECT
  t_in.id_conta_destino AS conta_passagem,
  t_in.id_transacao AS transacao_entrada,
  t_out.id_transacao AS transacao_saida,
  t_in.valor AS valor_entrada,
  t_out.valor AS valor_saida,
  (unixepoch(t_out.data_hora) - unixepoch(t_in.data_hora)) AS intervalo_segundos
FROM transacoes_pix t_in
JOIN transacoes_pix t_out ON t_in.id_conta_destino = t_out.id_conta_origem
  AND unixepoch(t_out.data_hora) >= unixepoch(t_in.data_hora)
  AND (unixepoch(t_out.data_hora) - unixepoch(t_in.data_hora)) <= 600
  AND date(t_out.data_hora) = date(t_in.data_hora)
WHERE t_in.valor >= 20000;`,
    colunaChave: 'transacao_entrada',
    rotuloEntidade: { singular: 'par entrada–saída', plural: 'pares entrada–saída' },
    dicasDivergencia: {
      excesso:
        'Há pares a mais. O crédito de entrada é `valor >= 20000`, a saída ocorre até 600 segundos depois pela mesma conta e no mesmo dia civil (`date(t_out.data_hora) = date(t_in.data_hora)`).',
      falta:
        'Faltam pares. A saída não pode ser anterior ao crédito nem em outro dia. Inclua intervalo zero (saída no mesmo instante) se existir.',
      valores:
        'Os pares batem, mas valores ou `intervalo_segundos` divergem. O intervalo é `unixepoch(saída) - unixepoch(entrada)`.',
      ordenacao: 'Os dados estão corretos, mas a ordem não. Ordene pelo intervalo, do mais curto para o mais longo.',
    },
    resumirSucesso(gabarito) {
      return {
        message: `Contas de passagem: ${gabarito.values.length} par(es) crédito–saída em até 10 minutos.`,
        entities: distinct(columnValues(gabarito, 'conta_passagem')).slice(0, 8),
        details: ['Em seguida, a telemetria aponta deslocamento geográfico incompatível entre sessões consecutivas.'],
      };
    },
  },
  {
    id: 'vetor-geografico-impossivel',
    origem: 'base',
    nivel: 5,
    titulo: 'Vetor Geográfico Impossível: Telemetria de Sessões Sucessivas',
    enquadramento: 'Circular Bacen 3.978/2020 · canais eletrônicos e geolocalização incompatível',
    dossie:
      'Dois logins em cidades diferentes em menos de uma hora não se explicam por deslocamento físico habitual. A esteira ' +
      'compara sessões consecutivas da mesma conta e isola a troca de cidade nesse intervalo.',
    objetivo:
      'Dois logins em cidades diferentes em menos de uma hora não se explicam por deslocamento físico. Identifique a conta, a cidade da sessão anterior, a cidade da sessão atual e o intervalo em segundos nas sessões consecutivas com troca de cidade nesse recorte.',
    colunasEsperadas: ['id_conta', 'cidade_origem', 'cidade_destino', 'intervalo_segundos'],
    ordenacao: 'intervalo_segundos ASC',
    dicaTexto:
      'Para cada acesso, recupere a cidade e o horário da sessão imediatamente anterior da mesma conta; na etapa seguinte, mantenha só a troca de cidade em até uma hora e descarte quem não tem sessão prévia.',
    dicaSql: `-- Fase 1: LAG da cidade e do horário na linha do tempo da conta
-- Fase 2: troca de cidade e intervalo ≤ 3600 s
WITH sessoes_sequenciais AS (
  SELECT id_conta, geolocalizacao_cidade AS cidade_atual, data_hora,
         LAG(geolocalizacao_cidade) OVER (
           PARTITION BY id_conta ORDER BY data_hora ASC
         ) AS cidade_anterior,
         LAG(data_hora) OVER (
           PARTITION BY id_conta ORDER BY data_hora ASC
         ) AS data_hora_anterior
  FROM acessos_digitais
)
SELECT id_conta, cidade_anterior AS cidade_origem, cidade_atual AS cidade_destino,
       (unixepoch(data_hora) - unixepoch(data_hora_anterior)) AS intervalo_segundos
FROM sessoes_sequenciais
WHERE cidade_anterior IS NOT NULL
  AND cidade_atual <> cidade_anterior
  AND (unixepoch(data_hora) - unixepoch(data_hora_anterior)) <= 3600
ORDER BY intervalo_segundos ASC;`,
    gabaritoSql: `-- Gabarito · sessões consecutivas em cidades distintas em até 1 h
WITH sessoes_sequenciais AS (
  SELECT
    id_conta,
    geolocalizacao_cidade AS cidade_atual,
    data_hora,
    LAG(geolocalizacao_cidade) OVER (
      PARTITION BY id_conta ORDER BY data_hora ASC
    ) AS cidade_anterior,
    LAG(data_hora) OVER (
      PARTITION BY id_conta ORDER BY data_hora ASC
    ) AS data_hora_anterior
  FROM acessos_digitais
)
SELECT
  id_conta,
  cidade_anterior AS cidade_origem,
  cidade_atual AS cidade_destino,
  (unixepoch(data_hora) - unixepoch(data_hora_anterior)) AS intervalo_segundos
FROM sessoes_sequenciais
WHERE cidade_anterior IS NOT NULL
  AND cidade_atual <> cidade_anterior
  AND (unixepoch(data_hora) - unixepoch(data_hora_anterior)) <= 3600;`,
    colunaChave: 'id_conta',
    rotuloEntidade: { singular: 'deslocamento', plural: 'deslocamentos' },
    dicasDivergencia: {
      excesso:
        'Há linhas a mais. Compare só sessões consecutivas da mesma conta, com troca de cidade e intervalo `<= 3600` segundos.',
      falta:
        'Faltam eventos. Expurgue a primeira sessão (`cidade_anterior` nulo). C001 (São Paulo → Manaus em cerca de um minuto) deve entrar se a telemetria ATO estiver na base.',
      valores:
        'As contas batem, mas cidades ou intervalo divergem. `cidade_origem` é a sessão anterior; `cidade_destino` é a atual.',
      ordenacao: 'Os dados estão corretos, mas a ordem não. Ordene pelo intervalo, do mais curto para o mais longo.',
    },
    resumirSucesso(gabarito) {
      return {
        message: `Vetor impossível: ${gabarito.values.length} troca(s) de cidade entre sessões consecutivas em até 1 hora.`,
        entities: distinct(columnValues(gabarito, 'id_conta')).slice(0, 8),
        details: ['O próximo recorte fecha o ciclo A→B→C quando o administrador de C é o mesmo CPF do quadro de A.'],
      };
    },
  },
  {
    id: 'triangulacao-societaria',
    origem: 'base',
    nivel: 5,
    titulo: 'Estruturação em Rede: Triangulação de Fundos com Vínculo Societário',
    enquadramento: 'Carta Circular Bacen 4.001/2020 · estruturação e empresas coligadas',
    dossie:
      'Triangulação societária: A envia a B e B repassa a C um valor próximo, enquanto o mesmo CPF figura no quadro de A e ' +
      'no de C. A margem de 10% absorve tarifas e arredondamentos sem perder o vínculo econômico.',
    objetivo:
      'Quero triangulação com vínculo societário: identifique a conta de origem, a intermediária, a destinatária, o valor da primeira perna e o valor da segunda quando A envia a B, B repassa a C um montante próximo (variação de até 10%) e o mesmo documento figura no quadro de A e no de C, sem loop de A para A.',
    colunasEsperadas: ['conta_origem', 'conta_intermediaria', 'conta_destino', 'valor_remessa_a', 'valor_remessa_b'],
    ordenacao: 't_ab.data_hora ASC',
    dicaTexto:
      'Encadeie o envio A→B com o envio posterior B→C, aceite variação de até 10% no valor e confirme o mesmo documento de sócio nos quadros de A e de C, sem loop de A para A.',
    dicaSql: `-- A→B depois B→C; valor de B→C entre 90% e 110% de A→B; mesmo cpf_socio em A e C
SELECT t_ab.id_conta_origem AS conta_origem,
       t_ab.id_conta_destino AS conta_intermediaria,
       t_bc.id_conta_destino AS conta_destino,
       t_ab.valor AS valor_remessa_a,
       t_bc.valor AS valor_remessa_b
FROM transacoes_pix t_ab
JOIN transacoes_pix t_bc ON t_ab.id_conta_destino = t_bc.id_conta_origem
  AND unixepoch(t_bc.data_hora) >= unixepoch(t_ab.data_hora)
  AND t_bc.valor BETWEEN (t_ab.valor * 0.90) AND (t_ab.valor * 1.10)
JOIN socios_empresas s_a ON t_ab.id_conta_origem = s_a.id_conta_empresa
JOIN socios_empresas s_c ON t_bc.id_conta_destino = s_c.id_conta_empresa
WHERE s_a.cpf_socio = s_c.cpf_socio
  AND t_ab.id_conta_origem <> t_bc.id_conta_destino
ORDER BY t_ab.data_hora ASC;`,
    gabaritoSql: `-- Gabarito · triangulação A→B→C com sócio em comum (margem 10%)
SELECT
  t_ab.id_conta_origem AS conta_origem,
  t_ab.id_conta_destino AS conta_intermediaria,
  t_bc.id_conta_destino AS conta_destino,
  t_ab.valor AS valor_remessa_a,
  t_bc.valor AS valor_remessa_b
FROM transacoes_pix t_ab
JOIN transacoes_pix t_bc ON t_ab.id_conta_destino = t_bc.id_conta_origem
  AND unixepoch(t_bc.data_hora) >= unixepoch(t_ab.data_hora)
  AND t_bc.valor BETWEEN (t_ab.valor * 0.90) AND (t_ab.valor * 1.10)
JOIN socios_empresas s_a ON t_ab.id_conta_origem = s_a.id_conta_empresa
JOIN socios_empresas s_c ON t_bc.id_conta_destino = s_c.id_conta_empresa
WHERE s_a.cpf_socio = s_c.cpf_socio
  AND t_ab.id_conta_origem <> t_bc.id_conta_destino;`,
    colunaChave: 'conta_origem',
    rotuloEntidade: { singular: 'triângulo', plural: 'triângulos' },
    dicasDivergencia: {
      excesso:
        'Há cadeias a mais. B→C precisa ser posterior ou simultâneo a A→B, com valor entre 90% e 110%, e o mesmo `cpf_socio` em A e C. A e C não podem ser a mesma conta.',
      falta:
        'Faltam triangulações. Cruze os dois PIX em sequência e os dois QSA pelo CPF. Sócios de A e C precisam ser o mesmo documento.',
      valores:
        'As contas batem, mas os valores divergem. `valor_remessa_a` é A→B e `valor_remessa_b` é B→C.',
      ordenacao: 'Os dados estão corretos, mas a ordem não. Ordene pela data/hora do primeiro envio (A→B), da mais antiga para a mais recente.',
    },
    resumirSucesso(gabarito) {
      return {
        message: `Triangulação societária: ${gabarito.values.length} cadeia(s) A→B→C com sócio em comum e margem de 10%.`,
        entities: distinct(columnValues(gabarito, 'conta_origem')).slice(0, 8),
        details: ['O dossiê COAF consolida volumetria crítica de PJ que já têm administrador formal no QSA.'],
      };
    },
  },
  {
    id: 'dossie-coaf-pj',
    origem: 'base',
    nivel: 5,
    titulo: 'Dossiê Executivo de Comunicação Regulatória (COAF)',
    enquadramento: 'Lei 9.613/1998 c/c Circular Bacen 3.978/2020 · comunicação de operações',
    dossie:
      'O relatório executivo da comunicação reúne PJ com volume enviado acima do piso interno e com administrador ' +
      'identificado no quadro. A ficha traz razão social, faturamento declarado, montante, ticket médio e quantidade de envios.',
    objetivo:
      'Preciso do relatório executivo para comunicação. Filtre empresas que enviaram mais de R$ 150.000,00 no período e já têm administrador formal no quadro, trazendo a razão social, o faturamento declarado, o montante movimentado, o ticket médio e a quantidade de operações.',
    colunasEsperadas: ['razao_social', 'renda_mensal_declarada', 'total_movimentado', 'ticket_medio', 'total_operacoes'],
    ordenacao: 'total_movimentado DESC',
    dicaTexto:
      'Separe a consolidação dos envios (com o piso de volume) da lista de empresas que têm administrador; depois cruze com o cadastro PJ.',
    dicaSql: `-- Bloco 1: volumetria com corte de grupo; Bloco 2: QSA com administrador; SELECT: só PJ
WITH volumetria_empresas AS (
  SELECT id_conta_origem,
         COUNT(*) AS total_operacoes,
         SUM(valor) AS total_movimentado,
         AVG(valor) AS ticket_medio
  FROM transacoes_pix
  GROUP BY id_conta_origem
  HAVING SUM(valor) > 150000
),
empresas_com_administrador AS (
  SELECT DISTINCT id_conta_empresa
  FROM socios_empresas
  WHERE eh_administrador = 1
)
SELECT c.titular AS razao_social,
       c.renda_mensal_declarada,
       v.total_movimentado,
       v.ticket_medio,
       v.total_operacoes
FROM volumetria_empresas v
JOIN contas c ON v.id_conta_origem = c.id_conta
JOIN empresas_com_administrador adm ON c.id_conta = adm.id_conta_empresa
WHERE c.tipo_pessoa = 'PJ'
ORDER BY v.total_movimentado DESC;`,
    gabaritoSql: `-- Gabarito · dossiê COAF: PJ com volume > R$ 150 mil e administrador no QSA
WITH volumetria_empresas AS (
  SELECT
    id_conta_origem,
    COUNT(*) AS total_operacoes,
    SUM(valor) AS total_movimentado,
    AVG(valor) AS ticket_medio
  FROM transacoes_pix
  GROUP BY id_conta_origem
  HAVING SUM(valor) > 150000
),
empresas_com_administrador AS (
  SELECT DISTINCT id_conta_empresa
  FROM socios_empresas
  WHERE eh_administrador = 1
)
SELECT
  c.titular AS razao_social,
  c.renda_mensal_declarada,
  v.total_movimentado,
  v.ticket_medio,
  v.total_operacoes
FROM volumetria_empresas v
JOIN contas c ON v.id_conta_origem = c.id_conta
JOIN empresas_com_administrador adm ON c.id_conta = adm.id_conta_empresa
WHERE c.tipo_pessoa = 'PJ';`,
    colunaChave: 'razao_social',
    rotuloEntidade: { singular: 'empresa', plural: 'empresas' },
    dicasDivergencia: {
      excesso:
        'Há empresas a mais. O volume enviado é estritamente maior que R$ 150.000,00, a conta é PJ e existe `eh_administrador = 1` no QSA.',
      falta:
        'Faltam empresas. Some todos os envios da origem (`HAVING SUM(valor) > 150000`) e cruze com administradores distintos. Quem soma exatamente R$ 150 mil fica de fora.',
      valores:
        'As razões sociais batem, mas as métricas não. `total_movimentado` é a soma, `ticket_medio` a média e `total_operacoes` a contagem dos envios.',
      ordenacao: 'Os dados estão corretos, mas a ordem não. Ordene pelo montante movimentado, do maior para o menor.',
    },
    resumirSucesso(gabarito) {
      const total = sum(columnValues(gabarito, 'total_movimentado'));
      return {
        message: `Dossiê COAF: ${gabarito.values.length} PJ(s) acima de R$ 150 mil com administrador formal, somando ${formatBRL(total)} em envios.`,
        entities: distinct(columnValues(gabarito, 'razao_social')).slice(0, 8),
        details: ['Os casos homologados seguintes no nível aprofunda UBO da Aurora, ATO de dispositivo e consórcio em espécie.'],
      };
    },
  },
  {
    id: 'ubo-aurora',
    origem: 'base',
    nivel: 5,
    titulo: 'Rastreio de UBO: Sócios Relevantes em Empresas Suspeitas',
    enquadramento: 'Carta Circular Bacen 4.001/2020 · empresas de fachada, laranjas e beneficiário final (UBO)',
    dossie:
      'A Aurora (C025) concentrou dezenas de PIX logo abaixo de R$ 10 mil e integrou capital na holding. A Circular 3.978/2020 ' +
      'exige conhecer o beneficiário final; a Carta Circular 4.001 cita uso de laranjas e sociedades de fachada para ocultar ' +
      'o controlador. Cruze o QSA (`socios_empresas`) da conta investigada e isole quem de fato manda na empresa: participação ' +
      'relevante e poderes de administrador.',
    objetivo:
      'A Aurora (C025) é a receptora sob alerta. Identifique o nome do sócio, o documento, a fatia do capital e o CNPJ da empresa para o beneficiário final: participação de 25% ou mais e poderes de administração, priorizando as maiores fatias — os laranjas residuais ficam de fora deste recorte.',
    colunasEsperadas: ['nome_socio', 'cpf_socio', 'percentual_participacao', 'cnpj_empresa'],
    ordenacao: 'percentual_participacao DESC, nome_socio',
    dicaTexto:
      'A tabela `socios_empresas` liga o sócio à conta PJ por `id_conta_empresa`. Filtre a Aurora (`C025`), o piso de 25% e o flag de administrador. Um `JOIN contas c ON c.id_conta = s.id_conta_empresa` ajuda a conferir a razão social, mas as colunas pedidas saem do QSA.',
    dicaSql: `SELECT s.nome_socio,
       s.cpf_socio,
       s.percentual_participacao,
       s.cnpj_empresa
FROM socios_empresas AS s
JOIN contas AS c ON c.id_conta = s.id_conta_empresa
WHERE s.id_conta_empresa = 'C025'
  AND s.percentual_participacao >= ...
  AND s.eh_administrador = ...
ORDER BY ...;`,
    gabaritoSql: `-- Gabarito · UBO / QSA da receptora Aurora (C025)
SELECT
  s.nome_socio,
  s.cpf_socio,
  s.percentual_participacao,
  s.cnpj_empresa
FROM socios_empresas AS s
WHERE s.id_conta_empresa = 'C025'          -- empresa do smurfing
  AND s.percentual_participacao >= 25      -- sócio relevante (CC 4.001 / UBO)
  AND s.eh_administrador = 1               -- poderes de gestão
ORDER BY s.percentual_participacao DESC;`,
    colunaChave: 'cpf_socio',
    rotuloEntidade: { singular: 'sócio', plural: 'sócios' },
    dicasDivergencia: {
      excesso:
        'Há sócios a mais. Mantenha `id_conta_empresa = \'C025\'`, `percentual_participacao >= 25` e `eh_administrador = 1`. Laranjas com 1% não entram.',
      falta:
        'Faltam sócios. Confira a tabela `socios_empresas`, o piso inclusivo de 25% e se o administrador de fato da Aurora foi marcado com `eh_administrador = 1`.',
      valores:
        'Os sócios estão certos, mas algum campo diverge. Projete `nome_socio`, `cpf_socio`, `percentual_participacao` e `cnpj_empresa` sem arredondar o percentual.',
      ordenacao: 'Os dados estão corretos, mas a ordem não. Ordene por `percentual_participacao DESC, nome_socio`.',
    },
    resumirSucesso(gabarito) {
      const nomes = distinct(columnValues(gabarito, 'nome_socio'));
      return {
        message: `UBO localizado: ${gabarito.values.length} sócio(s) relevante(s) e administrador(es) no QSA da Aurora (${nomes.join(', ') || '—'}).`,
        entities: nomes,
        details: [
          'Os laranjas com participação residual continuam no QSA, mas o corte de 25% + administrador aponta o controlador econômico.',
        ],
      };
    },
  },
  {
    id: 'ato-dispositivo',
    origem: 'base',
    nivel: 5,
    titulo: 'Account Takeover (ATO): Dispositivo Inédito e Transação Atípica',
    enquadramento: 'Circular Bacen 3.978/2020 · canais eletrônicos, dispositivo e geolocalização incompatíveis (ATO)',
    dossie:
      'A esteira de canais eletrônicos cruzou telemetria com o PIX. Há relato de sessão autenticada a partir de cidade e IP ' +
      'incompatíveis com o cadastro (exemplo plantado: Manaus) minutos antes de uma originação de alto valor. A Circular 3.978 ' +
      'pede monitoramento de transações e de meios de acesso; a Carta Circular 4.001 cita uso atípico de canais e de dispositivos ' +
      'como indício de fraude / account takeover.',
    objetivo:
      'Há relato de sessão autenticada em cidade incompatível com o cadastro minutos antes de um saque alto. Identifique a conta, o dispositivo, a cidade do login e o valor da saída nos acessos bem-sucedidos nessa divergência geográfica, imediatamente antes (até quinze minutos) de uma originação de R$ 10.000,00 ou mais, priorizando os maiores valores.',
    colunasEsperadas: ['id_conta', 'device_id', 'geolocalizacao_cidade', 'valor_transacao'],
    ordenacao: 'valor_transacao DESC, id_conta',
    dicaTexto:
      'Correlacione `acessos_digitais` com `transacoes_pix` (origem) e `contas` (cidade KYC). A divergência é `a.geolocalizacao_cidade <> c.cidade`. A janela “imediatamente antes” usa `unixepoch(t.data_hora) - unixepoch(a.data_hora)` entre 0 e 900 segundos.',
    dicaSql: `SELECT a.id_conta,
       a.device_id,
       a.geolocalizacao_cidade,
       t.valor AS valor_transacao
FROM acessos_digitais AS a
JOIN contas AS c ON c.id_conta = a.id_conta
JOIN transacoes_pix AS t ON t.id_conta_origem = a.id_conta
WHERE a.sucesso = 1
  AND a.geolocalizacao_cidade <> c.cidade
  AND t.valor >= ...
  AND unixepoch(t.data_hora) - unixepoch(a.data_hora) BETWEEN 0 AND 900
ORDER BY ...;`,
    gabaritoSql: `-- Gabarito · ATO (telemetria × PIX de alto valor)
SELECT
  a.id_conta,
  a.device_id,
  a.geolocalizacao_cidade,
  t.valor AS valor_transacao
FROM acessos_digitais AS a
JOIN contas AS c
  ON c.id_conta = a.id_conta
JOIN transacoes_pix AS t
  ON t.id_conta_origem = a.id_conta
WHERE a.sucesso = 1
  AND a.geolocalizacao_cidade <> c.cidade
  AND t.valor >= 10000
  AND unixepoch(t.data_hora) - unixepoch(a.data_hora) BETWEEN 0 AND 900
ORDER BY t.valor DESC;`,
    colunaChave: 'id_conta',
    rotuloEntidade: { singular: 'conta', plural: 'contas' },
    dicasDivergencia: {
      excesso:
        'Há linhas a mais. Exija login com sucesso, cidade diferente do cadastro, PIX de saída `>= 10000` e intervalo de no máximo 900 s após o acesso.',
      falta:
        'Faltam eventos. Faça JOIN de `acessos_digitais` com `contas` e `transacoes_pix` na origem; o caso plantado é o device inédito em Manaus minutos antes do PIX alto.',
      valores:
        'As contas estão certas, mas `device_id`, cidade ou `valor_transacao` divergem. Alias `t.valor AS valor_transacao` e use a cidade do log, não a do KYC.',
      ordenacao: 'Os dados estão corretos, mas a ordem não. Ordene por `valor_transacao DESC, id_conta`.',
    },
    resumirSucesso(gabarito) {
      const contas = distinct(columnValues(gabarito, 'id_conta'));
      const cidades = distinct(columnValues(gabarito, 'geolocalizacao_cidade'));
      return {
        message: `ATO confirmado: ${gabarito.values.length} sessão(ões) em ${cidades.join(', ') || 'cidade atípica'} imediatamente antes de saídas de alto valor (${contas.join(', ')}).`,
        entities: contas,
        details: [
          'Compare com o histórico de device habitual da mesma conta: o salto geográfico + canal API no PIX é o padrão clássico de takeover.',
        ],
      };
    },
  },
  {
    id: 'consorcio-especie',
    origem: 'base',
    nivel: 5,
    titulo: 'Ocultação Patrimonial: Lance de Consórcio em Espécie',
    enquadramento: 'Carta Circular Bacen 4.001/2020 · integralização atípica e uso de espécie em produtos',
    dossie:
      'Consórcios contemplados e aplicações de renda fixa são veículos clássicos de conversão de numerário. A Circular 3.978/2020 ' +
      'trata da abordagem baseada em risco sobre produtos; a Carta Circular 4.001 aponta pagamentos em espécie sem fundamento e ' +
      'integralizações incompatíveis com o perfil. A esteira deve achar lances de consórcio liquidados em `ESPECIE` para obtenção ' +
      'de bem contemplado (`status_contemplacao = 1`).',
    objetivo:
      'Consórcio contemplado liquidado em espécie é veículo clássico de conversão de numerário. Identifique a conta, o tipo de produto, o valor do aporte e a forma de liquidação desses lances, priorizando os maiores montantes.',
    colunasEsperadas: ['id_conta', 'tipo_produto', 'valor_aporte', 'forma_liquidacao'],
    ordenacao: 'valor_aporte DESC, id_conta',
    dicaTexto:
      'Tudo está em `operacoes_produtos`. Não precisa de JOIN para o recorte mínimo. Combine os três filtros no `WHERE` e projete as quatro colunas pedidas. Um `JOIN contas` só é necessário se você quiser o titular no rascunho — a esteira não exige isso.',
    dicaSql: `SELECT id_conta,
       tipo_produto,
       valor_aporte,
       forma_liquidacao
FROM operacoes_produtos
WHERE tipo_produto = 'CONSORCIO_LANCE'
  AND forma_liquidacao = 'ESPECIE'
  AND status_contemplacao = ...
ORDER BY ...;`,
    gabaritoSql: `-- Gabarito · consórcio contemplado liquidado em espécie
SELECT
  id_conta,
  tipo_produto,
  valor_aporte,
  forma_liquidacao
FROM operacoes_produtos
WHERE tipo_produto = 'CONSORCIO_LANCE'
  AND forma_liquidacao = 'ESPECIE'
  AND status_contemplacao = 1
ORDER BY valor_aporte DESC;`,
    colunaChave: 'id_conta',
    rotuloEntidade: { singular: 'conta', plural: 'contas' },
    dicasDivergencia: {
      excesso:
        'Há operações a mais. Restrinja a `CONSORCIO_LANCE`, `ESPECIE` e `status_contemplacao = 1`. Aportes em PIX/TED ou consórcios não contemplados ficam de fora.',
      falta:
        'Faltam operações. Use a tabela `operacoes_produtos` (não o PIX). A Aurora (C025) tem lance contemplado em espécie; outras contas com o mesmo padrão também entram.',
      valores:
        'As contas estão certas, mas `tipo_produto`, `valor_aporte` ou `forma_liquidacao` divergem. Não arredonde o aporte; projete as colunas cruas da tabela.',
      ordenacao: 'Os dados estão corretos, mas a ordem não. Ordene por `valor_aporte DESC, id_conta`.',
    },
    resumirSucesso(gabarito) {
      const contas = distinct(columnValues(gabarito, 'id_conta'));
      const total = sum(columnValues(gabarito, 'valor_aporte'));
      return {
        message: `Ocultação via produto: ${gabarito.values.length} lance(s) de consórcio contemplado(s) em espécie, somando ${formatBRL(total)} (${contas.join(', ')}).`,
        entities: contas,
        details: [
          'O numerário entra como “lance” e sai como bem ou carta de crédito — caminho clássico de layering fora do PIX.',
        ],
      };
    },
  },
];

const RELATORIO_TAIL = /Para o relatório regulatório, apresente as seguintes colunas:\s*.*$/i;

/** Remove a frase antiga das colunas do enunciado; o contrato técnico vive em `colunasEsperadas`. */
export function ensureRelatorioColunas(objetivo: string, _columns: readonly string[] = []): string {
  return objetivo.replace(/\s+/g, ' ').trim().replace(RELATORIO_TAIL, '').trim();
}

export const SCENARIOS: readonly InvestigationScenario[] = [...CATALOG]
  .sort((a, b) => a.nivel - b.nivel)
  .map((scenario) => ({
    ...scenario,
    objetivo: ensureRelatorioColunas(scenario.objetivo, scenario.colunasEsperadas),
  }));