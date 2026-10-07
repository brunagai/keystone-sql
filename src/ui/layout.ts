import { byId } from './dom.ts';
import '../style.css';

const STORAGE_KEY = 'aml-lab:sidebar-width';
const MIN_WIDTH_PX = 260;
const MAX_VIEWPORT_RATIO = 0.55;
const DEFAULT_RATIO = 0.36;
const KEYBOARD_STEP_PX = 24;
const MOBILE_MEDIA = '(max-width: 767px)';

export type MobileWorkspacePane = 'mission' | 'editor' | 'results';

let mobilePane: MobileWorkspacePane = 'editor';
let syncWorkspace: (() => void) | null = null;
let resultsSheetOpen = false;
let missionOverlayOpen = false;

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

function paintResultsSheet(): void {
  const pane = document.getElementById('output-pane');
  const backdrop = document.getElementById('results-backdrop');
  if (!pane) return;
  const open = isMobileWorkspace() && resultsSheetOpen;
  pane.dataset['sheet'] = open ? 'open' : 'closed';
  if (backdrop) {
    backdrop.hidden = !open;
    backdrop.classList.toggle('pointer-events-none', !open);
  }
}

function paintMissionOverlay(): void {
  const sidebar = document.getElementById('investigation-panel');
  if (!sidebar) return;
  const open = isMobileWorkspace() && missionOverlayOpen;
  sidebar.dataset['overlay'] = open ? 'open' : 'closed';
}

/** Abre a gaveta de resultados no mobile; no desktop não altera o layout. */
export function showResultsSheet(): void {
  resultsSheetOpen = true;
  mobilePane = 'results';
  paintResultsSheet();
}

/** Recolhe a gaveta sem limpar os dados. */
export function hideResultsSheet(): void {
  resultsSheetOpen = false;
  if (mobilePane === 'results') mobilePane = 'editor';
  paintResultsSheet();
}

export function showMissionOverlay(): void {
  missionOverlayOpen = true;
  mobilePane = 'mission';
  paintMissionOverlay();
}

export function hideMissionOverlay(): void {
  missionOverlayOpen = false;
  if (mobilePane === 'mission') mobilePane = 'editor';
  paintMissionOverlay();
}

/** No mobile, results abre a gaveta e mission abre o overlay; no desktop não altera o layout. */
export function showMobilePane(pane: MobileWorkspacePane): void {
  mobilePane = pane;
  if (pane === 'results') {
    resultsSheetOpen = true;
    missionOverlayOpen = false;
  } else if (pane === 'mission') {
    missionOverlayOpen = true;
  } else {
    resultsSheetOpen = false;
    missionOverlayOpen = false;
  }
  paintResultsSheet();
  paintMissionOverlay();
  syncWorkspace?.();
}

function tabClass(active: boolean): string {
  return active
    ? 'flex min-h-10 flex-1 items-center justify-center rounded-lg bg-slate-800 px-2 text-[12px] font-medium text-slate-50'
    : 'flex min-h-10 flex-1 items-center justify-center rounded-lg px-2 text-[12px] font-medium text-slate-400';
}

function mountMobileSwitcher(workspace: HTMLElement): HTMLElement {
  const existing = document.getElementById('mobile-view-switcher');
  if (existing) {
    existing.className = 'hidden md:flex';
    existing.hidden = true;
    return existing;
  }

  const bar = document.createElement('div');
  bar.id = 'mobile-view-switcher';
  bar.setAttribute('role', 'tablist');
  bar.setAttribute('aria-label', 'Seção do laboratório');
  bar.hidden = true;
  bar.className = 'hidden md:flex';
  bar.innerHTML = `
    <button type="button" role="tab" data-mobile-pane="mission" class="${tabClass(true)}">📋 Missão</button>
    <button type="button" role="tab" data-mobile-pane="editor" class="${tabClass(false)}">💻 Editor SQL</button>
    <button type="button" role="tab" data-mobile-pane="results" class="${tabClass(false)}">📊 Resultados</button>`;
  workspace.insertBefore(bar, workspace.firstChild);
  return bar;
}

/** Splitter vertical entre “O que fazer” e o editor. Abaixo de 768px o editor fica em tela cheia. */
export function initWorkspaceSplit(): void {
  const workspace = byId('workspace');
  const sidebar = byId('investigation-panel');
  const gutter = byId('workspace-gutter');
  const queryPanel = byId('query-panel');
  const editorContainer = byId('editor-container');
  const outputPane = byId('output-pane');
  const switcher = mountMobileSwitcher(workspace);
  const backdrop = document.getElementById('results-backdrop');
  const closeSheet = document.getElementById('btn-close-results-sheet');
  const closeOverlay = document.getElementById('btn-close-mission-overlay');
  const media = window.matchMedia(MOBILE_MEDIA);

  workspace.classList.add('max-md:flex-col');
  gutter.classList.add('max-md:hidden');
  byId('btn-run').classList.add('max-md:min-h-10');
  byId('btn-validate').classList.add('max-md:min-h-10');
  const editorToolbar = editorContainer.querySelector<HTMLElement>(':scope > div.flex.h-12');
  editorToolbar?.classList.add('max-md:h-auto', 'max-md:min-h-10', 'max-md:overflow-x-auto', 'max-md:flex-nowrap');

  const apply = (width: number): number => {
    const next = clampWidth(workspace, width);
    sidebar.style.width = `${next}px`;
    gutter.setAttribute('aria-valuenow', String(Math.round(next)));
    gutter.setAttribute('aria-valuemax', String(maxWidth(workspace)));
    return next;
  };

  const restoreDesktop = (): void => {
    resultsSheetOpen = false;
    missionOverlayOpen = false;
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
    paintResultsSheet();
    paintMissionOverlay();
  };

  const applyMobilePanes = (): void => {
    document.body.classList.add('h-[100dvh]', 'overflow-hidden');
    document.body.classList.remove('min-h-[100dvh]', 'overflow-y-auto');
    document.getElementById('app')?.classList.add('h-[100dvh]', 'overflow-hidden');
    document.getElementById('app')?.classList.remove('min-h-[100dvh]', 'overflow-visible');
    sidebar.style.width = '100%';
    sidebar.style.maxWidth = '100%';
    sidebar.hidden = false;
    queryPanel.hidden = false;
    editorContainer.hidden = false;
    outputPane.hidden = false;
    queryPanel.style.flex = '1 1 auto';
    editorContainer.classList.add('flex-1');
    editorContainer.classList.remove('flex-[1.15]');
    const vh = window.visualViewport?.height ?? window.innerHeight;
    document.documentElement.style.setProperty('--lab-vh', `${Math.round(vh)}px`);
    paintResultsSheet();
    paintMissionOverlay();
  };

  const sync = (): void => {
    const mobile = media.matches;
    workspace.dataset['mobilePane'] = mobile ? mobilePane : 'desktop';
    switcher.hidden = true;
    gutter.hidden = mobile;
    if (mobile) applyMobilePanes();
    else restoreDesktop();
  };
  syncWorkspace = sync;

  gutter.setAttribute('aria-valuemin', String(MIN_WIDTH_PX));
  gutter.setAttribute('role', 'separator');

  backdrop?.addEventListener('click', () => hideResultsSheet());
  closeSheet?.addEventListener('click', () => hideResultsSheet());
  closeOverlay?.addEventListener('click', () => hideMissionOverlay());

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

  window.visualViewport?.addEventListener('resize', () => {
    if (media.matches) sync();
  });
  media.addEventListener('change', () => {
    sync();
  });
  window.addEventListener('resize', () => {
    if (!media.matches) persistWidth(apply(sidebar.getBoundingClientRect().width));
  });

  sync();
}
