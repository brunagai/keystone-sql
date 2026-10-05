const FLOATING_MENU_IDS = ['history-panel', 'export-menu', 'selection-help'] as const;

/** Fecha popovers da chrome antes de qualquer init, para não ficarem soltos se o JS interromper. */
export function hideFloatingMenus(): void {
  for (const id of FLOATING_MENU_IDS) {
    const node = document.getElementById(id);
    if (!node) continue;
    node.hidden = true;
  }
}

/**
 * Seletor `#scenario-select` (preenchido em `investigationPanel`):
 * trilha 0–5; filtro Iniciante = níveis 0–2; carga inicial = Caso 0.1.
 */
export function initNavbar(): HTMLSelectElement | null {
  hideFloatingMenus();
  const select = document.getElementById('scenario-select');
  return select instanceof HTMLSelectElement ? select : null;
}
