/* Flat illustrations for the bento tiles and hero. Decorative: always aria-hidden. */

type Props = { className?: string };

export function LaundryArt({ className }: Props) {
  return (
    <svg className={className} width="130" height="130" viewBox="0 0 130 130" aria-hidden="true">
      <path d="M30 66c6-18 22-22 30-14 8-12 26-10 30 4 10-4 20 4 16 14z" fill="#dde9f6" />
      <path d="M46 60c4-8 14-10 20-4" stroke="#b9cde6" strokeWidth="4" fill="none" strokeLinecap="round" />
      <path d="M22 70h96l-10 58H32z" fill="#e8743b" />
      <path d="M22 70h96v10H22z" fill="#f4a26e" />
      <path d="M44 86v36M60 86v36M76 86v36M92 86v36" stroke="#c4521e" strokeWidth="4" strokeLinecap="round" />
      <path d="M30 96h80M32 110h76" stroke="#f08a52" strokeWidth="3" />
    </svg>
  );
}

export function BlocksArt({ className }: Props) {
  return (
    <svg className={className} width="118" height="110" viewBox="0 0 118 110" aria-hidden="true">
      <rect x="18" y="62" width="40" height="40" rx="6" fill="#e8743b" />
      <rect x="60" y="62" width="40" height="40" rx="6" fill="#8fb3dc" />
      <rect x="38" y="22" width="40" height="40" rx="6" fill="#f6c86b" />
      <path d="M30 92l8-20 8 20M33 85h10" stroke="#fff" strokeWidth="3.5" fill="none" strokeLinecap="round" strokeLinejoin="round" />
      <path d="M74 72v20h6a5 5 0 0 0 0-10h-6m0 0h5a5 5 0 0 0 0-10h-5" stroke="#fff" strokeWidth="3.5" fill="none" strokeLinecap="round" strokeLinejoin="round" />
      <path d="M66 34a10 10 0 1 0 0 16" stroke="#fff" strokeWidth="3.5" fill="none" strokeLinecap="round" />
    </svg>
  );
}

export function CalendarArt({ className, day }: Props & { day: number }) {
  return (
    <svg className={className} width="96" height="90" viewBox="0 0 96 90" aria-hidden="true">
      <rect x="20" y="22" width="66" height="62" rx="10" fill="#ffffff" />
      <path d="M20 32a10 10 0 0 1 10-10h46a10 10 0 0 1 10 10v8H20z" fill="#e8743b" />
      <rect x="34" y="14" width="6" height="16" rx="3" fill="#17181f" />
      <rect x="66" y="14" width="6" height="16" rx="3" fill="#17181f" />
      <text x="53" y="72" textAnchor="middle" fontFamily="var(--font-geist-sans), sans-serif" fontSize="24" fontWeight="700" fill="#17181f">
        {day}
      </text>
    </svg>
  );
}

export function PiggyArt({ className }: Props) {
  return (
    <svg className={className} width="124" height="110" viewBox="0 0 124 110" aria-hidden="true">
      <circle cx="72" cy="24" r="12" fill="#f6c86b" />
      <circle cx="72" cy="24" r="6" fill="none" stroke="#e0a53a" strokeWidth="2.5" />
      <ellipse cx="66" cy="76" rx="44" ry="32" fill="#f4a26e" />
      <path d="M40 50l-6-14 18 8z" fill="#e8743b" />
      <ellipse cx="106" cy="74" rx="10" ry="12" fill="#e8743b" />
      <circle cx="104" cy="70" r="2" fill="#c4521e" />
      <circle cx="104" cy="78" r="2" fill="#c4521e" />
      <circle cx="84" cy="62" r="3.5" fill="#17181f" />
      <rect x="52" y="46" width="24" height="5" rx="2.5" fill="#c4521e" />
      <rect x="38" y="98" width="12" height="14" rx="4" fill="#e8743b" />
      <rect x="78" y="98" width="12" height="14" rx="4" fill="#e8743b" />
    </svg>
  );
}

export function ToolboxArt({ className }: Props) {
  return (
    <svg className={className} width="140" height="130" viewBox="0 0 140 130" aria-hidden="true">
      <rect x="18" y="74" width="106" height="52" rx="10" fill="#e8743b" />
      <rect x="18" y="74" width="106" height="14" rx="7" fill="#f4a26e" />
      <path d="M52 74v-12a6 6 0 0 1 6-6h26a6 6 0 0 1 6 6v12" stroke="#17181f" strokeWidth="6" fill="none" />
      <rect x="62" y="92" width="18" height="12" rx="3" fill="#ffd9c2" />
      <path d="M30 30l40 40" stroke="#9aa0b4" strokeWidth="8" strokeLinecap="round" />
      <path d="M22 22l14 4-4 6-12-2z" fill="#6c7186" />
      <path d="M92 20a14 14 0 0 0 16 20l-26 28-8-8z" fill="#17181f" />
    </svg>
  );
}

export function PumpkinArt({ className }: Props) {
  return (
    <svg className={className} width="96" height="90" viewBox="0 0 96 90" aria-hidden="true">
      <ellipse cx="60" cy="64" rx="28" ry="22" fill="#e8743b" />
      <path d="M60 44c0-8 4-12 10-14" stroke="#7ea36b" strokeWidth="4" fill="none" strokeLinecap="round" />
      <path d="M48 48c-6 6-6 26 0 34M72 48c6 6 6 26 0 34" stroke="#c4521e" strokeWidth="3" fill="none" />
      <path d="M70 32c6-4 12-2 14 2-6 2-10 2-14-2z" fill="#9cc48a" />
    </svg>
  );
}

export function BinArt({ className }: Props) {
  return (
    <svg className={className} width="150" height="150" viewBox="0 0 150 150" aria-hidden="true">
      <circle cx="88" cy="92" r="64" fill="#f08a52" />
      <rect x="40" y="58" width="78" height="14" rx="7" fill="#fff4ec" />
      <rect x="66" y="48" width="26" height="12" rx="6" fill="#fff4ec" />
      <path d="M46 76h66l-8 70H54z" fill="#ffffff" />
      <path d="M66 88v46M79 88v46M92 88v46" stroke="#f6b48c" strokeWidth="5" strokeLinecap="round" />
    </svg>
  );
}

export function PlateArt({ className }: Props) {
  return (
    <svg className={className} width="160" height="150" viewBox="0 0 160 150" aria-hidden="true">
      <circle cx="96" cy="94" r="62" fill="#f08a52" />
      <ellipse cx="92" cy="104" rx="56" ry="22" fill="#ffffff" />
      <ellipse cx="92" cy="98" rx="44" ry="14" fill="#ffd9a8" />
      <path d="M62 96c8-6 16 4 24-2s16 4 24-2 12 2 14 4" stroke="#f7b267" strokeWidth="5" fill="none" strokeLinecap="round" />
      <ellipse cx="100" cy="92" rx="7" ry="4" fill="#7ea36b" />
      <ellipse cx="82" cy="94" rx="6" ry="3.5" fill="#7ea36b" />
      <path d="M78 66c-4-8 4-12 0-20M96 64c-4-8 4-12 0-20" stroke="#fff4ec" strokeWidth="4" fill="none" strokeLinecap="round" />
    </svg>
  );
}

export function PillArt({ className }: Props) {
  return (
    <svg className={className} width="150" height="150" viewBox="0 0 150 150" aria-hidden="true">
      <circle cx="90" cy="92" r="62" fill="#f08a52" />
      <g transform="rotate(-35 90 92)">
        <rect x="46" y="72" width="88" height="40" rx="20" fill="#ffffff" />
        <path d="M90 72h24a20 20 0 0 1 0 40H90z" fill="#ffd9c2" />
      </g>
    </svg>
  );
}
