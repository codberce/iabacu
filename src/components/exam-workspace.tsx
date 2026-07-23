"use client";

import {
  ChangeEvent,
  useEffect,
  useMemo,
  useRef,
  useState,
  useSyncExternalStore,
  type ReactNode,
} from "react";
import Link from "next/link";
import dynamic from "next/dynamic";
import {
  ArrowDown,
  ArrowLeft,
  ArrowUp,
  Camera,
  Clock,
  FileText,
  Pause,
  Play,
  RotateCcw,
  Sparkles,
  Square,
  Upload,
  X,
} from "lucide-react";
import {
  CameraCapture,
  supportsCameraCapture,
} from "@/components/camera-capture";
import { saveGradingAttempt } from "@/lib/attempts";
import type { Exam, GradeResult } from "@/lib/schemas";
import { formatScore, scoreBand } from "@/lib/score";
import {
  formatDuration,
} from "@/lib/timer";
import {
  isOficiuItem,
  recomputeGradeWithOverrides,
} from "@/lib/grading";
import {
  gradingProgress,
  gradingStageMessage,
} from "@/lib/grading-progress";

import { PlatformTaskPanel } from "@/components/platform-task-panel";
import {
  AiFeatureAccessCard,
  AiFeatureAccessSkeleton,
  useAiFeatureAccess,
} from "@/components/ai-feature-access";
import {
  workImageQualityIssues,
  type WorkImageQualityIssue,
} from "@/lib/work-image-quality";
import { readWorkspace, reconcileWorkspace, saveWorkspace, writeWorkspace } from "@/lib/workspace-store";
import {
  dismissGradingSession,
  getGradingSession,
  startGradingSession,
  stopGradingSession,
  subscribeGradingSession,
} from "@/lib/grading-session";

const PdfViewer = dynamic(
  () => import("@/components/pdf-viewer").then((mod) => mod.PdfViewer),
  { ssr: false },
);

const AiMessage = dynamic(
  () => import("@/components/ai-message").then((mod) => mod.AiMessage),
  { ssr: false },
);

type ExamWorkspaceProps = {
  exam: Exam;
  backHref?: string;
  baremHref?: string;
};

const maxFiles = 8;

type ActivePanel = "subject" | "work";

type WorkFile = {
  id: string;
  file: File;
  previewUrl: string;
  width?: number;
  height?: number;
  inspectionStatus: "checking" | "ready";
  issues: WorkImageQualityIssue[];
};

async function imageDimensions(previewUrl: string) {
  const image = new Image();
  await new Promise<void>((resolve, reject) => {
    image.onload = () => resolve();
    image.onerror = () => reject(new Error("Imaginea nu poate fi citită."));
    image.src = previewUrl;
  });
  return { width: image.naturalWidth, height: image.naturalHeight };
}

const PHOTO_REFERENCE_PATTERN = /Poza\s+(\d+)/g;

function readSavedTimer(
  timerStorageKey: string,
): { elapsed: number; wasRunning: boolean; leftAt: number | null } {
  try {
    const saved = window.localStorage.getItem(timerStorageKey);
    if (saved) {
      const parsed = JSON.parse(saved);
      const elapsed = typeof parsed.elapsed === "number" ? parsed.elapsed : 0;
      const wasRunning = parsed.wasRunning === true;
      const leftAt = typeof parsed.leftAt === "number" ? parsed.leftAt : null;
      return { elapsed, wasRunning, leftAt };
    }
  } catch {
    // ignore
  }
  return { elapsed: 0, wasRunning: false, leftAt: null };
}

function renderPhotoLinkedEvidence(
  text: string,
  onJump: (photoNumber: number) => void,
): ReactNode {
  if (!text) return text;
  PHOTO_REFERENCE_PATTERN.lastIndex = 0;
  const nodes: ReactNode[] = [];
  let lastIndex = 0;
  let match: RegExpExecArray | null;
  while ((match = PHOTO_REFERENCE_PATTERN.exec(text)) !== null) {
    if (match.index > lastIndex) {
      nodes.push(text.slice(lastIndex, match.index));
    }
    const photoNumber = Number(match[1]);
    nodes.push(
      <button
        key={`poza-ref-${match.index}`}
        type="button"
        onClick={() => onJump(photoNumber)}
        className="font-semibold text-emerald-700 underline decoration-emerald-300 underline-offset-2 hover:text-emerald-900"
      >
        {match[0]}
      </button>,
    );
    lastIndex = PHOTO_REFERENCE_PATTERN.lastIndex;
  }
  if (lastIndex < text.length) nodes.push(text.slice(lastIndex));
  return <>{nodes}</>;
}

export function ExamWorkspace({ exam, backHref, baremHref }: ExamWorkspaceProps) {
  const { isLoading: isAiAccessLoading, isLocked: isAiLocked, userId } =
    useAiFeatureAccess();
  const [activePanel, setActivePanel] = useState<ActivePanel>("subject");
  const timerStorageKey = `exam-timer:${exam.id}`;

  const [isTimerRunning, setIsTimerRunning] = useState(false);
  const [startedAt, setStartedAt] = useState<number | null>(null);
  const [elapsedBeforePause, setElapsedBeforePause] = useState(0);
  const examDurationSeconds = (exam.durationMinutes ?? 180) * 60;
  const [remaining, setRemaining] = useState(examDurationSeconds);
  const [timerHydrated, setTimerHydrated] = useState(false);
  const [workFiles, setWorkFiles] = useState<WorkFile[]>([]);
  const [savedGrade, setSavedGrade] = useState<GradeResult | null>(
    () => readWorkspace(exam.id, null).grade?.result ?? null,
  );
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [remainingCorrections] = useState<string | null>(null);
  const [isCameraOpen, setIsCameraOpen] = useState(false);
  const [appliedOverrides, setAppliedOverrides] = useState<
    Record<number, number>
  >({});
  const [previousBreakdown, setPreviousBreakdown] = useState<
    GradeResult["breakdown"] | null
  >(null);
  const [gradingProgressPercent, setGradingProgressPercent] = useState(0);
  const [gradingStageLabel, setGradingStageLabel] = useState("");
  const workFilesRef = useRef<WorkFile[]>([]);
  const isTimerRunningRef = useRef(false);
  const startedAtRef = useRef<number | null>(null);
  const elapsedBeforePauseRef = useRef(0);
  const cameraSupported = supportsCameraCapture();
  const isPlatformExam = exam.platform != null;
  const isOlympiad =
    isPlatformExam || exam.id.startsWith("olimpiada-") || exam.id.startsWith("olympiad:");
  const gradingSession = useSyncExternalStore(
    (callback) => subscribeGradingSession(exam.id, callback),
    () => getGradingSession(exam.id),
    () => undefined,
  );
  const isGrading = gradingSession?.status === "running";
  const grade = gradingSession?.result ?? savedGrade;
  const displayedGrade = useMemo<GradeResult | null>(
    () =>
      grade
        ? recomputeGradeWithOverrides(grade, appliedOverrides, isOlympiad)
        : null,
    [grade, appliedOverrides, isOlympiad],
  );
  const hasUserEdits = Object.keys(appliedOverrides).length > 0;
  const displayedError =
    error ??
    (gradingSession?.status === "error"
      ? gradingSession.error ?? "Corectarea a eșuat."
      : null);
  const displayedRemainingCorrections =
    gradingSession?.remaining ?? remainingCorrections;

  useEffect(() => {
    if (
      gradingSession?.status !== "done" ||
      !gradingSession.updatedAt ||
      !displayedGrade ||
      (displayedGrade.reviewRequired && !hasUserEdits)
    ) {
      return;
    }
    saveGradingAttempt(exam.id, displayedGrade, gradingSession.updatedAt);
  }, [
    displayedGrade,
    exam.id,
    gradingSession?.status,
    gradingSession?.updatedAt,
    hasUserEdits,
  ]);

  useEffect(() => {
    workFilesRef.current = workFiles;
  }, [workFiles]);

  // One-time mount hydration from localStorage. This is the legitimate React
  // exception to "setState in effect" (reading an external browser store once
  // on mount to restore persisted UI state); the rule is disabled for this
  // block intentionally. See https://react.dev/learn/you-might-not-need-an-effect
  /* eslint-disable react-hooks/set-state-in-effect */
  useEffect(() => {
    const { elapsed, wasRunning, leftAt } = readSavedTimer(timerStorageKey);
    let totalElapsed = Math.min(examDurationSeconds, elapsed);
    if (wasRunning && leftAt != null) {
      const awaySeconds = Math.floor((Date.now() - leftAt) / 1000);
      totalElapsed = Math.min(examDurationSeconds, elapsed + awaySeconds);
    }
    setElapsedBeforePause(totalElapsed);
    const nextRemaining = Math.max(0, examDurationSeconds - totalElapsed);
    setRemaining(nextRemaining);
    if (wasRunning && nextRemaining > 0) {
      const now = Date.now();
      setIsTimerRunning(true);
      setStartedAt(now);
      isTimerRunningRef.current = true;
      startedAtRef.current = now;
      elapsedBeforePauseRef.current = totalElapsed;
    }
    setTimerHydrated(true);
  }, [examDurationSeconds, timerStorageKey]);
  /* eslint-enable react-hooks/set-state-in-effect */

  useEffect(() => {
    isTimerRunningRef.current = isTimerRunning;
  }, [isTimerRunning]);

  useEffect(() => {
    startedAtRef.current = startedAt;
  }, [startedAt]);

  useEffect(() => {
    elapsedBeforePauseRef.current = elapsedBeforePause;
  }, [elapsedBeforePause]);

  useEffect(() => {
    return () => {
      for (const item of workFilesRef.current) {
        URL.revokeObjectURL(item.previewUrl);
      }
    };
  }, []);

  useEffect(() => {
    if (!userId) return;
    let cancelled = false;
    void reconcileWorkspace(exam.id, userId).then((workspace) => {
      if (!cancelled && !getGradingSession(exam.id) && workspace.grade) {
        setSavedGrade(workspace.grade.result);
      }
    });
    return () => {
      cancelled = true;
    };
  }, [exam.id, userId]);

  useEffect(() => {
    function computeElapsed() {
      if (isTimerRunning && startedAt != null) {
        return elapsedBeforePause + Math.floor((Date.now() - startedAt) / 1000);
      }
      return elapsedBeforePause;
    }
    try {
      window.localStorage.setItem(
        timerStorageKey,
        JSON.stringify({
          elapsed: computeElapsed(),
          wasRunning: isTimerRunning,
          leftAt: Date.now(),
        }),
      );
    } catch {
      // ignore
    }
  }, [timerStorageKey, elapsedBeforePause, isTimerRunning, startedAt]);

  useEffect(() => {
    return () => {
      if (isTimerRunningRef.current && startedAtRef.current != null) {
        const finalElapsed =
          elapsedBeforePauseRef.current +
          Math.floor((Date.now() - startedAtRef.current) / 1000);
        const clamped = Math.min(examDurationSeconds, finalElapsed);
        try {
          window.localStorage.setItem(
            timerStorageKey,
            JSON.stringify({
              elapsed: clamped,
              wasRunning: true,
              leftAt: Date.now(),
            }),
          );
        } catch {
          // ignore
        }
      }
    };
  }, [examDurationSeconds, timerStorageKey]);

  useEffect(() => {
    if (!isTimerRunning || startedAt == null) return;
    const interval = window.setInterval(() => {
      const elapsed =
        elapsedBeforePause + Math.floor((Date.now() - startedAt) / 1000);
      const nextRemaining = Math.max(0, examDurationSeconds - elapsed);
      setRemaining(nextRemaining);
      try {
        window.localStorage.setItem(
          timerStorageKey,
          JSON.stringify({
            elapsed: Math.min(examDurationSeconds, elapsed),
            wasRunning: true,
            leftAt: Date.now(),
          }),
        );
      } catch {
        // ignore
      }
      if (nextRemaining === 0) {
        setIsTimerRunning(false);
        setStartedAt(null);
        setElapsedBeforePause(examDurationSeconds);
      }
    }, 1000);
    return () => window.clearInterval(interval);
  }, [elapsedBeforePause, examDurationSeconds, isTimerRunning, startedAt, timerStorageKey]);

  const files = workFiles.map((item) => item.file);
  const gradingStartedAt = gradingSession?.startedAt ?? 0;
  const gradingImageCount = gradingSession?.imageCount ?? files.length;

  useEffect(() => {
    if (!isGrading) return;
    const tick = () => {
      const elapsed = Date.now() - gradingStartedAt;
      setGradingProgressPercent(gradingProgress(elapsed, gradingImageCount));
      setGradingStageLabel(gradingStageMessage(elapsed));
    };
    tick();
    const interval = window.setInterval(tick, 200);
    return () => {
      window.clearInterval(interval);
      setGradingProgressPercent(0);
      setGradingStageLabel("");
    };
  }, [gradingImageCount, gradingStartedAt, isGrading]);

  const isInspectingImages = workFiles.some(
    (item) => item.inspectionStatus === "checking",
  );
  const hasBlockingImageIssues = workFiles.some((item) =>
    item.issues.some((issue) => issue.severity === "error"),
  );
  const gradingStep = grade ? 3 : files.length > 0 ? 2 : 1;
  const reviewMessages = displayedGrade
    ? [
        ...(displayedGrade.reviewReasons ?? []),
        ...displayedGrade.unclearWorkWarnings,
        ...displayedGrade.manualReviewNotes,
      ].filter((item, index, items) => items.indexOf(item) === index)
    : [];
  const confidenceLabel = displayedGrade
    ? displayedGrade.confidence >= 0.85
      ? "Încredere ridicată"
      : displayedGrade.confidence >= 0.65
        ? "Încredere medie"
        : "Încredere scăzută"
    : "";

  function startTimer() {
    if (isTimerRunning || remaining === 0) return;
    setStartedAt(Date.now());
    setIsTimerRunning(true);
  }

  function pauseTimer() {
    if (!isTimerRunning || startedAt == null) return;
    const elapsed =
      elapsedBeforePause + Math.floor((Date.now() - startedAt) / 1000);
    const nextElapsed = Math.min(examDurationSeconds, elapsed);
    setElapsedBeforePause(nextElapsed);
    setRemaining(Math.max(0, examDurationSeconds - nextElapsed));
    setStartedAt(null);
    setIsTimerRunning(false);
  }

  function resetTimer() {
    setStartedAt(null);
    setElapsedBeforePause(0);
    setRemaining(examDurationSeconds);
    setIsTimerRunning(false);
  }

  function addFiles(newFiles: File[], mode: "replace" | "append") {
    if (isAiLocked) return;
    setError(null);
    setMessage(null);
    clearGrade();

    const existing = mode === "append" ? workFilesRef.current : [];
    if (mode === "replace") {
      for (const item of workFilesRef.current) {
        URL.revokeObjectURL(item.previewUrl);
      }
    }

    const remainingSlots = Math.max(0, maxFiles - existing.length);
    const accepted = newFiles.slice(0, remainingSlots);
    if (mode === "replace" && newFiles.length > maxFiles) {
      setError(
        `Ai selectat ${newFiles.length} poze. Am păstrat primele ${maxFiles}.`,
      );
    } else if (mode === "append" && newFiles.length > remainingSlots) {
      setError(
        `Ai atins limita de ${maxFiles} ${isPlatformExam ? "capturi" : "pagini"}. Am păstrat primele ${maxFiles}.`,
      );
    }

    const nextFiles = accepted.map((file) => ({
      id: crypto.randomUUID(),
      file,
      previewUrl: URL.createObjectURL(file),
      inspectionStatus: "checking" as const,
      issues: [],
    }));
    setWorkFiles([...existing, ...nextFiles]);

    void Promise.all(
      nextFiles.map(async (item): Promise<WorkFile> => {
        try {
          const dimensions = await imageDimensions(item.previewUrl);
          return {
            ...item,
            ...dimensions,
            inspectionStatus: "ready",
            issues: workImageQualityIssues({
              mimeType: item.file.type,
              sizeBytes: item.file.size,
              ...dimensions,
            }),
          };
        } catch {
          return {
            ...item,
            inspectionStatus: "ready",
            issues: workImageQualityIssues({
              mimeType: item.file.type,
              sizeBytes: item.file.size,
              width: 0,
              height: 0,
            }),
          };
        }
      }),
    ).then((inspectedFiles) => {
      const inspectedIds = new Set(inspectedFiles.map((item) => item.id));
      setWorkFiles((current) => {
        if (inspectedFiles.length === 0) return current;
        return current.map((item) =>
          inspectedIds.has(item.id)
            ? inspectedFiles.find((next) => next.id === item.id) ?? item
            : item,
        );
      });
    });

    if (nextFiles.length > 0) setActivePanel("work");
  }

  function onFileChange(event: ChangeEvent<HTMLInputElement>) {
    addFiles(Array.from(event.target.files ?? []), "replace");
    event.target.value = "";
  }

  function onCameraCapture(file: File) {
    addFiles([file], "append");
  }

  function removeFile(index: number) {
    clearGrade();
    setMessage(null);
    setWorkFiles((current) => {
      const removed = current[index];
      if (removed) URL.revokeObjectURL(removed.previewUrl);
      return current.filter((_, itemIndex) => itemIndex !== index);
    });
  }

  function moveFile(index: number, direction: -1 | 1) {
    clearGrade();
    setMessage(null);
    setWorkFiles((current) => {
      const targetIndex = index + direction;
      if (targetIndex < 0 || targetIndex >= current.length) return current;
      const next = [...current];
      [next[index], next[targetIndex]] = [next[targetIndex], next[index]];
      return next;
    });
  }

  function requestGrade() {
    if (isAiLocked) return;
    setError(null);
    setMessage(null);
    if (files.length === 0) {
      setError(
        isPlatformExam
          ? "Încarcă cel puțin o captură cu rezultatul."
          : "Încarcă cel puțin o poză cu lucrarea.",
      );
      return;
    }
    if (isInspectingImages) {
      setError("Așteaptă verificarea locală a pozelor înainte de corectare.");
      return;
    }
    if (hasBlockingImageIssues) {
      setError("Înlocuiește pozele marcate cu eroare înainte de corectare.");
      return;
    }

    setPreviousBreakdown(grade?.breakdown ?? null);
    setAppliedOverrides({});
    setSavedGrade(null);
    startGradingSession({ examId: exam.id, files, userId });
  }

  function stopGrading() {
    stopGradingSession(exam.id);
    setMessage("Corectarea a fost oprită. Rezultatul anterior, dacă există, a rămas neschimbat.");
  }

  function scrollToPhoto(photoNumber: number) {
    const el = document.querySelector<HTMLElement>(
      `[data-photo-number="${photoNumber}"]`,
    );
    if (!el) return;
    el.scrollIntoView({ behavior: "smooth", block: "center" });
    el.classList.add("ring-2", "ring-emerald-500");
    window.setTimeout(() => {
      el.classList.remove("ring-2", "ring-emerald-500");
    }, 1400);
  }

  function clearGrade() {
    setSavedGrade(null);
    setAppliedOverrides({});
    setPreviousBreakdown(null);
    dismissGradingSession(exam.id);
    writeWorkspace(exam.id, userId, { grade: null });
    if (userId) void saveWorkspace(exam.id, { grade: null });
  }

  function setAwardedOverride(index: number, raw: string) {
    const item = grade?.breakdown[index];
    if (!item) return;
    if (raw.trim() === "") {
      resetAwardedOverride(index);
      return;
    }
    const value = Number(raw);
    if (Number.isNaN(value)) return;
    const clamped = Math.max(0, Math.min(item.maxPoints, value));
    setAppliedOverrides((current) => ({ ...current, [index]: clamped }));
  }

  function resetAwardedOverride(index: number) {
    setAppliedOverrides((current) => {
      if (!(index in current)) return current;
      const next = { ...current };
      delete next[index];
      return next;
    });
  }

  function resetAllEdits() {
    setAppliedOverrides({});
  }

  return (
    <section aria-labelledby="exam-workspace-title" className="min-h-[calc(100vh-3.5rem)] bg-[#f3f5f1] text-zinc-950">
      <div className="mx-auto flex min-h-[calc(100vh-3.5rem)] w-full min-w-0 max-w-[1800px] flex-col gap-3 p-3 lg:grid lg:h-[calc(100dvh-3.5rem)] lg:min-h-[540px] lg:grid-rows-[auto_minmax(0,1fr)] lg:p-4">
        <header className="grid min-h-0 gap-3 rounded-2xl border border-zinc-200/80 bg-white px-4 py-2.5 shadow-[0_1px_2px_rgba(0,0,0,0.04),0_8px_24px_rgba(0,0,0,0.035)] sm:grid-cols-[minmax(0,1fr)_auto] sm:items-center">
          <div className="flex min-w-0 items-center gap-3">
            <Link
              href={backHref ?? `/${exam.subject}`}
              className="inline-flex h-10 w-10 shrink-0 items-center justify-center rounded-xl border border-zinc-200 bg-zinc-50 text-zinc-700 transition hover:border-zinc-300 hover:bg-zinc-100 hover:text-zinc-950"
              aria-label="Înapoi la lista de examene"
              title="Înapoi"
            >
              <ArrowLeft className="h-5 w-5" />
            </Link>
            <div className="min-w-0">
              <h1 id="exam-workspace-title" className="truncate text-xl font-semibold leading-6">
                {exam.sessionLabel}
              </h1>
              <p className="truncate text-sm text-zinc-600">
                {exam.dateLabel}
              </p>
            </div>
          </div>

          <div className="flex flex-wrap items-center justify-between gap-2 sm:justify-end">
            <div className="flex h-10 shrink-0 items-center gap-2 rounded-xl border border-zinc-200 bg-zinc-50 px-2.5 text-zinc-900">
              <Clock className="h-4 w-4 text-emerald-700" />
              <span className="font-mono text-base font-semibold tabular-nums">
                {timerHydrated ? formatDuration(remaining) : formatDuration(examDurationSeconds)}
              </span>
              <button
                type="button"
                onClick={timerHydrated ? (isTimerRunning ? pauseTimer : startTimer) : undefined}
                disabled={timerHydrated ? remaining === 0 : true}
                className="inline-flex h-7 w-7 items-center justify-center rounded-lg bg-white text-zinc-700 shadow-sm ring-1 ring-inset ring-zinc-200 transition hover:bg-zinc-100 hover:text-zinc-950 disabled:cursor-not-allowed disabled:opacity-50"
                aria-label={timerHydrated ? (isTimerRunning ? "Pauzează timerul" : "Pornește timerul") : "Pornește timerul"}
                title={timerHydrated ? (isTimerRunning ? "Pauzează" : "Pornește") : "Pornește"}
              >
                {timerHydrated && isTimerRunning ? (
                  <Pause className="h-4 w-4" />
                ) : (
                  <Play className="h-4 w-4" />
                )}
              </button>
              <button
                type="button"
                onClick={timerHydrated ? resetTimer : undefined}
                className="inline-flex h-7 w-7 items-center justify-center rounded-lg bg-white text-zinc-700 shadow-sm ring-1 ring-inset ring-zinc-200 transition hover:bg-zinc-100 hover:text-zinc-950"
                aria-label="Resetează timerul"
                title="Resetează"
              >
                <RotateCcw className="h-4 w-4" />
              </button>
            </div>
            <Link
              href={baremHref ?? `/exam/${exam.id}/barem`}
              className="inline-flex h-10 shrink-0 items-center justify-center gap-2 rounded-xl border border-zinc-200 bg-zinc-50 px-3 text-sm font-semibold text-zinc-800 transition hover:border-zinc-300 hover:bg-zinc-100 hover:text-zinc-950"
            >
              <FileText className="h-4 w-4" />
              <span>{isPlatformExam ? "Rezultat" : "Barem"}</span>
            </Link>
          </div>
        </header>

        <nav
          aria-label="Panou mobil"
          className="grid grid-cols-2 gap-1 rounded-xl bg-zinc-200/70 p-1 lg:hidden"
        >
          <button
            type="button"
            onClick={() => setActivePanel("subject")}
            className={`min-h-10 rounded-lg px-3 text-sm font-semibold transition ${
              activePanel === "subject"
                ? "bg-white text-zinc-950 shadow-sm"
                : "text-zinc-600 hover:text-zinc-950"
            }`}
          >
            {isPlatformExam ? "Platformă" : "Subiect"}
          </button>
          <button
            type="button"
            onClick={() => setActivePanel("work")}
            className={`min-h-10 rounded-lg px-3 text-sm font-semibold transition ${
              activePanel === "work"
                ? "bg-white text-zinc-950 shadow-sm"
                : "text-zinc-600 hover:text-zinc-950"
            }`}
          >
            Corector AI
          </button>
        </nav>

        <div
          className={`grid min-h-0 min-w-0 flex-1 grid-cols-[minmax(0,1fr)] gap-3 lg:grid-rows-1 ${
            grade
              ? "lg:grid-cols-[minmax(0,1fr)_560px]"
              : "lg:grid-cols-[minmax(0,1fr)_410px]"
          }`}
        >
          <section
            className={`min-h-[420px] min-w-0 overflow-hidden rounded-2xl border border-zinc-200/80 bg-white shadow-[0_1px_2px_rgba(0,0,0,0.04),0_10px_30px_rgba(0,0,0,0.04)] lg:block lg:min-h-0 ${
              activePanel === "subject" ? "block" : "hidden"
            }`}
          >
            {exam.platform ? (
              <PlatformTaskPanel platform={exam.platform} view="subject" />
            ) : (
              <PdfViewer src={exam.examPdfPath} title={`Subiect ${exam.title}`} />
            )}
          </section>

          <aside
            className={`min-h-[520px] min-w-0 overflow-hidden rounded-2xl border border-zinc-200/80 bg-white shadow-[0_1px_2px_rgba(0,0,0,0.04),0_10px_30px_rgba(0,0,0,0.04)] lg:block lg:min-h-0 ${
              activePanel === "work" ? "block" : "hidden"
            }`}
          >
            <div className="grid h-full min-h-0 grid-rows-[auto_minmax(0,1fr)]">
              <div className="flex items-center justify-between border-b border-zinc-100 px-4 py-3.5">
                <div>
                  <h2 className="flex items-center gap-2 text-lg font-semibold leading-6">
                    <Sparkles className="h-4 w-4 text-emerald-700" aria-hidden="true" />
                    Corectare AI
                  </h2>
                  {!grade && files.length > 0 ? (
                    <p className="text-sm text-zinc-500">
                      {files.length}/{maxFiles} {isPlatformExam ? "capturi" : "pagini"}
                    </p>
                  ) : null}
                </div>
                {!isAiAccessLoading && !isAiLocked ? (
                  <span className="rounded-full bg-emerald-50 px-2.5 py-1 text-xs font-semibold text-emerald-800 ring-1 ring-inset ring-emerald-100">
                    Pasul {gradingStep} din 3
                  </span>
                ) : null}
              </div>

              <div className="min-h-0 overflow-auto">
                {isAiAccessLoading ? (
                  <AiFeatureAccessSkeleton />
                ) : isAiLocked ? (
                  <AiFeatureAccessCard kind="corrector" />
                ) : (
                  <div className="p-4">
                    {grade ? (
                      <>
                        <label className="flex min-h-11 cursor-pointer items-center justify-between rounded-xl border border-zinc-200 bg-zinc-50 px-3 text-sm transition hover:border-zinc-300 hover:bg-white">
                          <span>
                            <span className="font-semibold">
                              {files.length} {isPlatformExam ? "capturi analizate" : "pagini analizate"}
                            </span>
                            <span className="ml-2 text-xs text-zinc-500">
                              Schimbarea pozelor resetează rezultatul
                            </span>
                          </span>
                          <span className="font-semibold text-emerald-800">
                            Schimbă
                          </span>
                          <input
                            type="file"
                            accept="image/jpeg,image/png,image/webp"
                            multiple
                            onChange={onFileChange}
                            className="sr-only"
                          />
                        </label>
                        {workFiles.length > 0 ? (
                          <ul className="mt-3 grid grid-cols-4 gap-2 sm:grid-cols-8">
                            {workFiles.map((item, index) => (
                              <li
                                key={item.id}
                                data-photo-number={index + 1}
                                className="relative flex h-20 items-center justify-center overflow-hidden rounded-lg border border-zinc-200 bg-white transition"
                              >
                                {/* eslint-disable-next-line @next/next/no-img-element -- Local blob previews cannot be optimized by next/image. */}
                                <img
                                  src={item.previewUrl}
                                  alt={`Pagina ${index + 1}`}
                                  className="h-full w-full object-cover"
                                />
                                <span className="absolute left-1 top-1 rounded bg-zinc-950/80 px-1.5 py-0.5 text-xs font-semibold text-white">
                                  {index + 1}
                                </span>
                              </li>
                            ))}
                          </ul>
                        ) : null}
                      </>
                    ) : (
                      <div className="grid gap-2">
                        <label className="flex cursor-pointer flex-col items-center justify-center gap-3 rounded-2xl border border-dashed border-zinc-300 bg-zinc-50/80 px-4 py-7 text-center transition hover:border-emerald-400 hover:bg-emerald-50/40">
                          <span className="inline-flex h-12 w-12 items-center justify-center rounded-2xl bg-white text-emerald-700 shadow-sm ring-1 ring-inset ring-zinc-200">
                            <Upload className="h-6 w-6" />
                          </span>
                          <span className="text-sm font-semibold">
                            {isPlatformExam
                              ? "Încarcă rezultatul de pe platformă"
                              : "Încarcă paginile lucrării"}
                          </span>
                          <span className="max-w-xs text-xs leading-5 text-zinc-500">
                            {isPlatformExam
                              ? "Capturi clare în care se văd platforma și punctajul. Fără nume sau alte date personale."
                              : "Fotografii drepte, clare și în ordinea paginilor. Fără nume sau alte date personale."}
                          </span>
                          <input
                            type="file"
                            accept="image/jpeg,image/png,image/webp"
                            multiple
                            onChange={onFileChange}
                            className="sr-only"
                          />
                        </label>
                        {cameraSupported ? (
                          <button
                            type="button"
                            onClick={() => setIsCameraOpen(true)}
                            disabled={isAiLocked || workFiles.length >= maxFiles}
                            className="inline-flex w-full items-center justify-center gap-2 rounded-2xl border border-emerald-300 bg-emerald-50 px-4 py-3 text-sm font-semibold text-emerald-800 transition hover:border-emerald-400 hover:bg-emerald-100 disabled:cursor-not-allowed disabled:opacity-50"
                          >
                            <Camera className="h-4 w-4" />
                            {workFiles.length > 0
                              ? "Fă o poză nouă acum"
                              : "Fă o poză acum"}
                          </button>
                        ) : null}
                      </div>
                    )}

                {!grade && workFiles.length > 0 ? (
                  <ul className="mt-3 grid grid-cols-2 gap-2">
                    {workFiles.map((item, index) => (
                      <li
                        key={item.id}
                        className="flex min-w-0 flex-col rounded-xl border border-zinc-200 bg-zinc-50 p-2 text-sm"
                      >
                        <span className="relative flex h-28 items-center justify-center overflow-hidden border border-zinc-200 bg-white">
                          {/* eslint-disable-next-line @next/next/no-img-element -- Local blob previews cannot be optimized by next/image. */}
                          <img
                            src={item.previewUrl}
                            alt={`Pagina ${index + 1} din lucrare`}
                            className="h-full w-full object-cover"
                          />
                          <span className="absolute left-1 top-1 bg-zinc-950 px-1.5 py-0.5 text-xs font-semibold text-white">
                            {index + 1}
                          </span>
                        </span>
                        <span className="min-w-0 py-2">
                          <span className="block truncate font-semibold" title={item.file.name}>
                            Pagina {index + 1}
                          </span>
                          <span className="mt-1 block text-xs text-zinc-500">
                            {(item.file.size / 1024 / 1024).toFixed(1)} MB
                            {item.width && item.height
                              ? ` · ${item.width}×${item.height}`
                              : ""}
                          </span>
                          {item.inspectionStatus === "checking" ? (
                            <span className="mt-1 block text-xs text-zinc-500">
                              Verificăm calitatea local...
                            </span>
                          ) : null}
                          {item.issues.map((issue) => (
                            <span
                              key={issue.code}
                              className={`mt-1 block text-xs ${
                                issue.severity === "error"
                                  ? "font-semibold text-red-800"
                                  : "text-yellow-800"
                              }`}
                            >
                              {issue.message}
                            </span>
                          ))}
                        </span>
                        <span className="mt-auto grid grid-cols-3 gap-1.5 border-t border-zinc-200 pt-2">
                          <button
                            type="button"
                            onClick={() => moveFile(index, -1)}
                            disabled={isAiLocked || index === 0}
                            className="inline-flex h-10 min-w-0 items-center justify-center border border-zinc-300 bg-white hover:bg-zinc-950 hover:text-white disabled:cursor-not-allowed disabled:opacity-35 disabled:hover:bg-white disabled:hover:text-zinc-950"
                            aria-label={`Mută ${item.file.name} mai sus`}
                            title="Mută mai sus"
                          >
                            <ArrowUp className="h-4 w-4" />
                          </button>
                          <button
                            type="button"
                            onClick={() => moveFile(index, 1)}
                            disabled={isAiLocked || index === workFiles.length - 1}
                            className="inline-flex h-10 min-w-0 items-center justify-center border border-zinc-300 bg-white hover:bg-zinc-950 hover:text-white disabled:cursor-not-allowed disabled:opacity-35 disabled:hover:bg-white disabled:hover:text-zinc-950"
                            aria-label={`Mută ${item.file.name} mai jos`}
                            title="Mută mai jos"
                          >
                            <ArrowDown className="h-4 w-4" />
                          </button>
                          <button
                            type="button"
                            onClick={() => removeFile(index)}
                            disabled={isAiLocked}
                            className="inline-flex h-10 min-w-0 items-center justify-center border border-zinc-300 bg-white hover:bg-zinc-950 hover:text-white"
                            aria-label={`Șterge ${item.file.name}`}
                            title="Șterge"
                          >
                            <X className="h-4 w-4" />
                          </button>
                        </span>
                      </li>
                    ))}
                  </ul>
                ) : null}

                {!grade && isGrading ? (
                  <div className="mt-3 rounded-xl border border-emerald-200 bg-emerald-50/60 p-4">
                    <div className="flex items-center justify-between gap-3">
                      <p className="flex items-center gap-2 text-sm font-semibold text-emerald-900">
                        <Sparkles className="h-4 w-4 animate-pulse" />
                        {gradingStageLabel}
                      </p>
                      <span className="shrink-0 font-mono text-sm tabular-nums text-emerald-800">
                        {gradingProgressPercent}%
                      </span>
                    </div>
                    <div
                      className="mt-2.5 h-2.5 w-full overflow-hidden rounded-full bg-emerald-100"
                      role="progressbar"
                      aria-valuenow={gradingProgressPercent}
                      aria-valuemin={0}
                      aria-valuemax={100}
                    >
                      <div
                        className="h-full rounded-full bg-emerald-600 transition-[width] duration-300 ease-out"
                        style={{ width: `${gradingProgressPercent}%` }}
                      />
                    </div>
                    <p className="mt-2.5 text-xs leading-5 text-emerald-800/80">
                      Corectarea durează de obicei 30–60 de secunde. Poți
                      continua să urmărești subiectul în timp ce așteptăm.
                    </p>
                    <button
                      type="button"
                      onClick={stopGrading}
                      className="mt-3 inline-flex w-full items-center justify-center gap-2 rounded-xl border border-zinc-200 bg-white px-4 py-2.5 text-sm font-semibold text-zinc-950 transition hover:bg-zinc-100"
                    >
                      <Square className="h-4 w-4 fill-current" />
                      Oprește corectarea
                    </button>
                  </div>
                ) : !grade ? (
                  <button
                    type="button"
                    onClick={requestGrade}
                    disabled={
                      !isAiLocked &&
                      (files.length === 0 ||
                        isInspectingImages ||
                        hasBlockingImageIssues)
                    }
                    className="mt-3 inline-flex w-full items-center justify-center gap-2 rounded-xl bg-emerald-700 px-4 py-3 font-semibold text-white shadow-sm transition hover:bg-emerald-800 disabled:cursor-not-allowed disabled:bg-zinc-200 disabled:text-zinc-400 disabled:shadow-none"
                  >
                    <Sparkles className="h-4 w-4" />
                    {isInspectingImages ? "Verificăm pozele..." : "Corectează"}
                  </button>
                ) : null}
                {!grade ? (
                <p className="mt-2 text-xs leading-5 text-zinc-500">
                  {isPlatformExam
                    ? "Capturile sunt trimise furnizorului AI pentru citirea punctajului. Verifică rezultatul cu cel afișat pe platformă."
                    : "Pozele sunt trimise furnizorului AI pentru corectare. Rezultatul este orientativ și trebuie verificat cu baremul oficial."}
                  {displayedRemainingCorrections
                    ? displayedRemainingCorrections === "unlimited"
                      ? " Ai acces nelimitat."
                      : ` Mai ai ${displayedRemainingCorrections} corectări disponibile.`
                    : ""}
                </p>
                ) : null}

                {message ? (
                  <p className="mt-3 border border-emerald-300 bg-emerald-50 px-3 py-2 text-sm text-emerald-950">
                    {message}
                  </p>
                ) : null}
                {displayedError ? (
                  <p className="mt-3 border border-red-300 bg-red-50 px-3 py-2 text-sm text-red-950">
                    {displayedError}
                  </p>
                ) : null}

                {displayedGrade ? (
                  <section className="mt-3">
                    <div className="rounded-2xl border border-zinc-200 bg-zinc-50 p-4">
                      <div className="flex items-start justify-between gap-4">
                        <div>
                          <p className="text-xs font-semibold uppercase tracking-[0.14em] text-emerald-800">
                            {hasUserEdits ? "Rezultat ajustat" : "Rezultat orientativ"}
                          </p>
                          <p className="mt-2 text-sm text-zinc-600">
                            {displayedGrade.rawPoints} puncte · {confidenceLabel}
                          </p>
                        </div>
                        <strong
                          className={`min-w-16 rounded-xl px-3 py-2 text-center text-xl ${scoreBand(displayedGrade.totalScore).tileClass}`}
                        >
                          {formatScore(displayedGrade.totalScore)}
                        </strong>
                      </div>
                      <p className="mt-3 text-xs leading-5 text-zinc-500">
                        {isPlatformExam
                          ? "Compară punctajul citit cu rezultatul de pe platformă înainte de a-l ajusta. Modificările se salvează automat."
                          : "Compară explicațiile de mai jos cu lucrarea și baremul înainte de a ajusta punctajul. Modificările se salvează automat."}
                      </p>
                    </div>

                    {reviewMessages.length > 0 ? (
                      <div className="mt-3 rounded-xl border border-yellow-300 bg-yellow-50 p-3 text-sm text-yellow-950">
                        <p className="font-semibold">Ce trebuie verificat</p>
                        <ul className="mt-2 list-disc space-y-1 pl-5">
                          {reviewMessages.map((item) => (
                            <li key={item}>{item}</li>
                          ))}
                        </ul>
                        {grade?.reviewRequired ? (
                          <button
                            type="button"
                            onClick={requestGrade}
                            disabled={isGrading || files.length === 0}
                            className="mt-3 inline-flex min-h-11 w-full items-center justify-center gap-2 border border-yellow-700 bg-white px-3 font-semibold text-yellow-950 transition hover:bg-yellow-950 hover:text-white disabled:cursor-not-allowed disabled:opacity-50"
                          >
                            <Sparkles className="h-4 w-4" />
                            {isGrading ? "Se reface..." : "Refă după verificarea pozelor"}
                          </button>
                        ) : null}
                      </div>
                    ) : null}

                    {previousBreakdown ? (
                      <p className="mt-3 text-xs text-zinc-500">
                        Comparat cu rezultatul anterior (tăiat).
                      </p>
                    ) : null}

                    <div className="mt-4 flex items-center justify-between gap-3">
                      <h3 className="font-semibold">
                        {isPlatformExam ? "Punctaj citit" : "Punctaj pe itemi"}
                      </h3>
                      <div className="flex items-center gap-3">
                        {hasUserEdits ? (
                          <button
                            type="button"
                            onClick={resetAllEdits}
                            className="text-xs font-semibold text-zinc-600 underline decoration-zinc-300 hover:text-zinc-950"
                          >
                            Resetează ajustările
                          </button>
                        ) : null}
                        <span className="text-xs text-zinc-500">
                          {displayedGrade.breakdown.length} poziții
                        </span>
                      </div>
                    </div>
                    <ul className="mt-2 space-y-2">
                      {displayedGrade.breakdown.map((item, index) => {
                        const originalItem = grade?.breakdown[index];
                        const aiAwarded =
                          originalItem?.awardedPoints ?? item.awardedPoints;
                        const isEdited =
                          Math.abs(aiAwarded - item.awardedPoints) > 0.005;
                        const oficiu = isOficiuItem(item);
                        const previousMatch = previousBreakdown?.find(
                          (prev) =>
                            `${prev.section.trim()}|${prev.item.trim()}` ===
                            `${item.section.trim()}|${item.item.trim()}`,
                        );
                        const previousAwarded = previousMatch?.awardedPoints;
                        const showRegradeDelta =
                          previousBreakdown != null &&
                          previousAwarded != null &&
                          Math.abs(previousAwarded - aiAwarded) > 0.005;
                        return (
                          <li
                            key={`${item.section}-${item.item}-${index}`}
                            className="rounded-xl border border-zinc-200 bg-white p-3 text-sm shadow-[0_1px_2px_rgba(0,0,0,0.03)]"
                          >
                            <div className="flex items-start justify-between gap-3">
                              <div>
                                <p className="font-semibold text-zinc-950">
                                  {item.section}
                                </p>
                                <p className="text-xs text-zinc-500">{item.item}</p>
                              </div>
                              <div className="flex shrink-0 items-center gap-2">
                                {showRegradeDelta ? (
                                  <span className="font-mono text-xs text-zinc-400 line-through">
                                    {previousAwarded}
                                  </span>
                                ) : null}
                                {isEdited ? (
                                  <span className="font-mono text-xs text-zinc-400 line-through">
                                    {aiAwarded}
                                  </span>
                                ) : null}
                                {oficiu ? (
                                  <strong className="border border-zinc-200 bg-zinc-50 px-2 py-1 font-mono text-xs">
                                    {item.awardedPoints}/{item.maxPoints} p
                                  </strong>
                                ) : (
                                  <label className="flex items-center gap-1 rounded-lg border border-zinc-200 bg-white px-1.5 py-1 font-mono text-xs">
                                    <input
                                      type="number"
                                      inputMode="decimal"
                                      step="0.25"
                                      min={0}
                                      max={item.maxPoints}
                                      value={item.awardedPoints}
                                      aria-label={`Punctaj acordat pentru ${item.section} ${item.item}`}
                                      onChange={(event) =>
                                        setAwardedOverride(index, event.target.value)
                                      }
                                      onWheel={(event) =>
                                        event.currentTarget.blur()
                                      }
                                      className="w-12 bg-transparent text-right tabular-nums focus:outline-none focus:ring-1 focus:ring-emerald-500"
                                    />
                                    <span className="text-zinc-500">
                                      / {item.maxPoints} p
                                    </span>
                                  </label>
                                )}
                              </div>
                            </div>
                            <div className="mt-2 text-sm text-zinc-700">
                              <AiMessage content={item.feedback} />
                            </div>
                            {item.studentEvidence || item.rubricEvidence ? (
                              <details className="mt-2 border-t border-zinc-100 pt-2 text-xs text-zinc-600">
                                <summary className="cursor-pointer font-semibold text-zinc-700">
                                  Vezi dovezile evaluării
                                </summary>
                                {item.studentEvidence ? (
                                  <p className="mt-2 leading-5">
                                    <span className="font-semibold">
                                      {isPlatformExam ? "În captură:" : "În lucrare:"}
                                    </span>{" "}
                                    {renderPhotoLinkedEvidence(
                                      item.studentEvidence,
                                      scrollToPhoto,
                                    )}
                                  </p>
                                ) : null}
                                {item.rubricEvidence ? (
                                  <p className="mt-1 leading-5">
                                    <span className="font-semibold">
                                      {isPlatformExam ? "Calcul:" : "În barem:"}
                                    </span>{" "}
                                    {renderPhotoLinkedEvidence(
                                      item.rubricEvidence,
                                      scrollToPhoto,
                                    )}
                                  </p>
                                ) : null}
                              </details>
                            ) : null}
                          </li>
                        );
                      })}
                    </ul>

                  </section>
                ) : null}
                  </div>
                )}
              </div>
            </div>
          </aside>
        </div>
      </div>

      <CameraCapture
        open={isCameraOpen}
        capturedCount={workFiles.length}
        maxCount={maxFiles}
        onClose={() => setIsCameraOpen(false)}
        onCapture={onCameraCapture}
      />
    </section>
  );
}
