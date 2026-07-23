import { cleanup, render, screen, within } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";
import { getPlatformArchive, platformArchivePath } from "@/lib/competitions";
import { PlatformArchive } from "./platform-archive";

afterEach(cleanup);

describe("PlatformArchive", () => {
  it("paginates platform tasks with accessible controls", () => {
    render(
      <PlatformArchive
        olympiadSubject="informatica"
        grade={9}
        page="1"
      />,
    );

    const list = screen.getByRole("list");
    const items = within(list).getAllByRole("listitem");
    expect(items.length).toBeGreaterThan(0);
    expect(items.length).toBeLessThanOrEqual(48);

    const pagination = screen.getByRole("navigation", { name: "Paginare" });
    const next = within(pagination).getByRole("link", { name: /Pagina următoare/ });
    expect(next.getAttribute("rel")).toBe("next");
    expect(next.getAttribute("href")).toContain("pagina=2");
  });

  it("disables previous navigation on the first page", () => {
    render(
      <PlatformArchive
        olympiadSubject="informatica"
        grade={9}
      />,
    );
    const pagination = screen.getByRole("navigation", { name: "Paginare" });
    const previousLabel = within(pagination).getByText("Înapoi");
    expect(previousLabel.closest("[aria-disabled]")).not.toBeNull();
  });

  it("disables next navigation on the last page", () => {
    render(
      <PlatformArchive
        olympiadSubject="informatica"
        grade={9}
        page="9999"
      />,
    );
    const pagination = screen.getByRole("navigation", { name: "Paginare" });
    const nextLabel = within(pagination).getByText("Înainte");
    expect(nextLabel.closest("[aria-disabled]")).not.toBeNull();
  });

  it("keeps the Olimpiade breadcrumb visible", () => {
    render(<PlatformArchive olympiadSubject="informatica" grade={9} />);
    const breadcrumb = screen.getByRole("link", { name: "Olimpiade" });
    expect(breadcrumb).toHaveAttribute("href", "/olimpiade");
  });

  it("shows distinct task names and links each task through the internal exam page", () => {
    const archive = getPlatformArchive({
      olympiadSubject: "informatica",
      grade: 9,
      stage: "nationala",
      page: "2",
    });
    const returnPath = platformArchivePath({
      olympiadSubject: "informatica",
      grade: 9,
      stage: "nationala",
      year: "all",
      q: "",
      page: archive.page,
    });
    const [firstTask, secondTask] = archive.exams;

    render(
      <PlatformArchive
        olympiadSubject="informatica"
        grade={9}
        stage="nationala"
        page="2"
      />,
    );

    expect(firstTask.sessionLabel).not.toBe(secondTask.sessionLabel);
    expect(screen.getByText(firstTask.sessionLabel)).toBeInTheDocument();
    expect(screen.getByText(secondTask.sessionLabel)).toBeInTheDocument();

    const firstCard = screen.getByText(firstTask.sessionLabel).closest("article");
    expect(firstCard).not.toBeNull();
    expect(within(firstCard!).getByRole("link", { name: "Deschide proba" })).toHaveAttribute(
      "href",
      `/exam/${firstTask.id}?from=${encodeURIComponent(returnPath)}`,
    );
  });

  it("preserves the active grade in the class navigation", () => {
    render(<PlatformArchive olympiadSubject="informatica" grade={9} />);
    expect(screen.queryByRole("link", { name: "Clasa a 9-a" })).not.toBeInTheDocument();
    const clasa = screen.getByRole("navigation", { name: "Clase" });
    expect(within(clasa).getByRole("link", { name: "Clasa a 10-a" })).toHaveAttribute(
      "href",
      "/olimpiade/olimpiada-de-informatica?clasa=10",
    );
  });

  it("exposes a server form with all-years and all-stages controls", () => {
    const { container } = render(
      <PlatformArchive
        olympiadSubject="informatica"
        grade={9}
        stage="judeteana"
        year="2024"
        q="kilonova"
      />,
    );
    const form = container.querySelector("form");
    expect(form).not.toBeNull();
    const formScope = form as HTMLFormElement;
    expect(formScope.method).toBe("get");
    expect(formScope.querySelector("select[name=etapa]")).toHaveValue("judeteana");
    expect(formScope.querySelector("select[name=an]")).toHaveValue("2024");
    expect(formScope.querySelector("input[name=q]")).toHaveValue("kilonova");
    expect(screen.getByRole("option", { name: "Toți anii" })).toBeInTheDocument();
    expect(screen.getByRole("option", { name: "Toate etapele" })).toBeInTheDocument();
  });

  it("emits JSON-LD scoped to the current page only", () => {
    const { container } = render(
      <PlatformArchive olympiadSubject="informatica" grade={9} page="2" />,
    );
    const script = container.querySelector('script[type="application/ld+json"]');
    expect(script).not.toBeNull();
    const data = JSON.parse(script!.textContent ?? "{}");
    expect(data.mainEntity["@type"]).toBe("ItemList");
    const items = data.mainEntity.itemListElement as Array<{ position: number; name: string }>;
    expect(items.length).toBeLessThanOrEqual(48);
    const firstPosition = items[0]?.position ?? 0;
    expect(firstPosition).toBeGreaterThan(48);
  });
});
