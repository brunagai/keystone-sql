import { byId } from './dom.ts';

const STORAGE_KEY = 'aml-lab:sidebar-width';
const MIN_WIDTH_PX = 260;
const MAX_VIEWPORT_RATIO = 0.55;
const DEFAULT_RATIO = 0.36;
const KEYBOARD_STEP_PX = 24;

function readStoredWidth(): number | null {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return null;
    const value = Number(raw);
    return Number.isFinite(value) && value > 0 ? value : null;
  } catch {
    return null;
  }
}

function persistWidth(width: number): void {
  try {
    localStorage.setItem(STORAGE_KEY, String(Math.round(width)));
  } catch {
    /* quota / modo privado */
  }
}

function maxWidth(workspace: HTMLElement): number {
  return Math.max(MIN_WIDTH_PX, Math.floor(workspace.clientWidth * MAX_VIEWPORT_RATIO));
}

function clampWidth(workspace: HTMLElement, width: number): number {
  return Math.min(maxWidth(workspace), Math.max(MIN_WIDTH_PX, width));
}

/** Splitter vertical entre “O que fazer” e o editor. */
export function initWorkspaceSplit(): void {
  const workspace = byId('workspace');
  const sidebar = byId('investigation-panel');
  const gutter = byId('workspace-gutter');

  const apply = (width: number): number => {
    const next = clampWidth(workspace, width);
    sidebar.style.width = `${next}px`;
    gutter.setAttribute('aria-valuenow', String(Math.round(next)));
    gutter.setAttribute('aria-valuemax', String(maxWidth(workspace)));
    return next;
  };

  gutter.setAttribute('aria-valuemin', String(MIN_WIDTH_PX));
  gutter.setAttribute('role', 'separator');

  const stored = readStoredWidth();
  apply(stored ?? workspace.clientWidth * DEFAULT_RATIO);

  let dragging = false;

  const onPointerMove = (event: PointerEvent): void => {
    if (!dragging) return;
    const left = workspace.getBoundingClientRect().left;
    apply(event.clientX - left);
  };

  const stopDrag = (event: PointerEvent): void => {
    if (!dragging) return;
    dragging = false;
    gutter.classList.remove('bg-indigo-500/50');
    document.body.style.removeProperty('cursor');
    document.body.style.removeProperty('user-select');
    workspace.style.removeProperty('pointer-events');
    persistWidth(sidebar.getBoundingClientRect().width);
    if (gutter.hasPointerCapture(event.pointerId)) gutter.releasePointerCapture(event.pointerId);
  };

  gutter.addEventListener('pointerdown', (event) => {
    if (event.button !== 0) return;
    event.preventDefault();
    dragging = true;
    gutter.classList.add('bg-indigo-500/50');
    document.body.style.cursor = 'col-resize';
    document.body.style.userSelect = 'none';
    workspace.style.pointerEvents = 'none';
    gutter.setPointerCapture(event.pointerId);
    const left = workspace.getBoundingClientRect().left;
    apply(event.clientX - left);
  });

  gutter.addEventListener('pointermove', onPointerMove);
  gutter.addEventListener('pointerup', stopDrag);
  gutter.addEventListener('pointercancel', stopDrag);

  gutter.addEventListener('keydown', (event) => {
    if (event.key !== 'ArrowLeft' && event.key !== 'ArrowRight') return;
    event.preventDefault();
    const current = sidebar.getBoundingClientRect().width;
    const delta = event.key === 'ArrowRight' ? KEYBOARD_STEP_PX : -KEYBOARD_STEP_PX;
    persistWidth(apply(current + delta));
  });

  window.addEventListener('resize', () => {
    persistWidth(apply(sidebar.getBoundingClientRect().width));
  });
}
