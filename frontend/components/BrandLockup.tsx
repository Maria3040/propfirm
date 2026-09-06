'use client';

export function BrandLockup({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 182 36" fill="none" aria-label="PropFirm" className={className}>
      <g fill="currentColor" transform="translate(0 2) scale(0.65)">
        <path
          fillRule="evenodd"
          d="M8.294 4.586c0 2.21-1.795 4-4.01 4a4.004 4.004 0 0 1-4.008-4c0-2.209 1.795-4 4.009-4a4.004 4.004 0 0 1 4.009 4m10.022 34c0-2.209 1.795-4 4.009-4a4.004 4.004 0 0 1 4.009 4v6c0 2.209-1.795 4-4.01 4a4.005 4.005 0 0 1-4.008-4z"
        />
        <path
          fillRule="evenodd"
          d="M13.561 4.586c0-2.209 1.795-4 4.009-4h11.983c8.185 0 14.82 6.62 14.82 14.787s-6.635 14.788-14.82 14.788H8.293v14.425c0 2.209-1.794 4-4.008 4a4.005 4.005 0 0 1-4.01-4V22.161h29.278c3.758 0 6.802-3.04 6.802-6.788s-3.044-6.787-6.802-6.787H17.57a4.004 4.004 0 0 1-4.009-4"
        />
      </g>
      <text
        x="42"
        y="25"
        fill="currentColor"
        fontFamily="DM Sans, system-ui, sans-serif"
        fontSize="18"
        fontWeight="700"
        letterSpacing="0.02em"
      >
        PropFirm
      </text>
    </svg>
  );
}
