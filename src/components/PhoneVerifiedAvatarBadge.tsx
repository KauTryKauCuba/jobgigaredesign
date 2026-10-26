"use client";

import VerifiedBadge from "./VerifiedBadge";

/**
 * "Phone verified" on a person's avatar — the same glossy seal as a verified
 * company's logo, in green. Place it inside a `relative` wrapper around the
 * avatar (the avatar itself usually clips its contents).
 */
export default function PhoneVerifiedAvatarBadge({ size = 22 }: { size?: number }) {
  return <VerifiedBadge variant="phone" placement="avatar" size={size} />;
}
