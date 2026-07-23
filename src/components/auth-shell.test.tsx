import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";
import { AuthShell } from "./auth-shell";

afterEach(cleanup);

describe("AuthShell mobile navigation", () => {
  it("opens every destination and closes with Escape", () => {
    render(<AuthShell>conținut</AuthShell>);

    const menu = screen.getByRole("button", { name: "Deschide navigarea" });
    fireEvent.click(menu);

    expect(menu).toHaveAttribute("aria-expanded", "true");
    const dialog = screen.getByRole("dialog", { name: "Navigare principală" });
    expect(dialog).toBeInTheDocument();
    expect(dialog.querySelector('a[href="/bacalaureat"]')).toHaveTextContent("Bacalaureat");
    expect(dialog.querySelector('a[href="/olimpiade"]')).toHaveTextContent("Olimpiade");

    fireEvent.keyDown(document, { key: "Escape" });
    expect(screen.queryByRole("dialog", { name: "Navigare principală" })).not.toBeInTheDocument();
    expect(menu).toHaveFocus();
  });
});
