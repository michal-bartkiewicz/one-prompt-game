import { useEffect, useRef } from 'react';
import { AsciiBuffer } from '../engine/asciiRenderer';
import {
  GameState,
  HudSnapshot,
  InputState,
  getHudSnapshot,
  renderSimulationToBuffer,
  stepGameState,
} from '../game/simulation';
import { retroSynth } from '../audio/retroSynth';

export type RefreshHz = 8 | 12 | 18 | 24;

interface TerminalViewportProps {
  gameStateRef: React.MutableRefObject<GameState>;
  inputRef: React.MutableRefObject<InputState>;
  refreshHz: RefreshHz;
  onHudUpdate: (snapshot: HudSnapshot) => void;
  onPhaseChange: (phase: GameState['phase']) => void;
}

export function TerminalViewport({
  gameStateRef,
  inputRef,
  refreshHz,
  onHudUpdate,
  onPhaseChange,
}: TerminalViewportProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const preRef = useRef<HTMLPreElement>(null);
  const measureRef = useRef<HTMLSpanElement>(null);

  const refreshHzRef = useRef(refreshHz);
  refreshHzRef.current = refreshHz;

  const onHudUpdateRef = useRef(onHudUpdate);
  onHudUpdateRef.current = onHudUpdate;

  const onPhaseChangeRef = useRef(onPhaseChange);
  onPhaseChangeRef.current = onPhaseChange;

  const gridSizeRef = useRef<{ cols: number; rows: number }>({ cols: 124, rows: 44 });
  const bufferRef = useRef<AsciiBuffer>(new AsciiBuffer(124, 44));

  useEffect(() => {
    const container = containerRef.current;
    const measureEl = measureRef.current;
    if (!container || !measureEl) return;

    const recomputeGrid = () => {
      const rect = container.getBoundingClientRect();
      const cellRect = measureEl.getBoundingClientRect();
      const charW = cellRect.width > 2 ? cellRect.width / 10 : 8.8;
      const charH = cellRect.height > 4 ? cellRect.height : 16;

      // Leave small safe breathing room so terminal text never wraps or clips
      const cols = Math.max(46, Math.min(180, Math.floor((rect.width - 16) / charW)));
      const rows = Math.max(20, Math.min(72, Math.floor((rect.height - 16) / charH)));

      if (cols !== gridSizeRef.current.cols || rows !== gridSizeRef.current.rows) {
        gridSizeRef.current = { cols, rows };
        bufferRef.current = new AsciiBuffer(cols, rows);
      }
    };

    recomputeGrid();
    const observer = new ResizeObserver(recomputeGrid);
    observer.observe(container);
    return () => observer.disconnect();
  }, []);

  useEffect(() => {
    let rafId = 0;
    let lastTime = performance.now();
    let flushAccumulator = 0;
    let lastPhase = gameStateRef.current.phase;

    const flushFrame = () => {
      const state = gameStateRef.current;
      const buf = bufferRef.current;
      renderSimulationToBuffer(state, buf);
      if (preRef.current) {
        preRef.current.innerHTML = buf.toTerminalHtml();
      }
      onHudUpdateRef.current(getHudSnapshot(state));
    };

    // Initial immediate paint
    flushFrame();

    const tick = (now: number) => {
      const rawDt = (now - lastTime) / 1000;
      lastTime = now;
      const clampedDt = Math.min(Math.max(rawDt, 0), 0.05);

      const state = gameStateRef.current;
      stepGameState(state, inputRef.current, clampedDt);

      if (state.pendingEvents.length > 0) {
        retroSynth.playEvents(state.pendingEvents);
      }

      if (state.phase !== lastPhase) {
        lastPhase = state.phase;
        onPhaseChangeRef.current(state.phase);
        flushFrame();
        flushAccumulator = 0;
      } else if (state.phase === 'title' || state.phase === 'playing') {
        const frameInterval = 1 / refreshHzRef.current;
        flushAccumulator += clampedDt;
        if (flushAccumulator >= frameInterval) {
          flushAccumulator %= frameInterval;
          flushFrame();
        }
      }

      rafId = requestAnimationFrame(tick);
    };

    rafId = requestAnimationFrame(tick);
    return () => {
      cancelAnimationFrame(rafId);
    };
  }, [gameStateRef, inputRef]);

  return (
    <div
      ref={containerRef}
      className="relative w-full h-full overflow-hidden flex items-center justify-center p-2"
      style={{ backgroundColor: 'var(--term-bg)' }}
    >
      {/* Hidden monospace probe to measure exact glyph cell dimensions */}
      <span
        ref={measureRef}
        aria-hidden="true"
        className="ascii-grid fixed -top-96 left-0 opacity-0 pointer-events-none text-[13px] md:text-[14px]"
      >
        MMMMMMMMMM
      </span>

      <pre
        ref={preRef}
        data-testid="ascii-viewport"
        aria-label="3D ASCII flight terminal viewport"
        className="ascii-grid m-0 p-0 text-[13px] md:text-[14px] overflow-hidden"
      />

      {/* Subtle CRT scanlines and corner vignette (zero backdrop-filter) */}
      <div
        aria-hidden="true"
        className="crt-scanlines pointer-events-none absolute inset-0 z-10"
      />
      <div
        aria-hidden="true"
        className="crt-vignette pointer-events-none absolute inset-0 z-10"
      />
    </div>
  );
}
