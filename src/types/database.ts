/** Data/hora no formato SQLite `YYYY-MM-DD HH:MM:SS`. */
export type DataHoraSqlite = string;

/** Data no formato `YYYY-MM-DD`. */
export type DataIso = string;

export type TipoProduto = 'CONSORCIO_LANCE' | 'CDB_LIQUIDEZ_DIARIA' | 'PREVIDENCIA_VGBL' | 'FUNDOS_RENDA_FIXA';

export type FormaLiquidacao = 'ESPECIE' | 'PIX' | 'TED' | 'SALDO_CONTA';

/** Quadro societário (QSA / UBO) de contas PJ. */
export interface SocioEmpresa {
  id_socio: string;
  id_conta_empresa: string;
  cnpj_empresa: string;
  cpf_socio: string;
  nome_socio: string;
  percentual_participacao: number;
  eh_administrador: 0 | 1;
  data_entrada: DataIso;
}

export type StatusDispositivo = 'CONFIÁVEL' | 'SUSPEITO' | 'DESCONHECIDO';

/** Login, dispositivo e geolocalização (account takeover / acesso atípico). */
export interface AcessoDigital {
  id_acesso: string;
  id_conta: string;
  device_id: string;
  ip: string;
  geolocalizacao_cidade: string;
  geolocalizacao_uf: string;
  latitude: number | null;
  longitude: number | null;
  sucesso: 0 | 1;
  status_dispositivo: StatusDispositivo;
  data_hora: DataHoraSqlite;
}

/** Aporte em consórcio ou produto financeiro com liquidação atípica. */
export interface OperacaoProduto {
  id_operacao: string;
  id_conta: string;
  tipo_produto: TipoProduto;
  valor_aporte: number;
  forma_liquidacao: FormaLiquidacao;
  status_contemplacao: 0 | 1;
  data_operacao: DataIso;
}
