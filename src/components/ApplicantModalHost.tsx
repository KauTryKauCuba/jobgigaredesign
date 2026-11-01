"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import ApplicantDetailModal, { type ApplicantDetail } from "./ApplicantDetailModal";
import type { InterviewDetails } from "@/lib/applicationStatus";
import type { EmployerAddress, EmployerTeamMember } from "@/lib/employer-profile";
import type {
  EvaluationCriterion,
  InterviewEvaluation,
  InterviewRecommendation,
  PanelEvaluation,
} from "@/lib/interviewEvaluation";

/** Who's looking — what the profile window needs to know about the signed-in teammate. */
export type ApplicantViewer = {
  id?: string;
  isOwner: boolean;
  name: string | null;
  avatarUrl?: string | null;
  position?: string | null;
};

/** The fit score Top Matches shows — none once someone's hired, rejected or withdrawn. */
export type ApplicantFit = { score: number; eligible: boolean } | null;

type Loaded = {
  applicant: ApplicantDetail;
  addresses: EmployerAddress[];
  teamMembers: EmployerTeamMember[];
  fit: ApplicantFit;
};

/** One applicant's profile data, as the chat's profile card shows it. */
export async function fetchApplicant(applicationId: string): Promise<Loaded> {
  const res = await fetch(`/api/employer/applications/${applicationId}`);
  const data = await res.json().catch(() => ({}));
  if (!res.ok) {
    throw new Error(data.error === "Not found." ? "That applicant isn't available any more." : (data.error ?? "Couldn't open this profile."));
  }
  return data as Loaded;
}

/**
 * The dashboard's own applicant profile, opened from anywhere by application
 * id — the JobGiga Assistant uses it so a profile, and every action in it
 * (stages, interviews, attendance, evaluation), works in the chat exactly as
 * on the Applicants page: same content, same API, same permissions. As a
 * pop-up window, or as a panel beside Chat mode's conversation.
 */
export default function ApplicantModalHost({
  applicationId,
  viewer,
  onClose,
  variant = "modal",
  onChange,
}: {
  applicationId: string;
  viewer: ApplicantViewer;
  onClose: () => void;
  variant?: "modal" | "panel";
  // Called with the applicant as loaded and after each change made here, so
  // the chat's profile card can stay in step.
  onChange?: (applicant: ApplicantDetail, fit: ApplicantFit) => void;
}) {
  const router = useRouter();
  const [loaded, setLoaded] = useState<Loaded | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [updating, setUpdating] = useState(false);
  const [actionError, setActionError] = useState<string | null>(null);
  const panel = variant === "panel";

  useEffect(() => {
    let cancelled = false;
    fetchApplicant(applicationId)
      .then((data) => {
        if (!cancelled) setLoaded(data);
      })
      .catch((err) => {
        if (!cancelled) setLoadError(err instanceof Error ? err.message : "Couldn't open this profile.");
      });
    return () => {
      cancelled = true;
    };
  }, [applicationId]);

  useEffect(() => {
    if (loaded) onChange?.(loaded.applicant, loaded.fit);
    // Only when the applicant itself changes, not when the callback does.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [loaded?.applicant]);

  useEffect(() => {
    if (loaded || panel) return;
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && onClose();
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [loaded, panel, onClose]);

  function patchApplicant(update: (applicant: ApplicantDetail) => ApplicantDetail) {
    setLoaded((prev) => (prev ? { ...prev, applicant: update(prev.applicant) } : prev));
  }

  // The same calls the Applicants page makes (see EmployerApplicantsView).
  async function run(task: () => Promise<void>, failure: string) {
    setActionError(null);
    setUpdating(true);
    try {
      await task();
      // Keep whatever page is underneath (lists, counts) in step.
      router.refresh();
    } catch (err) {
      setActionError(err instanceof Error ? err.message : failure);
    } finally {
      setUpdating(false);
    }
  }

  async function send(url: string, init: RequestInit, failure: string) {
    const res = await fetch(url, init);
    const data = await res.json().catch(() => ({}));
    if (!res.ok) throw new Error(data.error ?? failure);
    return data;
  }

  const updateStatus = (status: string, interviewDetails?: InterviewDetails) =>
    run(async () => {
      await send(
        `/api/employer/applications/${applicationId}`,
        {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(interviewDetails !== undefined ? { status, interviewDetails } : { status }),
        },
        "Couldn't update this applicant's status.",
      );
      patchApplicant((a) => ({
        ...a,
        application: { ...a.application, status, interviewDetails: interviewDetails ?? a.application.interviewDetails },
      }));
    }, "Couldn't update this applicant's status.");

  const setAttendance = (interviewResponseStatus: "attended" | "no_show") =>
    run(async () => {
      await send(
        `/api/employer/applications/${applicationId}`,
        {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ status: "interview", interviewResponseStatus }),
        },
        "Couldn't update this applicant's status.",
      );
      patchApplicant((a) => ({ ...a, application: { ...a.application, interviewResponseStatus, status: "interviewed" } }));
    }, "Couldn't update this applicant's status.");

  const applyEvaluation = (data: { status: string; evaluation: InterviewEvaluation | null; evaluations: PanelEvaluation[] }) =>
    patchApplicant((a) => ({
      ...a,
      application: { ...a.application, status: data.status },
      evaluation: data.evaluation,
      evaluations: data.evaluations,
    }));

  const saveEvaluation = (scores: Partial<Record<EvaluationCriterion, number>>, recommendation: InterviewRecommendation, notes: string) =>
    run(async () => {
      applyEvaluation(
        await send(
          `/api/employer/applications/${applicationId}/evaluation`,
          { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ scores, recommendation, notes }) },
          "Couldn't save this evaluation.",
        ),
      );
    }, "Couldn't save this evaluation.");

  const completeEvaluation = () =>
    run(async () => {
      applyEvaluation(
        await send(`/api/employer/applications/${applicationId}/evaluation`, { method: "POST" }, "Couldn't complete this evaluation."),
      );
    }, "Couldn't complete this evaluation.");

  if (!loaded) {
    const status = loadError ? (
      <>
        <p className="text-red-500">{loadError}</p>
        <button
          type="button"
          onClick={onClose}
          className="flex h-[30px] items-center justify-center rounded-full border border-black/[0.1] px-[14px] text-sm text-[#141B2E] hover:bg-black/[0.03]"
        >
          Close
        </button>
      </>
    ) : (
      <p>Opening profile…</p>
    );
    return panel ? (
      <div
        role="status"
        className="flex h-full w-full flex-col items-center justify-center gap-[10px] rounded-[14px] border border-[#EAEDF2] bg-white text-sm text-[#4B5468]"
      >
        {status}
      </div>
    ) : (
      <div
        className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 px-4"
        onClick={(e) => e.target === e.currentTarget && onClose()}
      >
        <div role="status" className="flex flex-col items-center gap-[10px] rounded-[19px] bg-white px-[28px] py-[22px] text-sm text-[#4B5468]">
          {status}
        </div>
      </div>
    );
  }

  return (
    <>
      <ApplicantDetailModal
        variant={variant}
        applicant={loaded.applicant}
        updating={updating}
        onUpdateStatus={updateStatus}
        onSetAttendance={setAttendance}
        onSaveEvaluation={saveEvaluation}
        onCompleteEvaluation={completeEvaluation}
        savingEvaluation={updating}
        addresses={loaded.addresses}
        currentUserId={viewer.id}
        currentUserIsOwner={viewer.isOwner}
        currentUserName={viewer.name}
        currentUserAvatarUrl={viewer.avatarUrl}
        currentUserRole={viewer.position ?? null}
        teamMembers={loaded.teamMembers}
        onClose={onClose}
      />
      {actionError && (
        <p
          role="alert"
          className="fixed inset-x-0 bottom-[24px] z-[60] mx-auto w-fit max-w-[90vw] rounded-full bg-red-500 px-[16px] py-[8px] text-sm text-white shadow-lg"
        >
          {actionError}
        </p>
      )}
    </>
  );
}
