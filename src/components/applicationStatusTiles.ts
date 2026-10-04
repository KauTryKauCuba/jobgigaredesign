import type { CSSProperties, ReactElement } from "react";
import {
  BoltIcon,
  CheckCircleIcon,
  ClockIcon,
  DraftIcon,
  FlagIcon,
  PencilIcon,
  StackIcon,
  XCircleIcon,
} from "./icons";

// The "at a glance" status tiles — shared by the employer's Applicants page
// and the jobseeker's My Applications page so both read the same.
export const STATUS_ICON: Record<
  string,
  (props: { className?: string; strokeWidth?: number; style?: CSSProperties }) => ReactElement
> = {
  applied: StackIcon,
  screened: ClockIcon,
  shortlisted: BoltIcon,
  interview: ClockIcon,
  interviewed: CheckCircleIcon,
  evaluation: PencilIcon,
  evaluated: CheckCircleIcon,
  kiv: FlagIcon,
  offer: DraftIcon,
  hired: CheckCircleIcon,
  rejected: XCircleIcon,
  withdrawn: XCircleIcon,
};

// Same deeper/saturated pastel each status's APPLICATION_STATUS_COLOR.bg
// approximates — used as the gradient-to-white start color + the watermark
// icon's --icon-accent, matching the Manage Job pipeline tiles' treatment.
export const STATUS_TILE_GRADIENT: Record<string, string> = {
  applied: "#C9CFDA",
  screened: "#FFE1A1",
  shortlisted: "#8CE6D9",
  interview: "#D4C6F7",
  interviewed: "#A5C6F7",
  evaluation: "#FFCFA3",
  evaluated: "#A5EBCD",
  kiv: "#B9C3F9",
  offer: "#FFCDA1",
  hired: "#A5EBB9",
  rejected: "#F9B9B9",
  withdrawn: "#D4D7DC",
};
