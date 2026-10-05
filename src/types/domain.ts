import type { AcessoDigital, OperacaoProduto, SocioEmpresa } from './database.ts';

export type TipoPessoa = 'PF' | 'PJ';

export type TipoChavePix = 'CPF' | 'CNPJ' | 'EMAIL' | 'ALEATORIA';

export type CanalTransacao = 'APP' | 'INTERNET_BANKING' | 'API';

/** Data/hora no formato SQLite `YYYY-MM-DD HH:MM:SS`, horário de Brasília. */
export type DataHoraSqlite = string;

/** Data no formato `YYYY-MM-DD`. */
export type DataIso = string;

export interface Conta {
  id_conta: string;
  titular: string;
  tipo_pessoa: TipoPessoa;
  /** CPF (11 dígitos) ou CNPJ (14 dígitos), somente números. */
  documento: string;
  /** Ocupação (PF) ou atividade econômica (PJ). */
  ocupacao: string;
  /** Renda mensal (PF) ou faturamento mensal (PJ) declarado no cadastro, em BRL. */
  renda_mensal_declarada: number;
  banco_ispb: string;
  banco_nome: string;
  agencia: string;
  numero_conta: string;
  tipo_chave_pix: TipoChavePix;
  chave_pix: string;
  cidade: string;
  uf: string;
  data_abertura: DataIso;
  /** 1 = Pessoa Exposta Politicamente; 0 = demais. */
  eh_pep: 0 | 1;
  /** Cargo PEP; nulo quando `eh_pep` é 0. */
  cargo_pep: string | null;
}

export interface TransacaoPix {
  /** Identificador fim a fim (E2E ID) do PIX, 32 caracteres. */
  id_transacao: string;
  id_conta_origem: string;
  id_conta_destino: string;
  /** Valor em BRL com duas casas decimais. */
  valor: number;
  data_hora: DataHoraSqlite;
  tipo_chave_destino: TipoChavePix;
  chave_pix_destino: string;
  descricao: string | null;
  canal: CanalTransacao;
}

export interface CenarioDocumentado {
  tipologia: string;
  descricao: string;
  contas_envolvidas: string[];
}

export interface DatasetMetadata {
  versao: string;
  gerado_em: DataHoraSqlite;
  moeda: 'BRL';
  fuso_horario: string;
  periodo: { inicio: DataIso; fim: DataIso };
  limiar_regulatorio_brl: number;
  observacao: string;
  cenarios: CenarioDocumentado[];
}

export interface Dataset {
  metadata: DatasetMetadata;
  contas: Conta[];
  transacoes_pix: TransacaoPix[];
  socios_empresas: SocioEmpresa[];
  acessos_digitais: AcessoDigital[];
  operacoes_produtos: OperacaoProduto[];
}
