export const SCHEMA_SQL = /* sql */ `
  PRAGMA foreign_keys = ON;

  CREATE TABLE IF NOT EXISTS contas (
    id_conta               TEXT PRIMARY KEY,
    titular                TEXT NOT NULL,
    tipo_pessoa            TEXT NOT NULL CHECK (tipo_pessoa IN ('PF', 'PJ')),
    documento              TEXT NOT NULL UNIQUE,
    ocupacao               TEXT NOT NULL,
    renda_mensal_declarada REAL NOT NULL CHECK (renda_mensal_declarada >= 0),
    banco_ispb             TEXT NOT NULL,
    banco_nome             TEXT NOT NULL,
    agencia                TEXT NOT NULL,
    numero_conta           TEXT NOT NULL,
    tipo_chave_pix         TEXT NOT NULL CHECK (tipo_chave_pix IN ('CPF', 'CNPJ', 'EMAIL', 'ALEATORIA')),
    chave_pix              TEXT NOT NULL UNIQUE,
    cidade                 TEXT NOT NULL,
    uf                     TEXT NOT NULL CHECK (length(uf) = 2),
    data_abertura          TEXT NOT NULL,
    eh_pep                 INTEGER NOT NULL DEFAULT 0 CHECK (eh_pep IN (0, 1)),
    cargo_pep              TEXT,
    CHECK ((eh_pep = 0 AND cargo_pep IS NULL) OR (eh_pep = 1 AND cargo_pep IS NOT NULL))
  );

  CREATE TABLE IF NOT EXISTS transacoes_pix (
    id_transacao       TEXT PRIMARY KEY,
    id_conta_origem    TEXT NOT NULL REFERENCES contas (id_conta),
    id_conta_destino   TEXT NOT NULL REFERENCES contas (id_conta),
    valor              REAL NOT NULL CHECK (valor > 0),
    data_hora          TEXT NOT NULL,
    tipo_chave_destino TEXT NOT NULL CHECK (tipo_chave_destino IN ('CPF', 'CNPJ', 'EMAIL', 'ALEATORIA')),
    chave_pix_destino  TEXT NOT NULL,
    descricao          TEXT,
    canal              TEXT NOT NULL CHECK (canal IN ('APP', 'INTERNET_BANKING', 'API')),
    CHECK (id_conta_origem <> id_conta_destino)
  );

  CREATE INDEX IF NOT EXISTS idx_transacoes_data_hora ON transacoes_pix (data_hora);
  CREATE INDEX IF NOT EXISTS idx_transacoes_origem    ON transacoes_pix (id_conta_origem, data_hora);
  CREATE INDEX IF NOT EXISTS idx_transacoes_destino   ON transacoes_pix (id_conta_destino, data_hora);

  CREATE TABLE IF NOT EXISTS socios_empresas (
    id_socio                 TEXT PRIMARY KEY,
    id_conta_empresa         TEXT NOT NULL REFERENCES contas (id_conta) ON DELETE CASCADE,
    cnpj_empresa             TEXT NOT NULL,
    cpf_socio                TEXT NOT NULL,
    nome_socio               TEXT NOT NULL,
    percentual_participacao  REAL NOT NULL CHECK (percentual_participacao > 0 AND percentual_participacao <= 100),
    eh_administrador         INTEGER NOT NULL CHECK (eh_administrador IN (0, 1)),
    data_entrada             TEXT NOT NULL
  );

  CREATE INDEX IF NOT EXISTS idx_socios_conta ON socios_empresas (id_conta_empresa);
  CREATE INDEX IF NOT EXISTS idx_socios_cpf   ON socios_empresas (cpf_socio);

  CREATE TABLE IF NOT EXISTS acessos_digitais (
    id_acesso              TEXT PRIMARY KEY,
    id_conta               TEXT NOT NULL REFERENCES contas (id_conta) ON DELETE CASCADE,
    device_id              TEXT NOT NULL,
    ip                     TEXT NOT NULL,
    geolocalizacao_cidade  TEXT NOT NULL,
    geolocalizacao_uf      TEXT NOT NULL,
    latitude               REAL,
    longitude              REAL,
    sucesso                INTEGER NOT NULL CHECK (sucesso IN (0, 1)),
    status_dispositivo     TEXT NOT NULL DEFAULT 'CONFIÁVEL',
    data_hora              TEXT NOT NULL
  );

  CREATE INDEX IF NOT EXISTS idx_acessos_conta_hora ON acessos_digitais (id_conta, data_hora);
  CREATE INDEX IF NOT EXISTS idx_acessos_device     ON acessos_digitais (device_id);

  CREATE TABLE IF NOT EXISTS operacoes_produtos (
    id_operacao           TEXT PRIMARY KEY,
    id_conta              TEXT NOT NULL REFERENCES contas (id_conta) ON DELETE CASCADE,
    tipo_produto          TEXT NOT NULL CHECK (tipo_produto IN ('CONSORCIO_LANCE', 'CDB_LIQUIDEZ_DIARIA', 'PREVIDENCIA_VGBL', 'FUNDOS_RENDA_FIXA')),
    valor_aporte          REAL NOT NULL CHECK (valor_aporte > 0),
    forma_liquidacao      TEXT NOT NULL CHECK (forma_liquidacao IN ('ESPECIE', 'PIX', 'TED', 'SALDO_CONTA')),
    status_contemplacao   INTEGER DEFAULT 0 CHECK (status_contemplacao IN (0, 1)),
    data_operacao         TEXT NOT NULL
  );

  CREATE INDEX IF NOT EXISTS idx_operacoes_conta      ON operacoes_produtos (id_conta);
  CREATE INDEX IF NOT EXISTS idx_operacoes_liquidacao ON operacoes_produtos (forma_liquidacao);
`;
