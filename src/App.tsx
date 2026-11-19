import { useCallback, useEffect, useRef, useState } from 'react';
import { retroSynth } from './audio/retroSynth';
import { GameHud } from './components/GameHud';
import { StatusModal } from './components/StatusModal';
import { RefreshHz, TerminalViewport } from './components/TerminalViewport';
import { PhosphorTheme, TitleOverlay } from './components/TitleOverlay';
import {
  GamePhase,
  GameState,
  HudSnapshot,
  InputState,
  createInitialGameState,
  emptyInput,
  getHudSnapshot,
  startNewSortie,
} from './game/simulation';

const BEST_SCORE_KEY = 'vector_interceptor_best_score';
const HZ_CYCLE: RefreshHz[] = [8, 12, 18, 24];
const PHOSPHOR_CYCLE: PhosphorTheme[] = ['green', 'amber', 'cyan'];

function readBestScore(): number {
  try {
    const raw = window.localStorage.getItem(BEST_SCORE_KEY);
    const parsed = raw ? Number(raw) : 0;
    return Number.isFinite(parsed) && parsed > 0 ? Math.floor(parsed) : 0;
  } catch {
    return 0;
  }
}

function saveBestScore(score: number): void {
  try {
    window.localStorage.setItem(BEST_SCORE_KEY, String(score));
  } catch {
    // Ignore storage quota or sandbox errors
  }
}

function initGameState(): GameState {
  const state = createInitialGameState(readBestScore());
  if (typeof window !== 'undefined') {
    const params = new URLSearchParams(window.location.search);
    if (params.get('autostart') === '1') {
      startNewSortie(state);
    }
  }
  return state;
}

export default function App() {
  const gameStateRef = useRef<GameState | null>(null);
  if (gameStateRef.current === null) {
    gameStateRef.current = initGameState();
  }
  const activeStateRef = gameStateRef as React.MutableRefObject<GameState>;

  const inputRef = useRef<InputState>(emptyInput());
  const keysHeldRef = useRef<Set<string>>(new Set());

  const [phase, setPhase] = useState<GamePhase>(() => activeStateRef.current.phase);
  const [hud, setHud] = useState<HudSnapshot>(() => getHudSnapshot(activeStateRef.current));
  const [refreshHz, setRefreshHz] = useState<RefreshHz>(12);
  const [phosphor, setPhosphor] = useState<PhosphorTheme>('green');
  const [invertPitch, setInvertPitch] = useState<boolean>(false);
  const [muted, setMuted] = useState<boolean>(false);
  const [frozenSnapshot, setFrozenSnapshot] = useState<HudSnapshot | null>(null);

  const clearInputs = useCallback(() => {
    keysHeldRef.current.clear();
    inputRef.current = emptyInput();
  }, []);

  const syncBodyState = useCallback((nextPhase: GamePhase) => {
    document.body.dataset.state = nextPhase;
  }, []);

  useEffect(() => {
    syncBodyState(phase);
  }, [phase, syncBodyState]);

  useEffect(() => {
    document.documentElement.dataset.phosphor = phosphor;
  }, [phosphor]);

  const handleStart = useCallback(() => {
    retroSynth.unlock();
    if (document.activeElement instanceof HTMLElement) {
      document.activeElement.blur();
    }
    clearInputs();
    setFrozenSnapshot(null);
    startNewSortie(activeStateRef.current);
    syncBodyState('playing');
    setPhase('playing');
    setHud(getHudSnapshot(activeStateRef.current));
  }, [activeStateRef, clearInputs, syncBodyState]);

  const handlePause = useCallback(() => {
    const st = activeStateRef.current;
    if (st.phase === 'playing') {
      clearInputs();
      st.phase = 'paused';
      setFrozenSnapshot(getHudSnapshot(st));
      syncBodyState('paused');
      setPhase('paused');
    } else if (st.phase === 'paused') {
      if (document.activeElement instanceof HTMLElement) {
        document.activeElement.blur();
      }
      clearInputs();
      st.phase = 'playing';
      setFrozenSnapshot(null);
      syncBodyState('playing');
      setPhase('playing');
    }
  }, [activeStateRef, clearInputs, syncBodyState]);

  const handleQuitToTitle = useCallback(() => {
    clearInputs();
    const best = Math.max(activeStateRef.current.bestScore, activeStateRef.current.score);
    saveBestScore(best);
    const camMode = activeStateRef.current.cameraMode;
    const inv = activeStateRef.current.invertPitch;
    const fresh = createInitialGameState(best);
    fresh.cameraMode = camMode;
    fresh.invertPitch = inv;
    activeStateRef.current = fresh;
    setFrozenSnapshot(null);
    syncBodyState('title');
    setPhase('title');
    setHud(getHudSnapshot(fresh));
  }, [activeStateRef, clearInputs, syncBodyState]);

  const handleCycleHz = useCallback(() => {
    setRefreshHz((prev) => {
      const idx = HZ_CYCLE.indexOf(prev);
      return HZ_CYCLE[(idx + 1) % HZ_CYCLE.length];
    });
  }, []);

  const handleCyclePhosphor = useCallback(() => {
    setPhosphor((prev) => {
      const idx = PHOSPHOR_CYCLE.indexOf(prev);
      return PHOSPHOR_CYCLE[(idx + 1) % PHOSPHOR_CYCLE.length];
    });
  }, []);

  const handleToggleCamera = useCallback(() => {
    const st = activeStateRef.current;
    st.cameraMode = st.cameraMode === 'chase' ? 'cockpit' : 'chase';
    setHud(getHudSnapshot(st));
  }, [activeStateRef]);

  const handleToggleMute = useCallback(() => {
    setMuted((prev) => {
      const next = !prev;
      retroSynth.setMuted(next);
      return next;
    });
  }, []);

  const handleToggleInvert = useCallback(() => {
    setInvertPitch((prev) => {
      const next = !prev;
      activeStateRef.current.invertPitch = next;
      return next;
    });
  }, [activeStateRef]);

  const handlePhaseChange = useCallback(
    (nextPhase: GamePhase) => {
      if (nextPhase === 'gameover') {
        const snap = getHudSnapshot(activeStateRef.current);
        saveBestScore(snap.bestScore);
        setFrozenSnapshot(snap);
      }
      syncBodyState(nextPhase);
      setPhase(nextPhase);
    },
    [activeStateRef, syncBodyState],
  );

  const handleTouchInput = useCallback((key: keyof InputState, active: boolean) => {
    retroSynth.unlock();
    inputRef.current[key] = active;
  }, []);

  // Sync held keyboard keys to InputState
  useEffect(() => {
    const syncKeysToInput = () => {
      const keys = keysHeldRef.current;
      inputRef.current = {
        pitchUp: keys.has('KeyW') || keys.has('ArrowUp'),
        pitchDown: keys.has('KeyS') || keys.has('ArrowDown'),
        turnLeft: keys.has('KeyA') || keys.has('ArrowLeft'),
        turnRight: keys.has('KeyD') || keys.has('ArrowRight'),
        rollLeft: keys.has('KeyQ'),
        rollRight: keys.has('KeyE'),
        boost: keys.has('ShiftLeft') || keys.has('ShiftRight'),
        fireGun: keys.has('Space'),
        fireMissile: keys.has('Enter') || keys.has('KeyM'),
      };
    };

    const onKeyDown = (e: KeyboardEvent) => {
      const currentPhase = activeStateRef.current.phase;

      if (currentPhase === 'title' && (e.code === 'Enter' || e.code === 'Space')) {
        e.preventDefault();
        handleStart();
        return;
      }

      if (e.code === 'Escape' || e.code === 'KeyP') {
        if (currentPhase === 'playing' || currentPhase === 'paused') {
          e.preventDefault();
          handlePause();
        }
        return;
      }

      if (e.code === 'KeyV' && !e.repeat) {
        handleToggleCamera();
        return;
      }
      if (e.code === 'KeyF' && !e.repeat) {
        handleCycleHz();
        return;
      }
      if (e.code === 'KeyC' && !e.repeat) {
        handleCyclePhosphor();
        return;
      }
      if (e.code === 'KeyN' && !e.repeat) {
        handleToggleMute();
        return;
      }
      if (e.code === 'KeyI' && !e.repeat) {
        handleToggleInvert();
        return;
      }

      if (currentPhase === 'playing') {
        if (
          e.code === 'Space' ||
          e.code === 'ArrowUp' ||
          e.code === 'ArrowDown' ||
          e.code === 'ArrowLeft' ||
          e.code === 'ArrowRight'
        ) {
          e.preventDefault();
        }
        retroSynth.unlock();
        keysHeldRef.current.add(e.code);
        syncKeysToInput();
      }
    };

    const onKeyUp = (e: KeyboardEvent) => {
      keysHeldRef.current.delete(e.code);
      syncKeysToInput();
    };

    const onBlurOrHide = () => {
      clearInputs();
    };

    window.addEventListener('keydown', onKeyDown);
    window.addEventListener('keyup', onKeyUp);
    window.addEventListener('blur', onBlurOrHide);
    document.addEventListener('visibilitychange', onBlurOrHide);

    return () => {
      window.removeEventListener('keydown', onKeyDown);
      window.removeEventListener('keyup', onKeyUp);
      window.removeEventListener('blur', onBlurOrHide);
      document.removeEventListener('visibilitychange', onBlurOrHide);
    };
  }, [
    activeStateRef,
    clearInputs,
    handleCycleHz,
    handleCyclePhosphor,
    handlePause,
    handleStart,
    handleToggleCamera,
    handleToggleInvert,
    handleToggleMute,
  ]);

  return (
    <main className="relative w-screen h-screen overflow-hidden">
      <TerminalViewport
        gameStateRef={activeStateRef}
        inputRef={inputRef}
        refreshHz={refreshHz}
        onHudUpdate={setHud}
        onPhaseChange={handlePhaseChange}
      />

      {phase === 'title' && (
        <TitleOverlay
          refreshHz={refreshHz}
          phosphor={phosphor}
          invertPitch={invertPitch}
          bestScore={hud.bestScore}
          onStart={handleStart}
          onSelectHz={setRefreshHz}
          onSelectPhosphor={setPhosphor}
          onToggleInvert={handleToggleInvert}
        />
      )}

      {(phase === 'playing' || phase === 'paused' || phase === 'gameover') && (
        <GameHud
          hud={hud}
          refreshHz={refreshHz}
          phosphor={phosphor}
          muted={muted}
          onCycleHz={handleCycleHz}
          onToggleCamera={handleToggleCamera}
          onCyclePhosphor={handleCyclePhosphor}
          onToggleMute={handleToggleMute}
          onPause={handlePause}
          onTouchInput={handleTouchInput}
        />
      )}

      {(phase === 'paused' || phase === 'gameover') && (
        <StatusModal
          phase={phase}
          snapshot={frozenSnapshot ?? hud}
          onResume={handlePause}
          onRestart={handleStart}
          onQuitToTitle={handleQuitToTitle}
        />
      )}
    </main>
  );
}
