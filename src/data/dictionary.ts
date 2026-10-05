export interface TableDictionary {
  descricao: string;
  colunas: Record<string, string>;
}

export const DATA_DICTIONARY: Record<string, TableDictionary> = {
  contas: {
    descricao: 'Cadastro KYC das contas de pagamento (PF e PJ) com renda/faturamento declarado e indicador de Pessoa Exposta Politicamente (PEP).',
    colunas: {
      id_conta: 'Identificador interno da conta.',
      titular: 'Nome do titular ou razão social.',
      tipo_pessoa: "'PF' (pessoa física) ou 'PJ' (pessoa jurídica).",
      documento: 'CPF (11 dígitos) ou CNPJ (14 dígitos), somente números.',
      ocupacao: 'Ocupação (PF) ou atividade econômica (PJ).',
      renda_mensal_declarada: 'Renda mensal (PF) ou faturamento mensal (PJ) declarado, em BRL.',
      banco_ispb: 'Código ISPB da instituição detentora da conta.',
      banco_nome: 'Nome da instituição financeira.',
      agencia: 'Agência.',
      numero_conta: 'Número da conta com dígito.',
      tipo_chave_pix: 'Tipo da chave PIX principal: CPF, CNPJ, EMAIL ou ALEATORIA.',
      chave_pix: 'Valor da chave PIX principal.',
      cidade: 'Município do cadastro.',
      uf: 'Unidade federativa (2 letras).',
      data_abertura: 'Data de abertura da conta (YYYY-MM-DD).',
      eh_pep: 'Indicador KYC de Pessoa Exposta Politicamente (1 = PEP, 0 = não).',
      cargo_pep: 'Cargo ou função que motiva o enquadramento PEP (NULL se eh_pep = 0).',
    },
  },
  transacoes_pix: {
    descricao: 'Liquidações PIX entre contas, com E2E ID e horário de Brasília.',
    colunas: {
      id_transacao: 'End-to-End ID (E2E) do PIX, 32 caracteres.',
      id_conta_origem: 'Conta pagadora.',
      id_conta_destino: 'Conta recebedora.',
      valor: 'Valor liquidado em BRL.',
      data_hora: "Data/hora 'YYYY-MM-DD HH:MM:SS'. Use unixepoch()/julianday() para diferenças.",
      tipo_chave_destino: 'Tipo da chave PIX usada para endereçar o recebedor.',
      chave_pix_destino: 'Chave PIX usada para endereçar o recebedor.',
      descricao: 'Informação ao recebedor (texto livre, pode ser NULL).',
      canal: 'Canal de iniciação: APP, INTERNET_BANKING ou API.',
    },
  },
  socios_empresas: {
    descricao: 'Quadro societário (QSA) das contas PJ: participação, administrador e UBO/laranjas (Carta Circular Bacen 4.001).',
    colunas: {
      id_socio: 'Identificador do vínculo societário.',
      id_conta_empresa: 'Conta PJ em contas.id_conta.',
      cnpj_empresa: 'CNPJ da empresa (somente números).',
      cpf_socio: 'CPF do sócio (somente números).',
      nome_socio: 'Nome civil do sócio.',
      percentual_participacao: 'Percentual de participação (0–100].',
      eh_administrador: '1 se administrador; 0 caso contrário.',
      data_entrada: 'Data de entrada no quadro (YYYY-MM-DD).',
    },
  },
  acessos_digitais: {
    descricao: 'Histórico de logins, dispositivos e geolocalização para investigar account takeover e acesso atípico.',
    colunas: {
      id_acesso: 'Identificador do evento de acesso.',
      id_conta: 'Conta autenticada (contas.id_conta).',
      device_id: 'Identificador do dispositivo.',
      ip: 'Endereço IP de origem.',
      geolocalizacao_cidade: 'Cidade inferida do acesso.',
      geolocalizacao_uf: 'UF inferida do acesso.',
      latitude: 'Latitude (pode ser NULL).',
      longitude: 'Longitude (pode ser NULL).',
      sucesso: '1 = login bem-sucedido; 0 = falha.',
      data_hora: "Data/hora 'YYYY-MM-DD HH:MM:SS'.",
    },
  },
  operacoes_produtos: {
    descricao: 'Aportes em consórcio e produtos financeiros com liquidação atípica (espécie, PIX, TED).',
    colunas: {
      id_operacao: 'Identificador da operação.',
      id_conta: 'Conta titular do aporte.',
      tipo_produto: 'CONSORCIO_LANCE, CDB_LIQUIDEZ_DIARIA, PREVIDENCIA_VGBL ou FUNDOS_RENDA_FIXA.',
      valor_aporte: 'Valor aportado em BRL.',
      forma_liquidacao: 'ESPECIE, PIX, TED ou SALDO_CONTA.',
      status_contemplacao: '1 se contemplado (consórcio); 0 caso contrário.',
      data_operacao: 'Data da operação (YYYY-MM-DD).',
    },
  },
};
