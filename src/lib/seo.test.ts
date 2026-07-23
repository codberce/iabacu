import { describe, expect, it } from "vitest";
import {
  absoluteUrl,
  bacExamTitle,
  createPageMetadata,
  currentBacYear,
  siteUrl,
  subjectSeo,
} from "@/lib/seo";
import type { Exam } from "@/lib/schemas";

describe("SEO URL generation", () => {
  it("uses a local default host for self-hosted installs", () => {
    expect(siteUrl).toBe("http://localhost:3000");
    expect(absoluteUrl("/istorie")).toBe("http://localhost:3000/istorie");
  });

  it("gives each page its own canonical URL", () => {
    const metadata = createPageMetadata({
      title: "Subiecte Bac Istorie",
      description: "Arhivă de subiecte și bareme.",
      path: "/istorie",
    });

    expect(metadata.alternates?.canonical).toBe("/istorie");
    expect(metadata.openGraph?.url).toBe("http://localhost:3000/istorie");
  });

  it("uses one concise title and subtitle pattern for every subject page", () => {
    const subjects = Object.values(subjectSeo);

    expect(subjects.every((subject) => subject.title.startsWith("Bac "))).toBe(true);
    expect(subjects.every((subject) => subject.title.endsWith(": subiecte și bareme"))).toBe(true);
    expect(subjects.every((subject) => !subject.title.includes(String(currentBacYear)))).toBe(true);
    expect(new Set(subjects.map((subject) => subject.description)).size).toBe(1);
    expect(subjects.every((subject) => subject.description.length <= 160)).toBe(true);
    expect(subjectSeo.logica.shortName).toBe("Logică");
  });

  it("keeps Bac result titles concise and translates internal profile names", () => {
    const exam = {
      subject: "matematica",
      year: 2026,
      sessionType: "model",
      profile: "M_mate-info",
    } as Exam;

    expect(bacExamTitle(exam, "subject")).toBe(
      "Subiect bac Matematică 2026 – model oficial (M1)",
    );
    expect(bacExamTitle(exam, "subject").length).toBeLessThanOrEqual(60);
  });
});
