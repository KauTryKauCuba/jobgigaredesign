/** Original SVG icons — no vendor assets. */

export function MicIcon({ className = "" }: { className?: string }) {
  return (
    <svg
      viewBox="0 0 14 14"
      className={className}
      fill="none"
      stroke="currentColor"
      strokeWidth="1.4"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden
      focusable="false"
    >
      <rect x="4.8" y="1.2" width="4.4" height="7" rx="2.2" />
      <path d="M2.4 6.6a4.6 4.6 0 0 0 9.2 0" />
      <path d="M7 11.2v1.6M5 12.8h4" />
    </svg>
  );
}

export function ArrowUp({ className = "" }: { className?: string }) {
  return (
    <svg
      viewBox="0 0 14 14"
      className={className}
      fill="none"
      stroke="currentColor"
      strokeWidth="1.6"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden
      focusable="false"
    >
      <path d="M7 11.2V3.2M3.4 6.6 7 3l3.6 3.6" />
    </svg>
  );
}

export function ChevronDownIcon({ className = "" }: { className?: string }) {
  return (
    <svg
      viewBox="0 0 14 14"
      className={className}
      fill="none"
      stroke="currentColor"
      strokeWidth="1.6"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden
      focusable="false"
    >
      <path d="M3.4 5.4 7 9l3.6-3.6" />
    </svg>
  );
}

export function CalendarIcon({
  className = "",
  strokeWidth = 1.3,
  style,
}: {
  className?: string;
  strokeWidth?: number;
  style?: React.CSSProperties;
}) {
  return (
    <svg
      viewBox="0 0 14 14"
      className={className}
      style={style}
      fill="none"
      stroke="currentColor"
      strokeWidth={strokeWidth}
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden
      focusable="false"
    >
      <rect x="1.5" y="2.5" width="11" height="10" rx="1.5" />
      <path d="M1.5 5.5h11M4 1.2v2.1M10 1.2v2.1" />
    </svg>
  );
}

export function UploadIcon({ className = "" }: { className?: string }) {
  return (
    <svg
      viewBox="0 0 16 16"
      className={className}
      fill="none"
      stroke="currentColor"
      strokeWidth="1.5"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden
      focusable="false"
    >
      <path d="M8 10.4V2.4M4.8 5.6 8 2.4l3.2 3.2" />
      <path d="M2.4 10.4v2a1.2 1.2 0 0 0 1.2 1.2h8.8a1.2 1.2 0 0 0 1.2-1.2v-2" />
    </svg>
  );
}

export function UserIcon({
  className = "",
  strokeWidth = 1.4,
  style,
}: {
  className?: string;
  strokeWidth?: number;
  style?: React.CSSProperties;
}) {
  return (
    <svg
      viewBox="0 0 16 16"
      className={className}
      style={style}
      fill="none"
      stroke="currentColor"
      strokeWidth={strokeWidth}
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden
      focusable="false"
    >
      <circle cx="8" cy="5.2" r="2.4" />
      <path d="M2.8 13.6a5.2 5.2 0 0 1 10.4 0" />
    </svg>
  );
}

export function UsersIcon({
  className = "",
  strokeWidth = 1.4,
  style,
}: {
  className?: string;
  strokeWidth?: number;
  style?: React.CSSProperties;
}) {
  return (
    <svg
      viewBox="0 0 16 16"
      className={className}
      style={style}
      fill="none"
      stroke="currentColor"
      strokeWidth={strokeWidth}
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden
      focusable="false"
    >
      <circle cx="6" cy="5.2" r="2.2" />
      <path d="M1.6 13.6a4.4 4.4 0 0 1 8.8 0" />
      <path d="M10.4 3.4a2.2 2.2 0 0 1 0 4.2" />
      <path d="M11.6 9.4a4.4 4.4 0 0 1 2.8 4.2" />
    </svg>
  );
}

export function FileIcon({ className = "" }: { className?: string }) {
  return (
    <svg
      viewBox="0 0 16 16"
      className={className}
      fill="none"
      stroke="currentColor"
      strokeWidth="1.4"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden
      focusable="false"
    >
      <path d="M4 1.6h5.2L12.4 4.8V13.6a.8.8 0 0 1-.8.8H4a.8.8 0 0 1-.8-.8V2.4a.8.8 0 0 1 .8-.8Z" />
      <path d="M9.2 1.6v3.2h3.2" />
    </svg>
  );
}

export function TrendUpIcon({ className = "" }: { className?: string }) {
  return (
    <svg
      viewBox="0 0 16 16"
      className={className}
      fill="none"
      stroke="currentColor"
      strokeWidth="1.5"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden
      focusable="false"
    >
      <path d="M2 11.2 6.4 6.8l2.4 2.4L14 4" />
      <path d="M10 4h4v4" />
    </svg>
  );
}

export function PencilIcon({
  className = "",
  strokeWidth = 1.4,
  style,
}: {
  className?: string;
  strokeWidth?: number;
  style?: React.CSSProperties;
}) {
  return (
    <svg
      viewBox="0 0 14 14"
      className={className}
      style={style}
      fill="none"
      stroke="currentColor"
      strokeWidth={strokeWidth}
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden
      focusable="false"
    >
      <path d="M9.3 1.7l3 3L4.5 12.5l-3.3.8.8-3.3L9.3 1.7z" />
      <path d="M8 3l3 3" />
    </svg>
  );
}

export function XIcon({ className = "" }: { className?: string }) {
  return (
    <svg
      viewBox="0 0 14 14"
      className={className}
      fill="none"
      stroke="currentColor"
      strokeWidth="1.6"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden
      focusable="false"
    >
      <path d="M3.5 3.5l7 7M10.5 3.5l-7 7" />
    </svg>
  );
}

export function CheckIcon({ className = "" }: { className?: string }) {
  return (
    <svg
      viewBox="0 0 14 14"
      className={className}
      fill="none"
      stroke="currentColor"
      strokeWidth="1.6"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden
      focusable="false"
    >
      <path d="M2.5 7.2l3 3.1 6-6.6" />
    </svg>
  );
}

export function PlusIcon({ className = "" }: { className?: string }) {
  return (
    <svg
      viewBox="0 0 14 14"
      className={className}
      fill="none"
      stroke="currentColor"
      strokeWidth="1.6"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden
      focusable="false"
    >
      <path d="M7 2.4v9.2M2.4 7h9.2" />
    </svg>
  );
}

export function HomeIcon({ className = "" }: { className?: string }) {
  return (
    <svg
      viewBox="0 0 16 16"
      className={className}
      fill="none"
      stroke="currentColor"
      strokeWidth="1.4"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden
      focusable="false"
    >
      <path d="M2.4 7.2 8 2.4l5.6 4.8" />
      <path d="M3.6 6.4v6.8a.8.8 0 0 0 .8.8h7.2a.8.8 0 0 0 .8-.8V6.4" />
      <path d="M6.4 14V10.4h3.2V14" />
    </svg>
  );
}

export function SignOutIcon({ className = "" }: { className?: string }) {
  return (
    <svg
      viewBox="0 0 16 16"
      className={className}
      fill="none"
      stroke="currentColor"
      strokeWidth="1.4"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden
      focusable="false"
    >
      <path d="M6.4 14H3.2a.8.8 0 0 1-.8-.8V2.8a.8.8 0 0 1 .8-.8h3.2" />
      <path d="M10.4 11.2 13.6 8l-3.2-3.2" />
      <path d="M13.6 8H6" />
    </svg>
  );
}

export function SearchIcon({ className = "" }: { className?: string }) {
  return (
    <svg
      viewBox="0 0 16 16"
      className={className}
      fill="none"
      stroke="currentColor"
      strokeWidth="1.4"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden
      focusable="false"
    >
      <circle cx="7.2" cy="7.2" r="4.8" />
      <path d="M14 14l-3.5-3.5" />
    </svg>
  );
}

export function BuildingIcon({ className = "" }: { className?: string }) {
  return (
    <svg
      viewBox="0 0 16 16"
      className={className}
      fill="none"
      stroke="currentColor"
      strokeWidth="1.4"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden
      focusable="false"
    >
      <rect x="3.2" y="1.6" width="9.6" height="12.8" rx="0.8" />
      <path d="M6 4.4h1M9 4.4h1M6 7.2h1M9 7.2h1M6 10h1M9 10h1" />
      <path d="M6.4 14.4v-2.8h3.2v2.8" />
    </svg>
  );
}

export function BriefcaseIcon({
  className = "",
  strokeWidth = 1.4,
  style,
}: {
  className?: string;
  strokeWidth?: number;
  style?: React.CSSProperties;
}) {
  return (
    <svg
      viewBox="0 0 16 16"
      className={className}
      style={style}
      fill="none"
      stroke="currentColor"
      strokeWidth={strokeWidth}
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden
      focusable="false"
    >
      <rect x="1.6" y="4.8" width="12.8" height="8.8" rx="1.2" />
      <path d="M5.6 4.8V3.6a1.2 1.2 0 0 1 1.2-1.2h2.4a1.2 1.2 0 0 1 1.2 1.2v1.2" />
      <path d="M1.6 8.8h12.8" />
    </svg>
  );
}

export function StackIcon({
  className = "",
  strokeWidth = 1.4,
  style,
}: {
  className?: string;
  strokeWidth?: number;
  style?: React.CSSProperties;
}) {
  return (
    <svg
      viewBox="0 0 14 14"
      className={className}
      style={style}
      fill="none"
      stroke="currentColor"
      strokeWidth={strokeWidth}
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden
      focusable="false"
    >
      <path d="M7 1.4 12.6 4 7 6.6 1.4 4Z" />
      <path d="M1.4 7 7 9.6 12.6 7" />
      <path d="M1.4 10 7 12.6 12.6 10" />
    </svg>
  );
}

export function BoltIcon({
  className = "",
  strokeWidth = 1.4,
  style,
}: {
  className?: string;
  strokeWidth?: number;
  style?: React.CSSProperties;
}) {
  return (
    <svg
      viewBox="0 0 14 14"
      className={className}
      style={style}
      fill="none"
      stroke="currentColor"
      strokeWidth={strokeWidth}
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden
      focusable="false"
    >
      <path d="M7.6 1.4 2.6 8h3.4L5.6 12.6l5.8-6.8H8.2Z" />
    </svg>
  );
}

export function ClockIcon({
  className = "",
  strokeWidth = 1.4,
  style,
}: {
  className?: string;
  strokeWidth?: number;
  style?: React.CSSProperties;
}) {
  return (
    <svg
      viewBox="0 0 14 14"
      className={className}
      style={style}
      fill="none"
      stroke="currentColor"
      strokeWidth={strokeWidth}
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden
      focusable="false"
    >
      <circle cx="7" cy="7" r="5.6" />
      <path d="M7 4v3l2.2 1.4" />
    </svg>
  );
}

export function CheckCircleIcon({
  className = "",
  strokeWidth = 1.4,
  style,
}: {
  className?: string;
  strokeWidth?: number;
  style?: React.CSSProperties;
}) {
  return (
    <svg
      viewBox="0 0 14 14"
      className={className}
      style={style}
      fill="none"
      stroke="currentColor"
      strokeWidth={strokeWidth}
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden
      focusable="false"
    >
      <circle cx="7" cy="7" r="5.6" />
      <path d="M4.6 7.2 6.2 8.8l3.2-3.6" />
    </svg>
  );
}

export function LockIcon({
  className = "",
  strokeWidth = 1.4,
  style,
}: {
  className?: string;
  strokeWidth?: number;
  style?: React.CSSProperties;
}) {
  return (
    <svg
      viewBox="0 0 14 14"
      className={className}
      style={style}
      fill="none"
      stroke="currentColor"
      strokeWidth={strokeWidth}
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden
      focusable="false"
    >
      <rect x="2.8" y="6.4" width="8.4" height="5.8" rx="1.2" />
      <path d="M4.6 6.4V4.6a2.4 2.4 0 0 1 4.8 0v1.8" />
    </svg>
  );
}

export function DraftIcon({
  className = "",
  strokeWidth = 1.4,
  style,
}: {
  className?: string;
  strokeWidth?: number;
  style?: React.CSSProperties;
}) {
  return (
    <svg
      viewBox="0 0 14 14"
      className={className}
      style={style}
      fill="none"
      stroke="currentColor"
      strokeWidth={strokeWidth}
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden
      focusable="false"
    >
      <path d="M8.4 1.6 12.4 5.6 5.2 12.8H1.2v-4Z" />
      <path d="M7.2 2.8 11.2 6.8" />
    </svg>
  );
}

export function XCircleIcon({
  className = "",
  strokeWidth = 1.4,
  style,
}: {
  className?: string;
  strokeWidth?: number;
  style?: React.CSSProperties;
}) {
  return (
    <svg
      viewBox="0 0 14 14"
      className={className}
      style={style}
      fill="none"
      stroke="currentColor"
      strokeWidth={strokeWidth}
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden
      focusable="false"
    >
      <circle cx="7" cy="7" r="5.6" />
      <path d="M5.2 5.2 8.8 8.8M8.8 5.2 5.2 8.8" />
    </svg>
  );
}

export function FlagIcon({
  className = "",
  strokeWidth = 1.4,
  style,
}: {
  className?: string;
  strokeWidth?: number;
  style?: React.CSSProperties;
}) {
  return (
    <svg
      viewBox="0 0 14 14"
      className={className}
      style={style}
      fill="none"
      stroke="currentColor"
      strokeWidth={strokeWidth}
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden
      focusable="false"
    >
      <path d="M3.4 1.4v11.2" />
      <path d="M3.4 2.2h6.8l-1.8 2.4 1.8 2.4H3.4" />
    </svg>
  );
}

export function EyeIcon({ className = "" }: { className?: string }) {
  return (
    <svg
      viewBox="0 0 14 14"
      className={className}
      fill="none"
      stroke="currentColor"
      strokeWidth="1.4"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden
      focusable="false"
    >
      <path d="M1 7s2.2-4.2 6-4.2S13 7 13 7s-2.2 4.2-6 4.2S1 7 1 7Z" />
      <circle cx="7" cy="7" r="1.8" />
    </svg>
  );
}

export function CopyIcon({ className = "" }: { className?: string }) {
  return (
    <svg
      viewBox="0 0 14 14"
      className={className}
      fill="none"
      stroke="currentColor"
      strokeWidth="1.4"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden
      focusable="false"
    >
      <rect x="4.8" y="4.8" width="7.6" height="7.6" rx="1.2" />
      <path d="M2.6 9.2A1.2 1.2 0 0 1 1.6 8V2.8a1.2 1.2 0 0 1 1.2-1.2H8a1.2 1.2 0 0 1 1.2 1.2" />
    </svg>
  );
}

export function TrashIcon({ className = "" }: { className?: string }) {
  return (
    <svg
      viewBox="0 0 14 14"
      className={className}
      fill="none"
      stroke="currentColor"
      strokeWidth="1.4"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden
      focusable="false"
    >
      <path d="M2.2 3.8h9.6" />
      <path d="M5 3.8V2.4a1 1 0 0 1 1-1h2a1 1 0 0 1 1 1v1.4" />
      <path d="M3.4 3.8 4 12a1 1 0 0 0 1 0.9h4a1 1 0 0 0 1-0.9l0.6-8.2" />
      <path d="M5.8 6.4v4M8.2 6.4v4" />
    </svg>
  );
}

export function DotsIcon({ className = "" }: { className?: string }) {
  return (
    <svg viewBox="0 0 14 14" className={className} fill="currentColor" aria-hidden focusable="false">
      <circle cx="3" cy="7" r="1.3" />
      <circle cx="7" cy="7" r="1.3" />
      <circle cx="11" cy="7" r="1.3" />
    </svg>
  );
}
