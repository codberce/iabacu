"use client";

import { useMemo, useSyncExternalStore } from "react";
import { parseStudyHistory, studySnapshot, subscribeStudyHistory } from "@/lib/study-history";

export function useStudyHistory() {
  const raw = useSyncExternalStore(subscribeStudyHistory, studySnapshot, () => null);
  return useMemo(() => parseStudyHistory(raw), [raw]);
}
