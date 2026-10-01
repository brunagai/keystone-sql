const brl = new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' });
const inteiro = new Intl.NumberFormat('pt-BR');

export const formatBRL = (valor: number): string => brl.format(valor);
export const formatInteiro = (valor: number): string => inteiro.format(valor);

export function escapeHtml(value: unknown): string {
  return String(value)
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#39;');
}
