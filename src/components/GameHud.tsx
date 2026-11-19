import { HudSnapshot, InputState } from '../game/simulation';
import { RefreshHz } from './TerminalViewport';
import { PhosphorTheme } from './TitleOverlay';

interface GameHudProps {
  hud: HudSnapshot;
  refreshHz: RefreshHz;
  phosphor: PhosphorTheme;
  muted: boolean;
  onCycleHz: () => void;
  onToggleCamera: () => void;
  onCyclePhosphor: () => void;
  onToggleMute: () => void;
  onPause: () => void;
  onTouchInput: (key: keyof InputState, active: boolean) => void;
}

export function GameHud({
  hud,
  refreshHz,
  phosphor,
  muted,
  onCycleHz,
  onToggleCamera,
  onCyclePhosphor,
  onToggleMute,
  onPause,
  onTouchInput,
}: GameHudProps) {
  const hullPips = 10;
  const filledPips = Math.ceil((hud.hp / hud.maxHp) * hullPips);
  const criticalHp = hud.hp <= 30;

  return (
    <div className="fixed inset-0 z-20 pointer-events-none flex flex-col justify-between p-3 md:p-5">
      {/* Low-HP peripheral danger vignette */}
      {criticalHp && (
        <div
          aria-hidden="true"
          className="fixed inset-0 pointer-events-none"
          style={{
            boxShadow: 'inset 0 0 90px rgba(255, 69, 58, 0.45)',
          }}
        />
      )}

      {/* Top Perimeter Clusters */}
      <div className="flex items-start justify-between gap-4">
        {/* Top-Left: Hull Pips + Score + Wave */}
        <div
          className="px-3 py-2 border"
          style={{
            backgroundColor: 'rgba(4, 8, 5, 0.78)',
            borderColor: criticalHp ? 'var(--term-alert)' : 'var(--term-border)',
          }}
        >
          <div className="flex items-center gap-3 mb-1.5">
            <span className="text-[11px] uppercase tracking-wider" style={{ color: 'var(--term-mid)' }}>
              Hull
            </span>
            <div className="flex items-center gap-1" aria-label={`Hull ${hud.hp} percent`}>
              {Array.from({ length: hullPips }, (_, i) => {
                const isFull = i < filledPips;
                const isDamagedEdge = i === filledPips - 1 && hud.hp % 10 !== 0 && hud.hp > 0;
                return (
                  <span
                    key={i}
                    className="inline-block w-2.5 h-3.5 border"
                    style={{
                      borderColor: criticalHp ? 'var(--term-alert)' : 'var(--term-bright)',
                      backgroundColor: isFull
                        ? isDamagedEdge
                          ? 'var(--term-amber)'
                          : criticalHp
                            ? 'var(--term-alert)'
                            : 'var(--term-bright)'
                        : 'transparent',
                    }}
                  />
                );
              })}
            </div>
            <span
              className="text-base font-bold tabular-nums ml-1"
              style={{ color: criticalHp ? 'var(--term-alert)' : 'var(--term-highlight)' }}
            >
              {hud.hp}
            </span>
          </div>

          <div className="flex items-center gap-4 text-xs tabular-nums">
            <div>
              <span className="mr-1.5" style={{ color: 'var(--term-mid)' }}>SCORE</span>
              <span className="font-bold text-sm" style={{ color: 'var(--term-highlight)' }}>
                {hud.score}
              </span>
            </div>
            <div>
              <span className="mr-1.5" style={{ color: 'var(--term-mid)' }}>WAVE</span>
              <span className="font-bold" style={{ color: 'var(--term-bright)' }}>
                {hud.wave}
              </span>
            </div>
            <div>
              <span className="mr-1.5" style={{ color: 'var(--term-mid)' }}>HOSTILES</span>
              <span className="font-bold" style={{ color: 'var(--term-amber)' }}>
                {hud.enemiesRemaining}
              </span>
            </div>
          </div>
        </div>

        {/* Center Transient Combat Callouts */}
        <div className="hidden sm:flex flex-col items-center gap-1 pt-1">
          {hud.incomingWarning && (
            <div
              className="px-3 py-1 text-xs font-bold tracking-wider border"
              style={{
                backgroundColor: 'rgba(20, 4, 4, 0.88)',
                borderColor: 'var(--term-alert)',
                color: 'var(--term-alert)',
              }}
            >
              INCOMING FIRE LOCK
            </div>
          )}
          {hud.waveBannerTimer > 0 && (
            <div
              className="px-3 py-1 text-sm font-bold tracking-widest border"
              style={{
                backgroundColor: 'rgba(4, 8, 5, 0.85)',
                borderColor: 'var(--term-bright)',
                color: 'var(--term-highlight)',
              }}
            >
              WAVE {hud.wave} ENGAGED
            </div>
          )}
        </div>

        {/* Top-Right: Compact Utility Controls */}
        <div className="flex items-center justify-end gap-1.5 pointer-events-auto shrink-0">
          <button
            type="button"
            tabIndex={-1}
            onClick={(e) => {
              e.currentTarget.blur();
              onCycleHz();
            }}
            aria-label={`Refresh rate ${refreshHz} Hz`}
            className="hidden sm:inline-flex px-2.5 py-2 text-xs tabular-nums border cursor-pointer whitespace-nowrap shrink-0"
            style={{
              backgroundColor: 'rgba(4, 8, 5, 0.82)',
              borderColor: 'var(--term-border)',
              color: 'var(--term-bright)',
            }}
          >
            {refreshHz} Hz
          </button>
          <button
            type="button"
            tabIndex={-1}
            onClick={(e) => {
              e.currentTarget.blur();
              onToggleCamera();
            }}
            aria-label="Toggle camera mode"
            className="hidden sm:inline-flex px-2.5 py-2 text-xs border cursor-pointer whitespace-nowrap shrink-0"
            style={{
              backgroundColor: 'rgba(4, 8, 5, 0.82)',
              borderColor: 'var(--term-border)',
              color: 'var(--term-bright)',
            }}
          >
            {hud.cameraMode === 'chase' ? 'Chase [V]' : 'Cockpit [V]'}
          </button>
          <button
            type="button"
            tabIndex={-1}
            onClick={(e) => {
              e.currentTarget.blur();
              onCyclePhosphor();
            }}
            aria-label="Switch phosphor palette"
            className="hidden md:inline-flex px-2.5 py-2 text-xs border cursor-pointer whitespace-nowrap shrink-0 capitalize"
            style={{
              backgroundColor: 'rgba(4, 8, 5, 0.82)',
              borderColor: 'var(--term-border)',
              color: 'var(--term-bright)',
            }}
          >
            {phosphor} [C]
          </button>
          <button
            type="button"
            tabIndex={-1}
            onClick={(e) => {
              e.currentTarget.blur();
              onToggleMute();
            }}
            aria-label={muted ? 'Unmute audio' : 'Mute audio'}
            className="hidden sm:inline-flex px-2.5 py-2 text-xs border cursor-pointer whitespace-nowrap shrink-0"
            style={{
              backgroundColor: 'rgba(4, 8, 5, 0.82)',
              borderColor: 'var(--term-border)',
              color: muted ? 'var(--term-mid)' : 'var(--term-bright)',
            }}
          >
            {muted ? 'Muted [N]' : 'Sound [N]'}
          </button>
          <button
            type="button"
            tabIndex={-1}
            onClick={(e) => {
              e.currentTarget.blur();
              onPause();
            }}
            aria-label="Pause simulation"
            className="px-2.5 py-2 text-xs font-bold border cursor-pointer whitespace-nowrap shrink-0"
            style={{
              backgroundColor: 'rgba(4, 8, 5, 0.82)',
              borderColor: 'var(--term-bright)',
              color: 'var(--term-highlight)',
            }}
          >
            Pause [P]
          </button>
        </div>
      </div>

      {/* Bottom Perimeter Clusters */}
      <div className="flex flex-col sm:flex-row items-stretch sm:items-end justify-between gap-2 sm:gap-4">
        {/* Bottom-Left: Flight Telemetry & Weapons */}
        <div
          className="px-3 py-2 border"
          style={{
            backgroundColor: 'rgba(4, 8, 5, 0.78)',
            borderColor: 'var(--term-border)',
          }}
        >
          <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-xs tabular-nums mb-1">
            <div>
              <span className="mr-1.5" style={{ color: 'var(--term-mid)' }}>SPD</span>
              <span className="text-sm font-bold" style={{ color: 'var(--term-highlight)' }}>
                {hud.speed}
              </span>
              <span className="ml-1 text-[11px]" style={{ color: 'var(--term-mid)' }}>KTS</span>
            </div>
            <div>
              <span className="mr-1.5" style={{ color: 'var(--term-mid)' }}>ALT</span>
              <span className="text-sm font-bold" style={{ color: 'var(--term-highlight)' }}>
                {hud.altitude}
              </span>
              <span className="ml-1 text-[11px]" style={{ color: 'var(--term-mid)' }}>FT</span>
            </div>
            <div>
              <span className="mr-1.5" style={{ color: 'var(--term-mid)' }}>BOOST</span>
              <span className="font-bold" style={{ color: 'var(--term-bright)' }}>
                {hud.boost}%
              </span>
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-xs tabular-nums">
            <span style={{ color: 'var(--term-bright)' }}>[Space] Cannon</span>
            <span
              style={{
                color:
                  hud.lockProgress >= 0.99 && hud.missileReadyPct >= 100
                    ? 'var(--term-alert)'
                    : 'var(--term-amber)',
              }}
            >
              {hud.lockProgress >= 0.99 && hud.missileReadyPct >= 100
                ? `[Enter] Missile Locked (${hud.lockDistance}m)`
                : hud.missileReadyPct < 100
                  ? `Missile Reload ${hud.missileReadyPct}%`
                  : hud.lockTargetKind
                    ? `Locking ${hud.lockTargetKind.toUpperCase()} ${Math.round(hud.lockProgress * 100)}%`
                    : 'Missile Ready (No Lock)'}
            </span>
          </div>
        </div>

        {/* Mobile Touch Controls (hidden on desktop) */}
        <div className="flex sm:hidden items-center justify-between gap-3 pointer-events-auto">
          <div className="grid grid-cols-3 gap-1.5 shrink-0">
            <div />
            <button
              type="button"
              aria-label="Pitch up"
              onPointerDown={() => onTouchInput('pitchUp', true)}
              onPointerUp={() => onTouchInput('pitchUp', false)}
              onPointerLeave={() => onTouchInput('pitchUp', false)}
              className="w-11 h-11 border text-xs font-bold"
              style={{ backgroundColor: 'rgba(4,8,5,0.85)', borderColor: 'var(--term-border)' }}
            >
              ^
            </button>
            <div />
            <button
              type="button"
              aria-label="Turn left"
              onPointerDown={() => onTouchInput('turnLeft', true)}
              onPointerUp={() => onTouchInput('turnLeft', false)}
              onPointerLeave={() => onTouchInput('turnLeft', false)}
              className="w-11 h-11 border text-xs font-bold"
              style={{ backgroundColor: 'rgba(4,8,5,0.85)', borderColor: 'var(--term-border)' }}
            >
              &lt;
            </button>
            <button
              type="button"
              aria-label="Pitch down"
              onPointerDown={() => onTouchInput('pitchDown', true)}
              onPointerUp={() => onTouchInput('pitchDown', false)}
              onPointerLeave={() => onTouchInput('pitchDown', false)}
              className="w-11 h-11 border text-xs font-bold"
              style={{ backgroundColor: 'rgba(4,8,5,0.85)', borderColor: 'var(--term-border)' }}
            >
              v
            </button>
            <button
              type="button"
              aria-label="Turn right"
              onPointerDown={() => onTouchInput('turnRight', true)}
              onPointerUp={() => onTouchInput('turnRight', false)}
              onPointerLeave={() => onTouchInput('turnRight', false)}
              className="w-11 h-11 border text-xs font-bold"
              style={{ backgroundColor: 'rgba(4,8,5,0.85)', borderColor: 'var(--term-border)' }}
            >
              &gt;
            </button>
          </div>
          <button
            type="button"
            aria-label="Fire cannon"
            onPointerDown={() => onTouchInput('fireGun', true)}
            onPointerUp={() => onTouchInput('fireGun', false)}
            onPointerLeave={() => onTouchInput('fireGun', false)}
            className="w-14 h-14 border text-xs font-bold"
            style={{
              backgroundColor: 'rgba(4,8,5,0.85)',
              borderColor: 'var(--term-bright)',
              color: 'var(--term-highlight)',
            }}
          >
            FIRE
          </button>
        </div>

        {/* Bottom-Right: Live Vector Radar Scope */}
        <div
          className="hidden sm:flex flex-col items-center p-2 border"
          style={{
            backgroundColor: 'rgba(4, 8, 5, 0.82)',
            borderColor: 'var(--term-border)',
          }}
        >
          <svg
            viewBox="-50 -50 100 100"
            className="w-24 h-24"
            aria-label="Tactical radar scope"
          >
            <circle cx="0" cy="0" r="46" fill="none" stroke="currentColor" strokeOpacity="0.28" strokeWidth="1" />
            <circle cx="0" cy="0" r="24" fill="none" stroke="currentColor" strokeOpacity="0.2" strokeWidth="1" />
            <line x1="-46" y1="0" x2="46" y2="0" stroke="currentColor" strokeOpacity="0.2" strokeWidth="1" />
            <line x1="0" y1="-46" x2="0" y2="46" stroke="currentColor" strokeOpacity="0.2" strokeWidth="1" />
            {/* Player nose triangle */}
            <polygon points="0,-5 4,4 -4,4" fill="currentColor" />
            {hud.radarBlips.map((b, idx) => (
              <circle
                key={idx}
                cx={b.x * 42}
                cy={b.z * 42}
                r={b.locked ? 4 : b.kind === 'heavy' ? 3.2 : 2.5}
                fill={b.locked ? 'var(--term-alert)' : 'var(--term-amber)'}
              />
            ))}
          </svg>
          <span className="text-[10px] tracking-widest mt-1" style={{ color: 'var(--term-mid)' }}>
            RADAR · KILLS {hud.kills}
          </span>
        </div>
      </div>
    </div>
  );
}
