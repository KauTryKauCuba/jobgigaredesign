// An applicant's video pitch as one employer company sees it (mirrors
// EmployerPitchSummary in src/lib/video-pitch.ts, which is server-only).
export type ApplicantVideoPitch = {
  id: string;
  durationSeconds: number;
  intro: string | null;
  strengths: string[];
  watchedByMyCompany: boolean;
};

/**
 * "🎥 Video pitch" on applicant cards — or "Watched" once someone at this
 * company has seen it. Only says a video exists: no thumbnail or face in
 * lists, so employers judge on skills first and choose to watch.
 */
export default function VideoPitchBadge({ pitch }: { pitch: ApplicantVideoPitch | null | undefined }) {
  if (!pitch) return null;
  return (
    <span
      className={`inline-flex shrink-0 items-center gap-[4px] rounded-full px-[8px] py-[1px] align-middle text-xs ${
        pitch.watchedByMyCompany ? "bg-[#F1F4F8] text-[#4B5468]" : "bg-[#FFF3D6] text-brand-gold-dark"
      }`}
      title={pitch.watchedByMyCompany ? "Your team has watched this video pitch" : "This applicant recorded a video pitch"}
    >
      🎥 {pitch.watchedByMyCompany ? "Watched" : "Video pitch"}
    </span>
  );
}
