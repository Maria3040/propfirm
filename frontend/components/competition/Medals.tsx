/** Simple medal marks used on competition podium / table (no external assets). */
export function GoldMedal({ className, size = 160 }: { className?: string; size?: number }) {
  return (
    <svg
      className={className}
      width={size}
      height={size}
      viewBox="0 0 120 120"
      aria-hidden
    >
      <circle cx="60" cy="62" r="38" fill="#f5c542" stroke="#d4a017" strokeWidth="4" />
      <circle cx="60" cy="62" r="28" fill="#ffe08a" stroke="#c9970c" strokeWidth="2" />
      <path d="M42 18 L52 48 L28 36 Z" fill="#3b82f6" />
      <path d="M78 18 L92 36 L68 48 Z" fill="#2563eb" />
      <text x="60" y="70" textAnchor="middle" fontSize="28" fontWeight="700" fill="#8a6a00">
        1
      </text>
    </svg>
  );
}

export function SilverMedal({ className, size = 120 }: { className?: string; size?: number }) {
  return (
    <svg
      className={className}
      width={size}
      height={size}
      viewBox="0 0 120 120"
      aria-hidden
    >
      <circle cx="60" cy="62" r="38" fill="#c0c7d1" stroke="#8e98a8" strokeWidth="4" />
      <circle cx="60" cy="62" r="28" fill="#e8edf3" stroke="#9aa3b2" strokeWidth="2" />
      <path d="M42 18 L52 48 L28 36 Z" fill="#64748b" />
      <path d="M78 18 L92 36 L68 48 Z" fill="#475569" />
      <text x="60" y="70" textAnchor="middle" fontSize="28" fontWeight="700" fill="#5b6573">
        2
      </text>
    </svg>
  );
}

export function BronzeMedal({ className, size = 120 }: { className?: string; size?: number }) {
  return (
    <svg
      className={className}
      width={size}
      height={size}
      viewBox="0 0 120 120"
      aria-hidden
    >
      <circle cx="60" cy="62" r="38" fill="#cd7f32" stroke="#a65c1a" strokeWidth="4" />
      <circle cx="60" cy="62" r="28" fill="#e8a35a" stroke="#b56a22" strokeWidth="2" />
      <path d="M42 18 L52 48 L28 36 Z" fill="#92400e" />
      <path d="M78 18 L92 36 L68 48 Z" fill="#78350f" />
      <text x="60" y="70" textAnchor="middle" fontSize="28" fontWeight="700" fill="#7a3f0e">
        3
      </text>
    </svg>
  );
}

export function RankMedal({ rank, size }: { rank: number; size?: number }) {
  if (rank === 1) return <GoldMedal size={size ?? 47} />;
  if (rank === 2) return <SilverMedal size={size ?? 47} />;
  if (rank === 3) return <BronzeMedal size={size ?? 47} />;
  return <SilverMedal size={size ?? 47} />;
}
