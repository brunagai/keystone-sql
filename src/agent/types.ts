export interface GeneratedChallenge {
  id: string;
  titulo: string;
  tipologiaBacen: string;
  badgeEnquadramento: string;
  contexto: string;
  objetivo: string;
  dicaSql: string;
  solutionQuery: string;
  criteriosValidacao: {
    colunasEsperadas: string[];
    descricaoSucesso: string;
  };
}

export type AiProviderId = 'groq' | 'openai';

export interface AiSettings {
  provider: AiProviderId;
  model: string;
  apiKey: string;
}

export type ChallengeFocus =
  | 'livre'
  | 'fracionamento'
  | 'alta_frequencia'
  | 'incompatibilidade'
  | 'conta_passagem'
  | 'fan_in_out'
  | 'horario_atipico'
  | 'valores_redondos'
  | 'coacao_fisica'
  | 'invasao_digital'
  | 'laranjas_mulas'
  | 'bacen_avancado';

export type ChallengeDifficulty = 'iniciante' | 'intermediario' | 'avancado';

export interface GenerationRequest {
  focus: ChallengeFocus;
  difficulty: ChallengeDifficulty;
  /** Títulos já existentes, para evitar desafios repetidos. */
  avoidTitles: string[];
}

export type GenerationSource = 'ia' | 'offline';

export interface GenerationOutcome {
  challenge: GeneratedChallenge;
  source: GenerationSource;
  model?: string;
  /** Motivo do fallback offline, quando aplicável. */
  fallbackReason?: string;
  attempts: number;
}

export type GenerationProgress = (message: string) => void;

export const FOCUS_LABELS: Record<ChallengeFocus, string> = {
  livre: 'Livre (o agente escolhe)',
  fracionamento: 'Fracionamento / smurfing',
  alta_frequencia: 'Alta frequência / burst',
  incompatibilidade: 'Incompatibilidade patrimonial',
  conta_passagem: 'Conta de passagem (pass-through)',
  fan_in_out: 'Concentração / dispersão (fan-in/fan-out)',
  horario_atipico: 'Horário e canal atípicos',
  valores_redondos: 'Valores redondos',
  coacao_fisica: 'Bloco A — Coação física, furto e PIX forçado',
  invasao_digital: 'Bloco B — Invasão digital e engenharia social',
  laranjas_mulas: 'Bloco C — Contas laranja e mulas',
  bacen_avancado: 'Bloco D — Carta Circular 4.001 (avançadas)',
};

export const DIFFICULTY_LABELS: Record<ChallengeDifficulty, string> = {
  iniciante: 'Iniciante',
  intermediario: 'Intermediário',
  avancado: 'Avançado',
};

/** 15 tipologias (fraude grave + PLD) e o corte SQL sugerido, para o system prompt. */
export const ADVANCED_TYPOLOGY_CATALOG = `
## Catálogo de 15 tipologias (fraude grave + PLD) — escolha UM padrão alinhado ao foco
Aplique as cláusulas/filtros indicados no envelope (FASE 1) e o corte no WHERE/HAVING externo (FASE 2), respeitando o ferramental do nível.

### Bloco A — Coação física, furto e transferências forçadas
1. Sequestro relâmpago noturno — \`CAST(strftime('%H', data_hora) AS INTEGER) AS hora\`; corte \`hora >= 20 OR hora < 6\` e \`valor >= 5000\` (Res. BCB 142/2021, limite PIX noturno).
2. Esvaziamento de saldo — janela curta da mesma origem (\`SUM(valor) OVER (PARTITION BY id_conta_origem ORDER BY unixepoch(data_hora) RANGE BETWEEN 3600 PRECEDING AND CURRENT ROW)\` ou 3+ originações); corte volume alto vs. histórico diurno.
3. Drible de limite noturno — mesmo recorte horário do item 1, valores logo abaixo de R$ 10.000 (\`valor BETWEEN 5000 AND 9999.99\`) em \`canal = 'APP'\`.
4. Furto de dispositivo / PIX forçado — horário atípico + \`canal = 'APP'\` + destinos inéditos (\`COUNT(DISTINCT id_conta_destino)\` alto no dia).

### Bloco B — Invasão digital e engenharia social
5. Account Takeover com troca de canal/API — \`LAG(canal) OVER (PARTITION BY id_conta_origem ORDER BY data_hora)\`; corte \`canal = 'API'\` após histórico \`APP\`/\`INTERNET_BANKING\`.
6. Micro-PIX de teste (aquecimento de credencial) — \`LEAD(valor) OVER (...)\` ou intervalo \`unixepoch\` < 300 s; corte par (\`valor <= 5\` seguido de \`valor >= 10000\`) no mesmo destino.
7. Leque fan-out — \`COUNT(DISTINCT id_conta_destino)\` por origem no dia/hora; corte dezenas de destinos sem fundamento.

### Bloco C — Contas laranja e mulas
8. Conta de passagem rápida — \`LEAD(data_hora)\` na mesma conta como destino depois origem; corte \`unixepoch\` saída − entrada <= 3600 e razão saída/entrada ≈ 1.
9. Funil fan-in de baixo valor — \`COUNT(DISTINCT id_conta_origem)\` no recebedor; corte muitas origens com \`AVG(valor) < 500\`.
10. Reativação de conta dormente — \`julianday\` / \`data_abertura\` antiga e primeiro PIX do mês após hiato; corte volume incompatível com o silêncio anterior.

### Bloco D — Carta Circular Bacen 4.001/2020 (avançadas)
11. Circuito fechado (round-tripping) — par A→B e B→A com \`valor\` próximo (\`ABS(v1-v2)/v1 < 0.1\`) em janela de horas/dias.
12. Valores redondos repetitivos — \`CAST(valor AS INTEGER) % 5000 = 0 AND valor >= 5000\`; repetição por origem (\`HAVING COUNT(*) >= 2\`).
13. Rajada bot / burst — \`LAG(data_hora)\`; corte \`intervalo_segundos <= 60\` e \`canal = 'API'\`.
14. Disparidade extrema de renda — \`JOIN contas\` origem; corte \`valor >= 30 * renda_mensal_declarada\`.
15. Smurfing bidirecional — fracionamento \`valor BETWEEN 9000 AND 9999.99\` nos dois sentidos do mesmo par de contas.
`.trim();

/** Qual bloco do catálogo privilegiar conforme o foco do pedido. */
export const FOCUS_TYPOLOGY_GUIDE: Record<ChallengeFocus, string> = {
  livre: 'Qualquer uma das 15 tipologias dos Blocos A–D, desde que o dataset suporte o corte.',
  fracionamento: 'Priorize o item 15 (smurfing bidirecional) ou o 9 (fan-in de baixo valor).',
  alta_frequencia: 'Priorize o item 13 (rajada bot/burst) ou o 6 (micro-PIX + salto).',
  incompatibilidade: 'Priorize o item 14 (disparidade extrema de renda) ou o 10 (conta dormente).',
  conta_passagem: 'Priorize o item 8 (conta de passagem rápida).',
  fan_in_out: 'Priorize o item 7 (fan-out) ou o 9 (fan-in).',
  horario_atipico: 'Priorize o Bloco A (itens 1–4: sequestro noturno, drible de limite, esvaziamento, furto).',
  valores_redondos: 'Priorize o item 12 (valores redondos repetitivos).',
  coacao_fisica: 'Use exclusivamente o Bloco A (itens 1–4).',
  invasao_digital: 'Use exclusivamente o Bloco B (itens 5–7).',
  laranjas_mulas: 'Use exclusivamente o Bloco C (itens 8–10).',
  bacen_avancado: 'Use exclusivamente o Bloco D (itens 11–15).',
};
