import { byId } from './dom.ts';
import '../style.css';

const STORAGE_KEY = 'aml-lab:sidebar-width';
const MIN_WIDTH_PX = 260;
const MAX_VIEWPORT_RATIO = 0.55;
const DEFAULT_RATIO = 0.36;
const KEYBOARD_STEP_PX = 24;
const MOBILE_MEDIA = '(max-width: 767px)';

export type MobileWorkspacePane = 'mission' | 'editor' | 'results';

let mobilePane: MobileWorkspacePane = 'mission';
let syncWorkspace: (() => void) | null = null;

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

export function isMobileWorkspace(): boolean {
  return window.matchMedia(MOBILE_MEDIA).matches;
}

/** No mobile, troca a seção visível; no desktop não altera o layout. */
export function showMobilePane(pane: MobileWorkspacePane): void {
  mobilePane = pane;
  syncWorkspace?.();
}

function tabClass(active: boolean): string {
  return active
    ? 'flex min-h-10 flex-1 items-center justify-center rounded-lg bg-slate-800 px-2 text-[12px] font-medium text-slate-50'
    : 'flex min-h-10 flex-1 items-center justify-center rounded-lg px-2 text-[12px] font-medium text-slate-400';
}

function mountMobileSwitcher(workspace: HTMLElement): HTMLElement {
  const existing = document.getElementById('mobile-view-switcher');
  if (existing) return existing;

  const bar = document.createElement('div');
  bar.id = 'mobile-view-switcher';
  bar.setAttribute('role', 'tablist');
  bar.setAttribute('aria-label', 'Seção do laboratório');
  bar.className = 'flex shrink-0 gap-1 border-b border-slate-800 bg-zinc-950 p-1.5 md:hidden';
  bar.innerHTML = `
    <button type="button" role="tab" data-mobile-pane="mission" class="${tabClass(true)}">📋 Missão</button>
    <button type="button" role="tab" data-mobile-pane="editor" class="${tabClass(false)}">💻 Editor SQL</button>
    <button type="button" role="tab" data-mobile-pane="results" class="${tabClass(false)}">📊 Resultados</button>`;
  workspace.insertBefore(bar, workspace.firstChild);
  return bar;
}

/** Splitter vertical entre “O que fazer” e o editor. Abaixo de 768px vira abas em tela cheia. */
export function initWorkspaceSplit(): void {
  const workspace = byId('workspace');
  const sidebar = byId('investigation-panel');
  const gutter = byId('workspace-gutter');
  const queryPanel = byId('query-panel');
  const editorContainer = byId('editor-container');
  const outputPane = byId('output-pane');
  const switcher = mountMobileSwitcher(workspace);
  const media = window.matchMedia(MOBILE_MEDIA);

  workspace.classList.add('max-md:flex-col');
  gutter.classList.add('max-md:hidden');
  byId('btn-run').classList.add('max-md:min-h-10');
  byId('btn-validate').classList.add('max-md:min-h-10');
  const editorToolbar = editorContainer.querySelector<HTMLElement>(':scope > div');
  editorToolbar?.classList.add('max-md:h-auto', 'max-md:min-h-10', 'max-md:overflow-x-auto', 'max-md:flex-nowrap');

  const apply = (width: number): number => {
    const next = clampWidth(workspace, width);
    sidebar.style.width = `${next}px`;
    gutter.setAttribute('aria-valuenow', String(Math.round(next)));
    gutter.setAttribute('aria-valuemax', String(maxWidth(workspace)));
    return next;
  };

  const paintSwitcher = (): void => {
    for (const button of switcher.querySelectorAll<HTMLButtonElement>('[data-mobile-pane]')) {
      const pane = button.dataset['mobilePane'];
      const on = pane === mobilePane;
      button.className = tabClass(on);
      button.setAttribute('aria-selected', String(on));
    }
  };

  const restoreDesktop = (): void => {
    document.body.classList.add('h-screen', 'overflow-hidden');
    document.body.classList.remove('min-h-[100dvh]', 'overflow-y-auto');
    document.getElementById('app')?.classList.add('h-screen', 'overflow-hidden');
    document.getElementById('app')?.classList.remove('min-h-[100dvh]', 'overflow-visible');
    sidebar.hidden = false;
    queryPanel.hidden = false;
    editorContainer.hidden = false;
    outputPane.hidden = false;
    sidebar.style.removeProperty('flex');
    sidebar.style.removeProperty('max-width');
    queryPanel.style.removeProperty('flex');
    editorContainer.classList.add('flex-[1.15]');
    editorContainer.classList.remove('flex-1');
    outputPane.classList.remove('min-h-[50dvh]');
    document.documentElement.style.removeProperty('--lab-vh');
    const stored = readStoredWidth();
    apply(stored ?? workspace.clientWidth * DEFAULT_RATIO);
  };

  const applyMobilePanes = (): void => {
    document.body.classList.remove('h-screen', 'overflow-hidden');
    document.body.classList.add('min-h-[100dvh]', 'overflow-y-auto');
    document.getElementById('app')?.classList.remove('h-screen', 'overflow-hidden');
    document.getElementById('app')?.classList.add('min-h-[100dvh]', 'overflow-visible');
    sidebar.style.width = '100%';
    sidebar.style.maxWidth = '100%';
    sidebar.style.flex = '1 1 auto';
    queryPanel.style.flex = '1 1 auto';
    sidebar.hidden = mobilePane !== 'mission';
    queryPanel.hidden = mobilePane === 'mission';
    editorContainer.hidden = mobilePane !== 'editor';
    outputPane.hidden = mobilePane !== 'results';
    editorContainer.classList.toggle('flex-1', mobilePane === 'editor');
    editorContainer.classList.toggle('flex-[1.15]', mobilePane !== 'editor');
    outputPane.classList.toggle('min-h-[50dvh]', mobilePane === 'results');
    outputPane.classList.add('overflow-y-auto');
    const vh = window.visualViewport?.height ?? window.innerHeight;
    document.documentElement.style.setProperty('--lab-vh', `${Math.round(vh)}px`);
  };

  const sync = (): void => {
    const mobile = media.matches;
    workspace.dataset['mobilePane'] = mobile ? mobilePane : 'desktop';
    switcher.hidden = !mobile;
    gutter.hidden = mobile;
    paintSwitcher();
    if (mobile) applyMobilePanes();
    else restoreDesktop();
  };
  syncWorkspace = sync;

  gutter.setAttribute('aria-valuemin', String(MIN_WIDTH_PX));
  gutter.setAttribute('role', 'separator');

  switcher.addEventListener('click', (event) => {
    const target = event.target;
    if (!(target instanceof Element)) return;
    const pane = target.closest<HTMLElement>('[data-mobile-pane]')?.dataset['mobilePane'];
    if (pane !== 'mission' && pane !== 'editor' && pane !== 'results') return;
    mobilePane = pane;
    sync();
  });

  let dragging = false;

  const onPointerMove = (event: PointerEvent): void => {
    if (!dragging || media.matches) return;
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
    if (!media.matches) persistWidth(sidebar.getBoundingClientRect().width);
    if (gutter.hasPointerCapture(event.pointerId)) gutter.releasePointerCapture(event.pointerId);
  };

  gutter.addEventListener('pointerdown', (event) => {
    if (media.matches || event.button !== 0) return;
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
    if (media.matches) return;
    if (event.key !== 'ArrowLeft' && event.key !== 'ArrowRight') return;
    event.preventDefault();
    const current = sidebar.getBoundingClientRect().width;
    const delta = event.key === 'ArrowRight' ? KEYBOARD_STEP_PX : -KEYBOARD_STEP_PX;
    persistWidth(apply(current + delta));
  });

  const onViewportChange = (): void => {
    sync();
  };

  window.visualViewport?.addEventListener('resize', () => {
    if (media.matches) sync();
  });
  media.addEventListener('change', onViewportChange);
  window.addEventListener('resize', () => {
    if (!media.matches) persistWidth(apply(sidebar.getBoundingClientRect().width));
  });

  sync();
}
