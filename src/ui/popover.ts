export interface PopoverController {
  open(): void;
  close(): void;
  readonly isOpen: boolean;
}

/** Liga um botão a um painel flutuante: alterna no clique, fecha com Esc ou clique fora e devolve o foco ao botão. */
export function bindPopover(trigger: HTMLButtonElement, panel: HTMLElement, onOpen?: () => void): PopoverController {
  trigger.setAttribute('aria-haspopup', 'true');
  trigger.setAttribute('aria-controls', panel.id);

  const isOpen = (): boolean => trigger.getAttribute('aria-expanded') === 'true';
  const setOpen = (open: boolean): void => {
    panel.hidden = !open;
    trigger.setAttribute('aria-expanded', String(open));
    if (open) onOpen?.();
  };
  setOpen(false);

  trigger.addEventListener('click', () => setOpen(!isOpen()));

  document.addEventListener('pointerdown', (event) => {
    const target = event.target as Node;
    if (isOpen() && !panel.contains(target) && !trigger.contains(target)) setOpen(false);
  });

  const closeOnEscape = (event: KeyboardEvent): void => {
    if (event.key !== 'Escape' || !isOpen()) return;
    setOpen(false);
    trigger.focus();
  };
  panel.addEventListener('keydown', closeOnEscape);
  trigger.addEventListener('keydown', closeOnEscape);

  return {
    open: () => setOpen(true),
    close: () => setOpen(false),
    get isOpen() {
      return isOpen();
    },
  };
}
