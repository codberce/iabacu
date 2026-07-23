"use client";

import { useEffect, useRef, useState } from "react";
import { Camera, CameraOff, X } from "lucide-react";

type CameraCaptureProps = {
  open: boolean;
  capturedCount: number;
  maxCount: number;
  onClose: () => void;
  onCapture: (file: File) => void;
};

export function supportsCameraCapture() {
  return (
    typeof navigator !== "undefined" &&
    !!navigator.mediaDevices?.getUserMedia
  );
}

export function CameraCapture({
  open,
  capturedCount,
  maxCount,
  onClose,
  onCapture,
}: CameraCaptureProps) {
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [isStarting, setIsStarting] = useState(false);
  const [flash, setFlash] = useState(false);

  useEffect(() => {
    if (!open) return;
    let cancelled = false;
    const videoEl = videoRef.current;

    async function start() {
      setError(null);
      setIsStarting(true);
      try {
        if (!navigator.mediaDevices?.getUserMedia) {
          throw new Error("Camera nu este disponibilă în acest browser.");
        }
        const stream = await navigator.mediaDevices.getUserMedia({
          video: { facingMode: { ideal: "environment" } },
          audio: false,
        });
        if (cancelled) {
          stream.getTracks().forEach((track) => track.stop());
          return;
        }
        streamRef.current = stream;
        if (videoEl) {
          videoEl.srcObject = stream;
          await videoEl.play().catch(() => {});
        }
      } catch (startError) {
        if (cancelled) return;
        setError(
          startError instanceof DOMException &&
            startError.name === "NotAllowedError"
            ? "Accesul la cameră a fost respins. Permite camera și reîncearcă."
            : startError instanceof Error
              ? startError.message
              : "Camera nu a putut fi pornită.",
        );
      } finally {
        if (!cancelled) setIsStarting(false);
      }
    }

    void start();
    return () => {
      cancelled = true;
      if (streamRef.current) {
        streamRef.current.getTracks().forEach((track) => track.stop());
        streamRef.current = null;
      }
      if (videoEl) videoEl.srcObject = null;
    };
  }, [open]);

  function capture() {
    const video = videoRef.current;
    if (!video || !video.videoWidth || !video.videoHeight) return;
    const canvas = document.createElement("canvas");
    canvas.width = video.videoWidth;
    canvas.height = video.videoHeight;
    const context = canvas.getContext("2d");
    if (!context) return;
    context.drawImage(video, 0, 0, canvas.width, canvas.height);
    canvas.toBlob(
      (blob) => {
        if (!blob) return;
        const stamp = new Date()
          .toISOString()
          .replace(/[:.]/g, "-")
          .slice(0, 19);
        const file = new File([blob], `pagina-${stamp}.jpg`, {
          type: "image/jpeg",
        });
        onCapture(file);
        setFlash(true);
        window.setTimeout(() => setFlash(false), 160);
      },
      "image/jpeg",
      0.92,
    );
  }

  if (!open) return null;
  const full = capturedCount >= maxCount;
  const upcoming = full ? maxCount : capturedCount + 1;

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label="Captează paginile cu camera"
      className="fixed inset-0 z-50 flex flex-col bg-zinc-950/90 backdrop-blur-sm"
    >
      <div className="flex items-center justify-between gap-3 px-4 py-3 text-white">
        <div className="min-w-0">
          <p className="truncate text-sm font-semibold">
            {full
              ? "Ai capturat numărul maxim de pagini"
              : `Captează pagina ${upcoming} din ${maxCount}`}
          </p>
          <p className="truncate text-xs text-zinc-300">
            {full
              ? "Închide pentru a continua"
              : "Centrează pagina și apasă butonul"}
          </p>
        </div>
        <button
          type="button"
          onClick={onClose}
          className="inline-flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-white/10 text-white transition hover:bg-white/20"
          aria-label="Închide camera"
          title="Închide"
        >
          <X className="h-5 w-5" />
        </button>
      </div>

      <div className="relative flex-1 overflow-hidden">
        {error ? (
          <div className="flex h-full flex-col items-center justify-center gap-3 px-6 text-center text-white">
            <CameraOff className="h-10 w-10" />
            <p className="max-w-sm text-sm leading-6">{error}</p>
            <button
              type="button"
              onClick={onClose}
              className="rounded-xl border border-white/30 bg-white/10 px-4 py-2 text-sm font-semibold transition hover:bg-white/20"
            >
              Închide
            </button>
          </div>
        ) : (
          <video
            ref={videoRef}
            playsInline
            muted
            autoPlay
            className="h-full w-full object-contain"
          />
        )}
        {flash ? (
          <div
            className="pointer-events-none absolute inset-0 bg-white"
            aria-hidden="true"
          />
        ) : null}
      </div>

      <div className="flex items-center justify-center gap-3 px-4 py-5">
        <button
          type="button"
          onClick={capture}
          disabled={!!error || isStarting || full}
          className="inline-flex h-16 w-16 items-center justify-center rounded-full bg-white text-emerald-700 shadow-lg ring-4 ring-white/30 transition hover:scale-105 disabled:cursor-not-allowed disabled:opacity-50 disabled:hover:scale-100"
          aria-label={full ? "Număr maxim de pagini atins" : "Captează poza"}
          title={full ? "Număr maxim atins" : "Captează"}
        >
          <Camera className="h-7 w-7" />
        </button>
      </div>
    </div>
  );
}