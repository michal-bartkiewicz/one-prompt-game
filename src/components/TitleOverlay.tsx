import { RefreshHz } from './TerminalViewport';

export type PhosphorTheme = 'green' | 'amber' | 'cyan';

interface TitleOverlayProps {
  refreshHz: RefreshHz;
  phosphor: PhosphorTheme;
  invertPitch: boolean;
  bestScore: number;
  onStart: () => void;
  onSelectHz: (hz: RefreshHz) => void;
  onSelectPhosphor: (theme: PhosphorTheme) => void;
  onToggleInvert: () => void;
}

const HZ_OPTIONS: RefreshHz[] = [8, 12, 18, 24];
const THEME_OPTIONS: { id: PhosphorTheme; label: string }[] = [
  { id: 'green', label: 'P39 Green' },
  { id: 'amber', label: 'P3 Amber' },
  { id: 'cyan', label: 'Ice Cyan' },
];

export function TitleOverlay({
  refreshHz,
  phosphor,
  invertPitch,
  bestScore,
  onStart,
  onSelectHz,
  onSelectPhosphor,
  onToggleInvert,
}: TitleOverlayProps) {
  return (
    <div className="fixed inset-0 z-20 flex flex-col justify-between p-6 md:p-10 pointer-events-none">
      {/* Top quiet Linux TTY header line */}
      <div className="flex items-center justify-between text-xs tracking-wide" style={{ color: 'var(--term-mid)' }}>
        <span className="truncate">mbs@linux:~/sortie$ ./vector-interceptor --tty --hz {refreshHz}</span>
        {bestScore > 0 && (
          <span className="tabular-nums shrink-0 ml-4" style={{ color: 'var(--term-bright)' }}>
            Best Score: {bestScore}
          </span>
        )}
      </div>

      {/* Main asymmetric left-third title lockup leaving right/center open for the 3D rotating ASCII jet */}
      <div className="max-w-lg my-auto pointer-events-auto">
        <div className="p-6 md:p-7 border" style={{ backgroundColor: 'rgba(4, 8, 5, 0.86)', borderColor: 'var(--term-border)' }}>
          <div className="flex items-center gap-3 mb-4">
            <svg
              viewBox="0 0 44 44"
              className="w-10 h-10 shrink-0"
              aria-hidden="true"
              style={{ color: 'var(--term-bright)' }}
            >
              <polygon
                points="22,3 27,17 41,28 27,26 25,38 22,34 19,38 17,26 3,28 17,17"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
                strokeLinejoin="round"
              />
              <line x1="22" y1="9" x2="22" y2="30" stroke="currentColor" strokeWidth="1.5" />
            </svg>
            <div>
              <h1
                className="text-2xl md:text-4xl font-bold tracking-tight text-balance leading-tight"
                style={{ color: 'var(--term-highlight)' }}
              >
                Vector Interceptor
              </h1>
            </div>
          </div>

          <p className="text-sm leading-relaxed mb-6" style={{ color: 'var(--term-mid)' }}>
            3D aerial dogfighting rendered directly in a low-refresh ASCII terminal buffer. Bank through canyon airspace, lock missiles onto incoming squadrons, and survive escalating waves.
          </p>

          <div className="flex flex-wrap items-center gap-3 mb-6">
            <button
              type="button"
              data-start="true"
              onClick={onStart}
              className="px-6 py-3 text-sm font-bold tracking-wide transition-transform active:scale-95 cursor-pointer whitespace-nowrap shrink-0"
              style={{
                backgroundColor: 'var(--term-bright)',
                color: '#040805',
              }}
            >
              Start Sortie
            </button>
          </div>

          {/* Terminal display settings */}
          <div className="space-y-3 pt-4 border-t" style={{ borderColor: 'var(--term-border)' }}>
            <div className="flex flex-wrap items-center justify-between gap-2 text-xs">
              <span style={{ color: 'var(--term-mid)' }}>Terminal Refresh</span>
              <div className="flex items-center gap-1" role="group" aria-label="Terminal refresh rate">
                {HZ_OPTIONS.map((hz) => (
                  <button
                    key={hz}
                    type="button"
                    onClick={() => onSelectHz(hz)}
                    className="px-2.5 py-1.5 text-xs tabular-nums transition-colors cursor-pointer whitespace-nowrap shrink-0 border"
                    style={{
                      borderColor: refreshHz === hz ? 'var(--term-bright)' : 'var(--term-border)',
                      backgroundColor: refreshHz === hz ? 'var(--term-bright)' : 'transparent',
                      color: refreshHz === hz ? '#040805' : 'var(--term-bright)',
                    }}
                  >
                    {hz} Hz
                  </button>
                ))}
              </div>
            </div>

            <div className="flex flex-wrap items-center justify-between gap-2 text-xs">
              <span style={{ color: 'var(--term-mid)' }}>Phosphor</span>
              <div className="flex items-center gap-1" role="group" aria-label="Phosphor palette">
                {THEME_OPTIONS.map((t) => (
                  <button
                    key={t.id}
                    type="button"
                    onClick={() => onSelectPhosphor(t.id)}
                    className="px-2.5 py-1.5 text-xs transition-colors cursor-pointer whitespace-nowrap shrink-0 border"
                    style={{
                      borderColor: phosphor === t.id ? 'var(--term-bright)' : 'var(--term-border)',
                      backgroundColor: phosphor === t.id ? 'var(--term-bright)' : 'transparent',
                      color: phosphor === t.id ? '#040805' : 'var(--term-bright)',
                    }}
                  >
                    {t.label}
                  </button>
                ))}
              </div>
            </div>

            <div className="flex items-center justify-between gap-2 text-xs">
              <span style={{ color: 'var(--term-mid)' }}>Pitch Axis</span>
              <button
                type="button"
                onClick={onToggleInvert}
                className="px-2.5 py-1.5 text-xs transition-colors cursor-pointer whitespace-nowrap shrink-0 border"
                style={{
                  borderColor: 'var(--term-border)',
                  color: 'var(--term-bright)',
                }}
              >
                {invertPitch ? 'Inverted Flight' : 'Arcade Normal'}
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* Flat borderless single-line control hint */}
      <div
        className="text-xs tracking-wide truncate"
        style={{ color: 'var(--term-mid)' }}
      >
        W/S or Up/Down Pitch · A/D or Left/Right Bank · Space Cannon · Enter Missile · Shift Boost · V Camera · P Pause
      </div>
    </div>
  );
}
