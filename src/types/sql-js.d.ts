// Build clássica do sql.js, pareada com dist/sql-wasm.wasm. O entry "sql.js" resolve, no navegador,
// para dist/sql-wasm-browser.js, que exige outro binário (sql-wasm-browser.wasm).
declare module 'sql.js/dist/sql-wasm.js' {
  import initSqlJs from 'sql.js';
  export default initSqlJs;
}
