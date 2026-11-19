import { HudSnapshot } from '../game/simulation';

interface StatusModalProps {
  phase: 'paused' | 'gameover';
  snapshot: HudSnapshot;
  onResume: () => void;
  onRestart: () => void;
  onQuitToTitle: () => void;
}

export function StatusModal({
  phase,
  snapshot,
  onResume,
  onRestart,
  onQuitToTitle,
}: StatusModalProps) {
  const isGameOver = phase === 'gameover';

  return (
    <div
      className="fixed inset-0 z-30 flex items-center justify-center p-4"
      style={{ backgroundColor: 'rgba(2, 5, 3, 0.72)' }}
    >
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="status-modal-title"
        className="w-full max-w-md p-6 border"
        style={{
          backgroundColor: 'var(--term-surface)',
          borderColor: isGameOver ? 'var(--term-alert)' : 'var(--term-bright)',
        }}
      >
        <h2
          id="status-modal-title"
          className="text-xl font-bold tracking-tight mb-2"
          style={{ color: isGameOver ? 'var(--term-alert)' : 'var(--term-highlight)' }}
        >
          {isGameOver ? 'Aircraft Destroyed' : 'Simulation Paused'}
        </h2>
        <p className="text-xs mb-5" style={{ color: 'var(--term-mid)' }}>
          {isGameOver
            ? 'Sortie telemetry frozen at hull breach.'
            : 'Flight physics suspended. Resume when ready.'}
        </p>

        {/* 2x2 Tabular Stat Tiles */}
        <div
          className="grid grid-cols-2 gap-3 py-4 border-y mb-6 tabular-nums"
          style={{ borderColor: 'var(--term-border)' }}
        >
          <div>
            <div className="text-[11px] uppercase" style={{ color: 'var(--term-mid)' }}>
              Score / Best
            </div>
            <div className="text-lg font-bold" style={{ color: 'var(--term-highlight)' }}>
              {snapshot.score} / {snapshot.bestScore}
            </div>
          </div>
          <div>
            <div className="text-[11px] uppercase" style={{ color: 'var(--term-mid)' }}>
              Wave Reached
            </div>
            <div className="text-lg font-bold" style={{ color: 'var(--term-bright)' }}>
              Wave {snapshot.wave}
            </div>
          </div>
          <div>
            <div className="text-[11px] uppercase" style={{ color: 'var(--term-mid)' }}>
              Hostiles Down
            </div>
            <div className="text-lg font-bold" style={{ color: 'var(--term-amber)' }}>
              {snapshot.kills}
            </div>
          </div>
          <div>
            <div className="text-[11px] uppercase" style={{ color: 'var(--term-mid)' }}>
              Gun Accuracy
            </div>
            <div className="text-lg font-bold" style={{ color: 'var(--term-bright)' }}>
              {snapshot.accuracy}%
            </div>
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-3">
          {!isGameOver ? (
            <button
              type="button"
              onClick={onResume}
              className="px-5 py-2.5 text-sm font-bold cursor-pointer whitespace-nowrap shrink-0"
              style={{
                backgroundColor: 'var(--term-bright)',
                color: '#040805',
              }}
            >
              Resume
            </button>
          ) : (
            <button
              type="button"
              data-start="true"
              onClick={onRestart}
              className="px-5 py-2.5 text-sm font-bold cursor-pointer whitespace-nowrap shrink-0"
              style={{
                backgroundColor: 'var(--term-bright)',
                color: '#040805',
              }}
            >
              Fly Again
            </button>
          )}

          {!isGameOver && (
            <button
              type="button"
              onClick={onRestart}
              className="px-4 py-2.5 text-sm border cursor-pointer whitespace-nowrap shrink-0"
              style={{
                borderColor: 'var(--term-border)',
                color: 'var(--term-bright)',
              }}
            >
              Restart
            </button>
          )}

          <button
            type="button"
            onClick={onQuitToTitle}
            className="px-4 py-2.5 text-sm border cursor-pointer whitespace-nowrap shrink-0"
            style={{
              borderColor: 'var(--term-border)',
              color: 'var(--term-mid)',
            }}
          >
            Main Menu
          </button>
        </div>
      </div>
    </div>
  );
}
