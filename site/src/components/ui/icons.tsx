/** Small inline SVG icons (16 px grid, currentColor). Decorative by default: aria-hidden. */
import type { SVGProps } from 'react';

type IconProps = SVGProps<SVGSVGElement> & { size?: number };

function Svg({ size = 16, children, ...rest }: IconProps) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 16 16"
      fill="none"
      stroke="currentColor"
      strokeWidth={1.5}
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
      focusable="false"
      {...rest}
    >
      {children}
    </svg>
  );
}

/** Tier « Écrit dans la loi »: a page of text. */
export const IconLaw = (p: IconProps) => (
  <Svg {...p}>
    <path d="M3.75 1.75h5.5l3 3v9.5h-8.5z" />
    <path d="M6 8h4M6 10.5h4" />
  </Svg>
);
/** Tier « Annoncé »: a dashed circle. */
export const IconAnnounced = (p: IconProps) => (
  <Svg {...p}>
    <circle cx="8" cy="8" r="5.75" strokeDasharray="2.4 2.2" />
  </Svg>
);
/** Tier « Hypothèse »: « ≈ ». */
export const IconHypothesis = (p: IconProps) => (
  <Svg {...p}>
    <path d="M2.5 6.25c1.5-1.8 3-1.8 5.5 0s4 1.8 5.5 0M2.5 10.75c1.5-1.8 3-1.8 5.5 0s4 1.8 5.5 0" />
  </Svg>
);
export const IconExternal = (p: IconProps) => (
  <Svg {...p}>
    <path d="M9.5 2.5h4v4M13.5 2.5 7.5 8.5M12 9.5v3a1 1 0 0 1-1 1H3.5a1 1 0 0 1-1-1V5a1 1 0 0 1 1-1h3" />
  </Svg>
);
export const IconChevron = (p: IconProps) => (
  <Svg {...p}>
    <path d="m4 6 4 4 4-4" />
  </Svg>
);
export const IconDownload = (p: IconProps) => (
  <Svg {...p}>
    <path d="M8 2.5v7.5M4.75 7 8 10.25 11.25 7M3 13h10" />
  </Svg>
);
export const IconInfo = (p: IconProps) => (
  <Svg {...p}>
    <circle cx="8" cy="8" r="6" />
    <path d="M8 7.25v3.5M8 5.1v.01" />
  </Svg>
);
export const IconPlan = (p: IconProps) => (
  <Svg {...p}>
    <circle cx="8" cy="8" r="5.75" />
    <circle cx="8" cy="8" r="1.75" fill="currentColor" stroke="none" />
  </Svg>
);
export const IconUp = (p: IconProps) => (
  <Svg {...p}>
    <path d="M8 13V3.5M4 7.5l4-4 4 4" />
  </Svg>
);
export const IconDown = (p: IconProps) => (
  <Svg {...p}>
    <path d="M8 3v9.5M4 8.5l4 4 4-4" />
  </Svg>
);
export const IconAlert = (p: IconProps) => (
  <Svg {...p}>
    <path d="M8 2 14.25 13H1.75z" />
    <path d="M8 6.5v3M8 11.4v.01" />
  </Svg>
);
export const IconPlus = (p: IconProps) => (
  <Svg {...p}>
    <path d="M8 3v10M3 8h10" />
  </Svg>
);
export const IconMinus = (p: IconProps) => (
  <Svg {...p}>
    <path d="M3 8h10" />
  </Svg>
);
export const IconSun = (p: IconProps) => (
  <Svg {...p}>
    <circle cx="8" cy="8" r="2.75" />
    <path d="M8 1.5v1.6M8 12.9v1.6M1.5 8h1.6M12.9 8h1.6M3.4 3.4l1.1 1.1M11.5 11.5l1.1 1.1M3.4 12.6l1.1-1.1M11.5 4.5l1.1-1.1" />
  </Svg>
);
export const IconMoon = (p: IconProps) => (
  <Svg {...p}>
    <path d="M13.25 9.6A5.75 5.75 0 0 1 6.4 2.75a5.75 5.75 0 1 0 6.85 6.85z" />
  </Svg>
);
export const IconCheck = (p: IconProps) => (
  <Svg {...p}>
    <path d="m3 8.5 3.25 3.25L13 4.75" />
  </Svg>
);
export const IconCopy = (p: IconProps) => (
  <Svg {...p}>
    <rect x="5.5" y="5.5" width="8" height="8" rx="1.5" />
    <path d="M10.5 5.5v-2a1 1 0 0 0-1-1h-6a1 1 0 0 0-1 1v6a1 1 0 0 0 1 1h2" />
  </Svg>
);
export const IconClose = (p: IconProps) => (
  <Svg {...p}>
    <path d="m4 4 8 8M12 4l-8 8" />
  </Svg>
);
export const IconArrowDown = (p: IconProps) => (
  <Svg {...p}>
    <path d="M8 3v10M4 9l4 4 4-4" />
  </Svg>
);
