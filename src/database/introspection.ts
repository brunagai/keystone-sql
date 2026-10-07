import type { Database, QueryExecResult, SqlValue } from 'sql.js';

interface ForeignKeyRef {
  table: string;
  column: string;
}

export interface ColumnSchema {
  name: string;
  type: string;
  notNull: boolean;
  primaryKey: boolean;
  foreignKey: ForeignKeyRef | null;
}

export interface TableSchema {
  name: string;
  rowCount: number;
  columns: ColumnSchema[];
}

/** Nomes vêm de sqlite_master, mas ainda assim são escapados para uso em PRAGMA/SELECT. */
const quoteIdent = (name: string): string => `"${name.replaceAll('"', '""')}"`;

function selectRows(db: Database, sql: string): Record<string, SqlValue>[] {
  const stmt = db.prepare(sql);
  const rows: Record<string, SqlValue>[] = [];
  try {
    while (stmt.step()) rows.push(stmt.getAsObject());
  } finally {
    stmt.free();
  }
  return rows;
}

function listTables(db: Database): string[] {
  return selectRows(db, "SELECT name FROM sqlite_master WHERE type = 'table' AND name NOT LIKE 'sqlite_%' ORDER BY rowid").map(
    (r) => String(r['name']),
  );
}

function getTableSchema(db: Database, table: string): TableSchema {
  const ident = quoteIdent(table);
  const foreignKeys = new Map<string, ForeignKeyRef>(
    selectRows(db, `PRAGMA foreign_key_list(${ident})`).map((fk) => [
      String(fk['from']),
      { table: String(fk['table']), column: String(fk['to']) },
    ]),
  );

  const columns = selectRows(db, `PRAGMA table_info(${ident})`).map<ColumnSchema>((c) => {
    const name = String(c['name']);
    return {
      name,
      type: String(c['type'] || 'ANY'),
      notNull: Number(c['notnull']) === 1,
      primaryKey: Number(c['pk']) > 0,
      foreignKey: foreignKeys.get(name) ?? null,
    };
  });

  const rowCount = Number(db.exec(`SELECT COUNT(*) FROM ${ident}`)[0]?.values[0]?.[0] ?? 0);
  return { name: table, rowCount, columns };
}

export function getDatabaseSchema(db: Database): TableSchema[] {
  return listTables(db).map((t) => getTableSchema(db, t));
}

export function previewTable(db: Database, table: string, limit = 3): QueryExecResult | null {
  return db.exec(`SELECT * FROM ${quoteIdent(table)} LIMIT ${Math.max(1, Math.trunc(limit))}`)[0] ?? null;
}
