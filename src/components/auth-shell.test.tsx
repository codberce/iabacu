import { cleanup, fireEvent, render, screen, within } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";
import { AuthShell } from "./auth-shell";

afterEach(cleanup);

describe("AuthShell skip-to-content", () => {
  it("renders a skip link visible on focus targeting main content", () => {
    render(<AuthShell>conținut</AuthShell>);

    const skipLink = screen.getByText("Sari la conținut");
    expect(skipLink).toBeInTheDocument();
    expect(skipLink).toHaveAttribute("href", "#main-content");
    // Skip link is hidden off-screen via -translate-y-full and slides in on focus
    expect(skipLink.className).toContain("-translate-y-full");
    expect(skipLink.className).toContain("focus-visible:translate-y-0");
  });

  it("wraps children in a focusable main-content target", () => {
    render(<AuthShell>conținut</AuthShell>);

    const wrapper = document.getElementById("main-content");
    expect(wrapper).toBeInTheDocument();
    expect(wrapper).toHaveAttribute("tabindex", "-1");
    expect(wrapper).toHaveTextContent("conținut");
  });
});

describe("AuthShell mobile navigation", () => {
  function openMobileMenu() {
    const menu = screen.getByRole("button", { name: "Deschide navigarea" });
    fireEvent.click(menu);
    return menu;
  }

  function getMobilePanel() {
    return document.getElementById("mobile-navigation");
  }

  it("toggles open/close with accessible label and aria-expanded", () => {
    render(<AuthShell>conținut</AuthShell>);

    const menu = screen.getByRole("button", { name: "Deschide navigarea" });
    expect(menu).toHaveAttribute("aria-expanded", "false");
    expect(menu).toHaveAttribute("aria-controls", "mobile-navigation");

    fireEvent.click(menu);

    expect(menu).toHaveAttribute("aria-expanded", "true");
    expect(menu).toHaveAttribute("aria-label", "Închide navigarea");

    const panel = getMobilePanel();
    expect(panel).toBeInTheDocument();
    const nav = within(panel!).getByRole("navigation", { name: "Navigare principală" });
    expect(nav).toBeInTheDocument();
    expect(within(panel!).getByRole("link", { name: "Bacalaureat" })).toBeInTheDocument();
    expect(within(panel!).getByRole("link", { name: "Olimpiade" })).toBeInTheDocument();
    expect(within(panel!).getByRole("link", { name: "Despre" })).toBeInTheDocument();
    expect(within(panel!).getByRole("link", { name: "Evaluarea Națională" })).toBeInTheDocument();

    fireEvent.click(menu);

    expect(menu).toHaveAttribute("aria-expanded", "false");
    expect(menu).toHaveAttribute("aria-label", "Deschide navigarea");
    expect(getMobilePanel()).not.toBeInTheDocument();
  });

  it("closes with Escape and returns focus to the button", () => {
    render(<AuthShell>conținut</AuthShell>);

    const menu = openMobileMenu();
    expect(menu).toHaveAttribute("aria-expanded", "true");

    fireEvent.keyDown(document, { key: "Escape" });

    expect(menu).toHaveAttribute("aria-expanded", "false");
    expect(menu).toHaveFocus();
    expect(getMobilePanel()).not.toBeInTheDocument();
  });

  it("focuses the first link when opened", () => {
    render(<AuthShell>conținut</AuthShell>);

    openMobileMenu();
    const panel = getMobilePanel();
    const firstLink = within(panel!).getAllByRole("link")[0];
    expect(firstLink).toHaveFocus();
  });

  it("traps Tab focus within the open menu", () => {
    render(<AuthShell>conținut</AuthShell>);

    openMobileMenu();
    const panel = getMobilePanel();
    const links = within(panel!).getAllByRole("link");
    const firstLink = links[0];
    const lastLink = links[links.length - 1];

    // Tab on last link wraps to first
    lastLink.focus();
    expect(lastLink).toHaveFocus();
    fireEvent.keyDown(document, { key: "Tab" });
    expect(firstLink).toHaveFocus();

    // Shift+Tab on first link wraps to last
    firstLink.focus();
    expect(firstLink).toHaveFocus();
    fireEvent.keyDown(document, { key: "Tab", shiftKey: true });
    expect(lastLink).toHaveFocus();
  });
});
