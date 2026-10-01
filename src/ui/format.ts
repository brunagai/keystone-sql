const brl = new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' });
const inteiro = new Intl.NumberFormat('pt-BR');
const decimal = new Intl.NumberFormat('pt-BR', { maximumFractionDigits: 4 });

export const formatBRL = (valor: number): string => brl.format(valor);
export const formatInteiro = (valor: number): string => inteiro.format(valor);
export const formatDecimal = (valor: number): string => decimal.format(valor);

const DATA_HORA_SQLITE = /^(\d{4})-(\d{2})-(\d{2})(?:[ T](\d{2}):(\d{2}):(\d{2}))?$/;

/** Converte `YYYY-MM-DD[ HH:MM:SS]` em `DD/MM/YYYY[ HH:MM:SS]`; retorna null se não for data. */
export function formatDataHora(value: string): string | null {
  const m = DATA_HORA_SQLITE.exec(value);
  if (!m) return null;
  const [, ano, mes, dia, hh, mm, ss] = m;
  const data = `${dia}/${mes}/${ano}`;
  return hh ? `${data} ${hh}:${mm}:${ss}` : data;
}

const COLUNA_MONETARIA = /valor|renda|faturamento|volume|montante|soma|brl|total_recebido|total_enviado|maior_pix/i;

export const isMonetaryColumn = (column: string): boolean => COLUNA_MONETARIA.test(column);

export function formatMs(ms: number): string {
  return ms < 10 ? `${ms.toFixed(2)} ms` : `${Math.round(ms)} ms`;
}

/** Escapa o texto e converte trechos entre crases em `<code>`. */
export function formatInline(text: string): string {
  return escapeHtml(text).replace(
    /`([^`]+)`/g,
    '<code class="rounded bg-slate-950/70 px-1 py-px font-mono text-[0.92em] text-emerald-200 break-words">$1</code>',
  );
}

export function escapeHtml(value: unknown): string {
  return String(value)
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#39;');
}
