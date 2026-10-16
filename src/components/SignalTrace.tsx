// Осциллограф «захвата сигнала» — фирменный элемент интерфейса.
// Совместимое место даёт чистую волну, амплитуда растёт с силой сигнала.
// Несовместимое — плоская линия со статикой («нет несущей»).
// Форма детерминирована по seed, чтобы не «дёргалась» при перерисовке.

interface Props {
  score: number; // 0..1
  compatible: boolean;
  seed: string;
}

const W = 300;
const H = 72;
const MID = H / 2;

function makeRng(seedStr: string): () => number {
  let h = 2166136261;
  for (let i = 0; i < seedStr.length; i++) {
    h ^= seedStr.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  let a = h >>> 0;
  return () => {
    a |= 0;
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function cleanWave(score: number, seed: string): string {
  const rng = makeRng(seed);
  const amp = 4 + score * 26;
  const noise = (1 - score) * 6;
  const cycles = 3 + Math.round(score * 2);
  const step = 2;
  const pts: string[] = [];
  for (let x = 0; x <= W; x += step) {
    const phase = (x / W) * cycles * Math.PI * 2;
    const y = MID - Math.sin(phase) * amp + (rng() - 0.5) * noise;
    pts.push(`${x.toFixed(1)},${y.toFixed(1)}`);
  }
  return pts.join(' ');
}

function staticWave(seed: string): string {
  const rng = makeRng(seed);
  const step = 2;
  const pts: string[] = [];
  for (let x = 0; x <= W; x += step) {
    // В основном плоско, но изредка резкие всплески помех.
    const spike = rng() > 0.9 ? (rng() - 0.5) * 34 : (rng() - 0.5) * 3;
    pts.push(`${x.toFixed(1)},${(MID + spike).toFixed(1)}`);
  }
  return pts.join(' ');
}

export function SignalTrace({ score, compatible, seed }: Props) {
  const color = !compatible
    ? 'var(--alarm)'
    : score >= 0.75
      ? 'var(--signal)'
      : 'var(--amber)';
  const points = compatible ? cleanWave(score, seed) : staticWave(seed);

  return (
    <svg
      className="trace"
      viewBox={`0 0 ${W} ${H}`}
      preserveAspectRatio="none"
      role="img"
      aria-label={
        compatible
          ? `Сила сигнала ${Math.round(score * 100)} процентов`
          : 'Нет несущей — место не подходит'
      }
    >
      {/* сетка осциллографа */}
      <line x1="0" y1={MID} x2={W} y2={MID} stroke="var(--line)" strokeWidth="1" />
      <line x1={W / 4} y1="0" x2={W / 4} y2={H} stroke="var(--line)" strokeWidth="0.5" />
      <line x1={W / 2} y1="0" x2={W / 2} y2={H} stroke="var(--line)" strokeWidth="0.5" />
      <line x1={(W / 4) * 3} y1="0" x2={(W / 4) * 3} y2={H} stroke="var(--line)" strokeWidth="0.5" />
      <polyline
        points={points}
        fill="none"
        stroke={color}
        strokeWidth="1.6"
        strokeLinejoin="round"
        strokeLinecap="round"
        style={{ filter: `drop-shadow(0 0 4px ${color})` }}
      />
    </svg>
  );
}
