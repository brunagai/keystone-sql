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
  | 'valores_redondos';

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
};

export const DIFFICULTY_LABELS: Record<ChallengeDifficulty, string> = {
  iniciante: 'Iniciante',
  intermediario: 'Intermediário',
  avancado: 'Avançado',
};
