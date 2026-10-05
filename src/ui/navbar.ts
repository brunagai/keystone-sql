const FLOATING_MENU_IDS = ['history-panel', 'export-menu', 'selection-help'] as const;

/** Fecha popovers da chrome antes de qualquer init, para não ficarem soltos se o JS interromper. */
export function hideFloatingMenus(): void {
  for (const id of FLOATING_MENU_IDS) {
    const node = document.getElementById(id);
    if (!node) continue;
    node.hidden = true;
  }
}

/** Garante o seletor de casos na barra superior e oculta menus flutuantes. */
export function initNavbar(): HTMLSelectElement | null {
  hideFloatingMenus();
  const select = document.getElementById('scenario-select');
  return select instanceof HTMLSelectElement ? select : null;
}
