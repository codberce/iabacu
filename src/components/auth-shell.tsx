"use client";

import Link from "next/link";
import { useEffect, useRef, useState } from "react";

export function AccountControl() {
  return null;
}

function MobileMenu() {
  const [open, setOpen] = useState(false);
  const buttonRef = useRef<HTMLButtonElement | null>(null);
  const panelRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    if (!open) return;
    const panel = panelRef.current;
    if (panel) {
      const firstLink = panel.querySelector("a");
      firstLink?.focus();
    }
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        setOpen(false);
        buttonRef.current?.focus();
        return;
      }
      if (event.key === "Tab") {
        const panelEl = panelRef.current;
        if (!panelEl) return;
        const focusable = panelEl.querySelectorAll<HTMLElement>(
          'a, button, [tabindex]:not([tabindex="-1"])',
        );
        if (focusable.length === 0) return;
        const first = focusable[0];
        const last = focusable[focusable.length - 1];
        if (event.shiftKey) {
          if (document.activeElement === first) {
            event.preventDefault();
            last.focus();
          }
        } else if (document.activeElement === last) {
          event.preventDefault();
          first.focus();
        }
      }
    };
    document.addEventListener("keydown", handleKeyDown);
    return () => document.removeEventListener("keydown", handleKeyDown);
  }, [open]);

  return (
    <div className="flex items-center sm:hidden">
      <button
        ref={buttonRef}
        type="button"
        aria-label={open ? "Închide navigarea" : "Deschide navigarea"}
        aria-expanded={open}
        aria-controls="mobile-navigation"
        onClick={() => setOpen((value) => !value)}
        className="-ml-2 inline-flex h-9 w-9 items-center justify-center rounded text-zinc-700 hover:text-emerald-800 focus:outline-none focus-visible:outline focus-visible:-outline-offset-2 focus-visible:outline-emerald-700"
      >
        <span className="sr-only">{open ? "Închide navigarea" : "Deschide navigarea"}</span>
        <svg className="h-5 w-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true">
          <path d="M4 6h16M4 12h16M4 18h16" strokeLinecap="round" />
        </svg>
      </button>
      {open && (
        <div
          ref={panelRef}
          id="mobile-navigation"
          className="absolute inset-x-0 top-[var(--header-height)] z-40 border-b border-zinc-200 bg-white px-4 py-3 text-sm font-semibold text-zinc-800 shadow-lg"
        >
          <nav aria-label="Navigare principală" className="flex flex-col gap-3">
            <Link href="/bacalaureat" onClick={() => setOpen(false)}>Bacalaureat</Link>
            <Link href="/evaluare-nationala" onClick={() => setOpen(false)}>Evaluarea Națională</Link>
            <Link href="/olimpiade" onClick={() => setOpen(false)}>Olimpiade</Link>
            <Link href="/despre" onClick={() => setOpen(false)}>Despre</Link>
          </nav>
        </div>
      )}
    </div>
  );
}

function SkipLink() {
  return (
    <a
      href="#main-content"
      className="fixed left-3 z-[60] -translate-y-full rounded-b bg-zinc-950 px-4 py-2 text-sm font-semibold text-white shadow-lg transition-transform focus-visible:translate-y-0"
    >
      Sari la conținut
    </a>
  );
}

function SiteBar() {
  return (
    <>
      <SkipLink />
      <header className="fixed inset-x-0 top-0 z-50 flex h-[var(--header-height)] items-center justify-between border-b border-zinc-200 bg-white px-4 text-zinc-950 shadow-sm sm:px-6 lg:px-8">
        <div className="flex min-w-0 items-center gap-6">
          <Link
            href="/"
            className="shrink-0 text-xs font-bold uppercase tracking-[0.16em] text-emerald-800 transition hover:text-emerald-950"
          >
            iabacu
          </Link>
          <nav aria-label="Navigare principală" className="hidden items-center gap-4 text-sm font-semibold text-zinc-700 sm:flex">
            <Link href="/bacalaureat" className="hover:text-emerald-800">Bacalaureat</Link>
            <Link href="/evaluare-nationala" className="hover:text-emerald-800">Evaluarea Națională</Link>
            <Link href="/olimpiade" className="hover:text-emerald-800">Olimpiade</Link>
            <Link href="/despre" className="hover:text-emerald-800">Despre</Link>
          </nav>
        </div>
        <MobileMenu />
      </header>
      <div className="h-[var(--header-height)] shrink-0" aria-hidden="true" />
    </>
  );
}

export function AuthShell({ children }: { children: React.ReactNode }) {
  return (
    <>
      <SiteBar />
      <div id="main-content" tabIndex={-1}>{children}</div>
    </>
  );
}
