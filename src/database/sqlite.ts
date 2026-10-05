import type { Database, QueryExecResult, SqlJsStatic } from 'sql.js';
import initSqlJs from 'sql.js/dist/sql-wasm.js';
import rawDataset from '../data/dataset.json';
import type { Conta, Dataset, TransacaoPix } from '../types/domain.ts';
import type { AcessoDigital, OperacaoProduto, SocioEmpresa } from '../types/database.ts';
import { SCHEMA_SQL } from './schema.ts';

const dataset = rawDataset as Dataset;

/** O binário fica em public/ (copiado por scripts/copy-wasm.mjs) e é servido na base do app. */
const WASM_FILE = 'sql-wasm.wasm';

/**
 * A URL precisa ser absoluta: o Emscripten resolve caminhos relativos a partir do script do sql.js
 * (ex.: /node_modules/.vite/deps/), e não da página.
 */
const resolvePublicAsset = (file: string): string =>
  new URL(`${import.meta.env.BASE_URL}${file}`, document.baseURI).href;

let sqlJsPromise: Promise<SqlJsStatic> | null = null;
let databasePromise: Promise<Database> | null = null;

function loadSqlJs(): Promise<SqlJsStatic> {
  sqlJsPromise ??= initSqlJs({
    locateFile: resolvePublicAsset,
  }).catch((error: unknown) => {
    sqlJsPromise = null;
    throw new Error(
      `Falha ao carregar o SQLite WebAssembly (${WASM_FILE}). Verifique se o arquivo existe em public/ ` +
        `(rode "npm install" ou "node scripts/copy-wasm.mjs"). Detalhe: ${String(error)}`,
    );
  });
  return sqlJsPromise;
}

function insertContas(db: Database, contas: readonly Conta[]): void {
  const stmt = db.prepare(`
    INSERT INTO contas (
      id_conta, titular, tipo_pessoa, documento, ocupacao, renda_mensal_declarada,
      banco_ispb, banco_nome, agencia, numero_conta, tipo_chave_pix, chave_pix,
      cidade, uf, data_abertura, eh_pep, cargo_pep
    ) VALUES (
      $id_conta, $titular, $tipo_pessoa, $documento, $ocupacao, $renda_mensal_declarada,
      $banco_ispb, $banco_nome, $agencia, $numero_conta, $tipo_chave_pix, $chave_pix,
      $cidade, $uf, $data_abertura, $eh_pep, $cargo_pep
    )
  `);
  try {
    for (const c of contas) {
      stmt.run({
        $id_conta: c.id_conta,
        $titular: c.titular,
        $tipo_pessoa: c.tipo_pessoa,
        $documento: c.documento,
        $ocupacao: c.ocupacao,
        $renda_mensal_declarada: c.renda_mensal_declarada,
        $banco_ispb: c.banco_ispb,
        $banco_nome: c.banco_nome,
        $agencia: c.agencia,
        $numero_conta: c.numero_conta,
        $tipo_chave_pix: c.tipo_chave_pix,
        $chave_pix: c.chave_pix,
        $cidade: c.cidade,
        $uf: c.uf,
        $data_abertura: c.data_abertura,
        $eh_pep: c.eh_pep,
        $cargo_pep: c.cargo_pep,
      });
    }
  } finally {
    stmt.free();
  }
}

function insertTransacoes(db: Database, transacoes: readonly TransacaoPix[]): void {
  const stmt = db.prepare(`
    INSERT INTO transacoes_pix (
      id_transacao, id_conta_origem, id_conta_destino, valor, data_hora,
      tipo_chave_destino, chave_pix_destino, descricao, canal
    ) VALUES (
      $id_transacao, $id_conta_origem, $id_conta_destino, $valor, $data_hora,
      $tipo_chave_destino, $chave_pix_destino, $descricao, $canal
    )
  `);
  try {
    for (const t of transacoes) {
      stmt.run({
        $id_transacao: t.id_transacao,
        $id_conta_origem: t.id_conta_origem,
        $id_conta_destino: t.id_conta_destino,
        $valor: t.valor,
        $data_hora: t.data_hora,
        $tipo_chave_destino: t.tipo_chave_destino,
        $chave_pix_destino: t.chave_pix_destino,
        $descricao: t.descricao,
        $canal: t.canal,
      });
    }
  } finally {
    stmt.free();
  }
}

function insertSocios(db: Database, socios: readonly SocioEmpresa[]): void {
  const stmt = db.prepare(`
    INSERT INTO socios_empresas (
      id_socio, id_conta_empresa, cnpj_empresa, cpf_socio, nome_socio,
      percentual_participacao, eh_administrador, data_entrada
    ) VALUES (
      $id_socio, $id_conta_empresa, $cnpj_empresa, $cpf_socio, $nome_socio,
      $percentual_participacao, $eh_administrador, $data_entrada
    )
  `);
  try {
    for (const s of socios) {
      stmt.run({
        $id_socio: s.id_socio,
        $id_conta_empresa: s.id_conta_empresa,
        $cnpj_empresa: s.cnpj_empresa,
        $cpf_socio: s.cpf_socio,
        $nome_socio: s.nome_socio,
        $percentual_participacao: s.percentual_participacao,
        $eh_administrador: s.eh_administrador,
        $data_entrada: s.data_entrada,
      });
    }
  } finally {
    stmt.free();
  }
}

function insertAcessos(db: Database, acessos: readonly AcessoDigital[]): void {
  const stmt = db.prepare(`
    INSERT INTO acessos_digitais (
      id_acesso, id_conta, device_id, ip, geolocalizacao_cidade, geolocalizacao_uf,
      latitude, longitude, sucesso, data_hora
    ) VALUES (
      $id_acesso, $id_conta, $device_id, $ip, $geolocalizacao_cidade, $geolocalizacao_uf,
      $latitude, $longitude, $sucesso, $data_hora
    )
  `);
  try {
    for (const a of acessos) {
      stmt.run({
        $id_acesso: a.id_acesso,
        $id_conta: a.id_conta,
        $device_id: a.device_id,
        $ip: a.ip,
        $geolocalizacao_cidade: a.geolocalizacao_cidade,
        $geolocalizacao_uf: a.geolocalizacao_uf,
        $latitude: a.latitude,
        $longitude: a.longitude,
        $sucesso: a.sucesso,
        $data_hora: a.data_hora,
      });
    }
  } finally {
    stmt.free();
  }
}

function insertOperacoes(db: Database, operacoes: readonly OperacaoProduto[]): void {
  const stmt = db.prepare(`
    INSERT INTO operacoes_produtos (
      id_operacao, id_conta, tipo_produto, valor_aporte, forma_liquidacao,
      status_contemplacao, data_operacao
    ) VALUES (
      $id_operacao, $id_conta, $tipo_produto, $valor_aporte, $forma_liquidacao,
      $status_contemplacao, $data_operacao
    )
  `);
  try {
    for (const o of operacoes) {
      stmt.run({
        $id_operacao: o.id_operacao,
        $id_conta: o.id_conta,
        $tipo_produto: o.tipo_produto,
        $valor_aporte: o.valor_aporte,
        $forma_liquidacao: o.forma_liquidacao,
        $status_contemplacao: o.status_contemplacao,
        $data_operacao: o.data_operacao,
      });
    }
  } finally {
    stmt.free();
  }
}

export function seedDatabase(db: Database, data: Dataset = dataset): void {
  db.exec('BEGIN TRANSACTION;');
  try {
    insertContas(db, data.contas);
    insertTransacoes(db, data.transacoes_pix);
    insertSocios(db, data.socios_empresas ?? []);
    insertAcessos(db, data.acessos_digitais ?? []);
    insertOperacoes(db, data.operacoes_produtos ?? []);
    db.exec('COMMIT;');
  } catch (error) {
    db.exec('ROLLBACK;');
    throw error;
  }
}

/** Cria um banco em memória novo, com schema e seed aplicados. */
export async function createDatabase(): Promise<Database> {
  const SQL = await loadSqlJs();
  const db = new SQL.Database();
  db.exec('PRAGMA foreign_keys = ON;');
  db.exec(SCHEMA_SQL);
  seedDatabase(db);
  return db;
}

/** Instância compartilhada do banco (inicializada sob demanda). */
export function getDatabase(): Promise<Database> {
  databasePromise ??= createDatabase().catch((error: unknown) => {
    databasePromise = null;
    throw error;
  });
  return databasePromise;
}

/** Descarta o banco atual e recria a partir do dataset (útil após comandos DML/DDL do usuário). */
export async function resetDatabase(): Promise<Database> {
  const current = databasePromise;
  databasePromise = null;
  if (current) (await current.catch(() => null))?.close();
  return getDatabase();
}

export function runQuery(db: Database, sql: string): QueryExecResult[] {
  return db.exec(sql);
}

export interface TimedQueryResult {
  results: QueryExecResult[];
  elapsedMs: number;
}

export function executeTimedQuery(db: Database, sql: string): TimedQueryResult {
  const start = performance.now();
  const results = db.exec(sql);
  return { results, elapsedMs: performance.now() - start };
}

export const datasetMetadata = dataset.metadata;
