export const SCHEMA_SQL = /* sql */ `
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
`;
