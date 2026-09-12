import { beforeEach, afterEach, expect, it, vi } from "vitest";
import { fireEvent, render, screen, cleanup } from "@testing-library/react";
import { PracticeSet } from "./practice-set";
import { exercisesForTopic, practiceTopics } from "@/lib/practice-topics";
vi.mock("@/components/ai-message", () => ({ AiMessage: ({ content }: { content: string }) => <p>{content}</p> }));
beforeEach(() => {
  vi.clearAllMocks();
  const data = new Map<string, string>();
  vi.stubGlobal("localStorage", { getItem: (key: string) => data.get(key) ?? null, setItem: (key: string, value: string) => data.set(key, value), removeItem: (key: string) => data.delete(key) });
});
afterEach(() => { cleanup(); vi.unstubAllGlobals(); });
const props = { topic: practiceTopics[0], exercises: exercisesForTopic("functii") };
it("supports public practice without Clerk, preserving drafts and clearing stale self-checks", () => {
  const view = render(<PracticeSet {...props} />);
  fireEvent.change(screen.getByLabelText("Rezolvarea exercițiului 1"), { target: { value: "a=-6" } });
  fireEvent.click(screen.getAllByText("Verifică după barem")[0]);
  fireEvent.click(screen.getByText("Am rezolvat corect"));
  expect(screen.getByRole("status")).toHaveTextContent("1 din 3");
  view.unmount(); render(<PracticeSet {...props} />);
  expect(screen.getByLabelText("Rezolvarea exercițiului 1")).toHaveValue("a=-6");
  fireEvent.change(screen.getByLabelText("Rezolvarea exercițiului 1"), { target: { value: "a=6" } });
  expect(screen.getByRole("status")).toHaveTextContent("0 din 3");
});
