import { writeFile } from "node:fs/promises";
import path from "node:path";

const categories = [
  "romana", "matematica", "istorie", "anatomie", "biologie", "chimie",
  "fizica", "geografie", "informatica", "logica", "psihologie",
  "sociologie", "economie", "filosofie",
];

const sessionTypes = {
  0: "final", 1: "autumn", 2: "special", 3: "simulation", 4: "model",
};

// The upstream record has a malformed barem object path and consistently
// returns 404. Keep incomplete pairs out of the user-facing archive until the
// source publishes a valid document.
const excludedIncompleteRecords = new Set(["romana:275"]);

const slugify = (value) => value.normalize("NFD").replace(/[\u0300-\u036f]/g, "")
  .toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");

for (const category of categories) {
  const response = await fetch(`https://api.arhivabac.com/exams/examCategories/${category}`);
  if (!response.ok) {
    console.warn(`Skipping ${category}: ${response.status}`);
    continue;
  }
  const data = await response.json();
  const rows = Object.values(data.exams)
    .flatMap((sessions) => Object.values(sessions).flat())
    .filter((item) => !excludedIncompleteRecords.has(`${category}:${item.examID}`));
  const exams = rows.map((item, order) => {
    const profile = item.specialization?.label || "General";
    const id = `archive-${category}-${item.examID}`;
    return {
      id,
      subject: category,
      year: item.year,
      order,
      profile,
      language: "LRO",
      sessionType: sessionTypes[item.session.sessionType] || "final",
      sessionLabel: item.session.sessionName,
      dateLabel: String(item.year),
      title: `${item.session.sessionName} ${item.year} · ${profile}`,
      examPdfPath: `/api/archive-pdf/${item.examID}/subject.pdf`,
      baremPdfPath: `/api/archive-pdf/${item.examID}/barem.pdf`,
      contextPath: `src/data/exam-text/archive/${id}.json`,
      sourceKind: "vetted-mirror",
      sourceUrl: `https://www.arhivabac.com/subiecte-bac/${category}/${item.examID}-${item.slug}`,
      baremSourceUrl: `https://www.arhivabac.com/subiecte-bac/${category}/${item.examID}-${item.slug}#barem`,
      sha256: { exam: "0".repeat(64), barem: "0".repeat(64) },
    };
  });
  const target = path.resolve(`src/data/archive-${slugify(category)}.json`);
  await writeFile(target, `${JSON.stringify(exams, null, 2)}\n`);
  console.log(`${category}: ${exams.length}`);
}
