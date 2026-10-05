export type DictionaryCategory =
  | 'Cadastral & Societário'
  | 'Transacional'
  | 'Segurança & Telemetria'
  | 'Investimentos & Produtos';

export interface ColumnDictionary {
  descricao: string;
  /** Valor sintético típico, para o estudante reconhecer o formato. */
  exemplo: string;
  pk?: boolean;
  /** Tabela referenciada, quando a coluna é FK. */
  fk?: string;
}

export interface TableDictionary {
  categoria: DictionaryCategory;
  descricao: string;
  colunas: Record<string, ColumnDictionary>;
}

const col = (
  descricao: string,
  exemplo: string,
  keys: { pk?: boolean; fk?: string } = {},
): ColumnDictionary => ({ descricao, exemplo, ...keys });

export const DATA_DICTIONARY: Record<string, TableDictionary> = {
  contas: {
    categoria: 'Cadastral & Societário',
    descricao:
      'Cadastro KYC das contas de pagamento (PF e PJ) com renda/faturamento declarado e indicador de Pessoa Exposta Politicamente (PEP).',
    colunas: {
      id_conta: col('Identificador interno da conta.', 'C025', { pk: true }),
      titular: col('Nome do titular ou razão social.', 'Comercial Aurora Importados Ltda'),
      tipo_pessoa: col("'PF' (pessoa física) ou 'PJ' (pessoa jurídica).", 'PJ'),
      documento: col('CPF (11 dígitos) ou CNPJ (14 dígitos), somente números.', '12345678000190'),
      ocupacao: col('Ocupação (PF) ou atividade econômica (PJ).', 'Comércio de Variedades'),
      renda_mensal_declarada: col('Renda mensal (PF) ou faturamento mensal (PJ) declarado, em BRL.', '18000'),
      banco_ispb: col('Código ISPB da instituição detentora da conta.', '31872495'),
      banco_nome: col('Nome da instituição financeira.', 'Banco C6 S.A.'),
      agencia: col('Agência.', '0001'),
      numero_conta: col('Número da conta com dígito.', '1234567-8'),
      tipo_chave_pix: col('Tipo da chave PIX principal: CPF, CNPJ, EMAIL ou ALEATORIA.', 'CNPJ'),
      chave_pix: col('Valor da chave PIX principal.', '12345678000190'),
      cidade: col('Município do cadastro.', 'São Paulo'),
      uf: col('Unidade federativa (2 letras).', 'SP'),
      data_abertura: col('Data de abertura da conta (YYYY-MM-DD).', '2026-06-15'),
      eh_pep: col('Indicador KYC de Pessoa Exposta Politicamente (1 = PEP, 0 = não).', '0'),
      cargo_pep: col('Cargo ou função que motiva o enquadramento PEP (NULL se eh_pep = 0).', 'NULL'),
    },
  },
  transacoes_pix: {
    categoria: 'Transacional',
    descricao: 'Liquidações PIX entre contas, com E2E ID e horário de Brasília.',
    colunas: {
      id_transacao: col('End-to-End ID (E2E) do PIX, 32 caracteres.', 'E31872495202608061022…', { pk: true }),
      id_conta_origem: col('Conta pagadora.', 'C026', { fk: 'contas' }),
      id_conta_destino: col('Conta recebedora.', 'C025', { fk: 'contas' }),
      valor: col('Valor liquidado em BRL.', '9800.00'),
      data_hora: col("Data/hora 'YYYY-MM-DD HH:MM:SS'. Use unixepoch()/julianday() para diferenças.", '2026-08-06 09:05:12'),
      tipo_chave_destino: col('Tipo da chave PIX usada para endereçar o recebedor.', 'CNPJ'),
      chave_pix_destino: col('Chave PIX usada para endereçar o recebedor.', '12345678000190'),
      descricao: col('Informação ao recebedor (texto livre, pode ser NULL).', 'pgto pedido'),
      canal: col('Canal de iniciação: APP, INTERNET_BANKING ou API.', 'APP'),
    },
  },
  socios_empresas: {
    categoria: 'Cadastral & Societário',
    descricao:
      'Quadro de Sócios e Administradores (QSA) para rastreamento de UBO (Beneficiário Final), empresas de fachada e blindagem patrimonial.',
    colunas: {
      id_socio: col('Identificador do vínculo societário.', 'S018', { pk: true }),
      id_conta_empresa: col('Conta PJ à qual o sócio está vinculado.', 'C025', { fk: 'contas' }),
      cnpj_empresa: col('CNPJ da empresa (somente números).', '12345678000190'),
      cpf_socio: col('CPF do sócio (somente números).', '10000000109'),
      nome_socio: col('Nome civil do sócio (pode ser laranja ou UBO oculto).', 'Rafael Nogueira Brito'),
      percentual_participacao: col('Percentual de participação no capital (0 exclusive a 100].', '1.0'),
      eh_administrador: col('1 se administrador; 0 se apenas sócio.', '1'),
      data_entrada: col('Data de entrada no quadro societário (YYYY-MM-DD).', '2026-06-15'),
    },
  },
  acessos_digitais: {
    categoria: 'Segurança & Telemetria',
    descricao:
      'Logs de autenticação digital em canais remotos (app/web) para detecção de Account Takeover (ATO), velocidade impossível e uso de VPNs.',
    colunas: {
      id_acesso: col('Identificador do evento de acesso.', 'A077', { pk: true }),
      id_conta: col('Conta autenticada.', 'C001', { fk: 'contas' }),
      device_id: col('Identificador persistente do dispositivo.', 'DEV-C001-ATO'),
      ip: col('Endereço IP de origem da sessão.', '191.5.80.12'),
      geolocalizacao_cidade: col('Cidade inferida do acesso.', 'Manaus'),
      geolocalizacao_uf: col('UF inferida do acesso.', 'AM'),
      latitude: col('Latitude WGS84 (pode ser NULL).', '-3.119'),
      longitude: col('Longitude WGS84 (pode ser NULL).', '-60.0217'),
      sucesso: col('1 = login bem-sucedido; 0 = falha de autenticação.', '1'),
      data_hora: col("Instante do evento 'YYYY-MM-DD HH:MM:SS'.", '2026-08-21 14:05:18'),
    },
  },
  operacoes_produtos: {
    categoria: 'Investimentos & Produtos',
    descricao:
      'Aportes em consórcios e aplicações de renda fixa com liquidação atípica (ex.: dinheiro em espécie para integralização de cotas contempladas).',
    colunas: {
      id_operacao: col('Identificador da operação de produto.', 'O001', { pk: true }),
      id_conta: col('Conta titular do aporte.', 'C025', { fk: 'contas' }),
      tipo_produto: col(
        'CONSORCIO_LANCE, CDB_LIQUIDEZ_DIARIA, PREVIDENCIA_VGBL ou FUNDOS_RENDA_FIXA.',
        'CONSORCIO_LANCE',
      ),
      valor_aporte: col('Valor aportado em BRL.', '85000.00'),
      forma_liquidacao: col('ESPECIE, PIX, TED ou SALDO_CONTA.', 'ESPECIE'),
      status_contemplacao: col('1 se contemplado (consórcio); 0 caso contrário.', '1'),
      data_operacao: col('Data da operação (YYYY-MM-DD).', '2026-08-12'),
    },
  },
};

export const CATEGORY_ORDER: readonly DictionaryCategory[] = [
  'Cadastral & Societário',
  'Transacional',
  'Segurança & Telemetria',
  'Investimentos & Produtos',
];
