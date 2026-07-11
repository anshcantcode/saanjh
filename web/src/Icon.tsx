import type { SVGProps } from 'react';

export type IconName =
  | 'arrow-left' | 'arrow-right' | 'book' | 'check' | 'chevron-right' | 'cloud'
  | 'heart' | 'home' | 'leaf' | 'lock' | 'menu' | 'message' | 'mic' | 'moon'
  | 'phone' | 'phone-off' | 'play' | 'plus' | 'refresh' | 'send' | 'settings'
  | 'shield' | 'sparkles' | 'stop' | 'sun' | 'trash' | 'upload' | 'user'
  | 'volume' | 'wifi' | 'x';

const paths: Record<IconName, React.ReactNode> = {
  'arrow-left': <><path d="m15 18-6-6 6-6" /><path d="M9 12h10" /></>,
  'arrow-right': <><path d="m9 18 6-6-6-6" /><path d="M5 12h10" /></>,
  book: <><path d="M4 19.5A2.5 2.5 0 0 1 6.5 17H20" /><path d="M6.5 2H20v20H6.5A2.5 2.5 0 0 1 4 19.5v-15A2.5 2.5 0 0 1 6.5 2Z" /></>,
  check: <path d="m5 12 4 4L19 6" />,
  'chevron-right': <path d="m9 18 6-6-6-6" />,
  cloud: <path d="M17.5 19H7a5 5 0 1 1 4.9-6A6 6 0 0 1 23 15.5 3.5 3.5 0 0 1 19.5 19" />,
  heart: <path d="M20.8 4.6a5.5 5.5 0 0 0-7.8 0L12 5.7l-1.1-1.1a5.5 5.5 0 0 0-7.8 7.8l1.1 1.1L12 21l7.8-7.5 1.1-1.1a5.5 5.5 0 0 0-.1-7.8Z" />,
  home: <><path d="m3 11 9-8 9 8" /><path d="M5 10v11h14V10" /><path d="M9 21v-7h6v7" /></>,
  leaf: <><path d="M11 20A7 7 0 0 1 9.8 6.1C15.5 4 20 5 20 5s1 4.5-1.1 10.2A7 7 0 0 1 11 20Z" /><path d="M2 21c0-3 1.85-5.36 5.08-6.94C9.95 12.65 13.9 12 17 12" /></>,
  lock: <><rect width="16" height="12" x="4" y="10" rx="2" /><path d="M8 10V7a4 4 0 0 1 8 0v3" /></>,
  menu: <><path d="M4 6h16" /><path d="M4 12h16" /><path d="M4 18h16" /></>,
  message: <path d="M21 15a4 4 0 0 1-4 4H8l-5 3V7a4 4 0 0 1 4-4h10a4 4 0 0 1 4 4Z" />,
  mic: <><rect width="8" height="14" x="8" y="2" rx="4" /><path d="M4 10a8 8 0 0 0 16 0" /><path d="M12 18v4" /></>,
  moon: <path d="M20.5 14.3A8.4 8.4 0 0 1 9.7 3.5 9 9 0 1 0 20.5 14.3Z" />,
  phone: <path d="M22 16.9v3a2 2 0 0 1-2.2 2 19.8 19.8 0 0 1-8.6-3.1 19.5 19.5 0 0 1-6-6A19.8 19.8 0 0 1 2.1 4.2 2 2 0 0 1 4.1 2h3a2 2 0 0 1 2 1.7c.1 1 .4 2 .7 2.9a2 2 0 0 1-.5 2.1L8.1 9.9a16 16 0 0 0 6 6l1.2-1.2a2 2 0 0 1 2.1-.5c.9.3 1.9.6 2.9.7a2 2 0 0 1 1.7 2Z" />,
  'phone-off': <><path d="m2 2 20 20" /><path d="M8.5 8.5a16 16 0 0 0 7 7l1.1-1.1a2 2 0 0 1 2.1-.5l2.9 1a2 2 0 0 1 1.4 1.9V20a2 2 0 0 1-2.2 2A20 20 0 0 1 2 3.2 2 2 0 0 1 4 1h3.2A2 2 0 0 1 9 2.4l1 2.9a2 2 0 0 1-.5 2.1Z" /></>,
  play: <polygon points="6 3 20 12 6 21 6 3" />,
  plus: <><path d="M12 5v14" /><path d="M5 12h14" /></>,
  refresh: <><path d="M20 6v6h-6" /><path d="M4 18v-6h6" /><path d="M19 12a7 7 0 0 0-12-5L4 10" /><path d="M5 12a7 7 0 0 0 12 5l3-3" /></>,
  send: <><path d="m22 2-7 20-4-9-9-4Z" /><path d="M22 2 11 13" /></>,
  settings: <><path d="M12 15.5a3.5 3.5 0 1 0 0-7 3.5 3.5 0 0 0 0 7Z" /><path d="M19.4 15a1.7 1.7 0 0 0 .3 1.9l.1.1-2.8 2.8-.1-.1a1.7 1.7 0 0 0-1.9-.3 1.7 1.7 0 0 0-1 1.6v.2h-4V21a1.7 1.7 0 0 0-1-1.6 1.7 1.7 0 0 0-1.9.3l-.1.1L4.2 17l.1-.1a1.7 1.7 0 0 0 .3-1.9A1.7 1.7 0 0 0 3 14H3v-4h.2a1.7 1.7 0 0 0 1.6-1 1.7 1.7 0 0 0-.3-1.9L4.4 7 7.2 4.2l.1.1a1.7 1.7 0 0 0 1.9.3 1.7 1.7 0 0 0 1-1.6v-.2h4V3a1.7 1.7 0 0 0 1 1.6 1.7 1.7 0 0 0 1.9-.3l.1-.1L20 7l-.1.1a1.7 1.7 0 0 0-.3 1.9 1.7 1.7 0 0 0 1.6 1h.2v4h-.2a1.7 1.7 0 0 0-1.8 1Z" /></>,
  shield: <><path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10Z" /><path d="m9 12 2 2 4-4" /></>,
  sparkles: <><path d="m12 3-1.3 3.7L7 8l3.7 1.3L12 13l1.3-3.7L17 8l-3.7-1.3Z" /><path d="m5 14-.8 2.2L2 17l2.2.8L5 20l.8-2.2L8 17l-2.2-.8Z" /><path d="m19 15-.6 1.4L17 17l1.4.6L19 19l.6-1.4L21 17l-1.4-.6Z" /></>,
  stop: <rect width="14" height="14" x="5" y="5" rx="2" />,
  sun: <><circle cx="12" cy="12" r="4" /><path d="M12 2v2" /><path d="M12 20v2" /><path d="m4.93 4.93 1.42 1.42" /><path d="m17.66 17.66 1.41 1.41" /><path d="M2 12h2" /><path d="M20 12h2" /><path d="m6.34 17.66-1.41 1.41" /><path d="m19.07 4.93-1.41 1.41" /></>,
  trash: <><path d="M3 6h18" /><path d="M8 6V4h8v2" /><path d="m19 6-1 15H6L5 6" /><path d="M10 11v6" /><path d="M14 11v6" /></>,
  upload: <><path d="M12 16V4" /><path d="m7 9 5-5 5 5" /><path d="M20 16v4H4v-4" /></>,
  user: <><circle cx="12" cy="8" r="4" /><path d="M4 22a8 8 0 0 1 16 0" /></>,
  volume: <><polygon points="11 5 6 9 2 9 2 15 6 15 11 19 11 5" /><path d="M15.5 8.5a5 5 0 0 1 0 7" /><path d="M19 5a10 10 0 0 1 0 14" /></>,
  wifi: <><path d="M5 12.6a11 11 0 0 1 14 0" /><path d="M8.5 16a6 6 0 0 1 7 0" /><path d="M12 20h.01" /><path d="M2 9a16 16 0 0 1 20 0" /></>,
  x: <><path d="M18 6 6 18" /><path d="m6 6 12 12" /></>,
};

export function Icon({ name, size = 20, ...props }: { name: IconName; size?: number } & SVGProps<SVGSVGElement>) {
  return (
    <svg
      aria-hidden="true"
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.8"
      strokeLinecap="round"
      strokeLinejoin="round"
      {...props}
    >
      {paths[name]}
    </svg>
  );
}
