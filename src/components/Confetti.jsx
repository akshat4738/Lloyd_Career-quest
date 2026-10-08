import { useMemo } from 'react';

const EMOJI = ['🎉', '⭐', '✨', '🏆', '🔥', '💎', '🎊'];

export default function Confetti({ burst }) {
  const pieces = useMemo(
    () =>
      burst
        ? Array.from({ length: burst.big ? 60 : 24 }, (_, i) => ({
            i,
            left: Math.random() * 100,
            delay: Math.random() * 0.4,
            dur: 1.4 + Math.random() * 1.4,
            size: 16 + Math.random() * 22,
            e: EMOJI[Math.floor(Math.random() * EMOJI.length)],
          }))
        : [],
    [burst]
  );
  if (!burst) return null;
  return (
    <div className="confetti" key={burst.id}>
      {pieces.map((p) => (
        <span key={p.i} style={{ left: `${p.left}%`, animationDelay: `${p.delay}s`, animationDuration: `${p.dur}s`, fontSize: p.size }}>
          {p.e}
        </span>
      ))}
    </div>
  );
}
