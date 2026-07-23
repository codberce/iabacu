import type { Exam, GradeResult } from "@/lib/schemas";

export type GradeRuleInput = {
  exam: Exam;
  result: GradeResult;
  assessedItems: GradeResult["breakdown"];
  addReview: (reason: string) => void;
};

export type GradeRule = {
  subject: Exam["subject"];
  validate(input: GradeRuleInput): void;
};

function normalized(value: string) {
  return value
    .toLocaleLowerCase("ro")
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "");
}

function hasSubject(items: GradeResult["breakdown"], subject: "I" | "II" | "III") {
  return items.some((item) =>
    new RegExp(`subiect(?:ul)?\\s+${subject}\\b`, "i").test(normalized(item.section)),
  );
}

function requireSubjects(input: GradeRuleInput, message: string) {
  if (!(["I", "II", "III"] as const).every((subject) => hasSubject(input.assessedItems, subject))) {
    input.addReview(message);
  }
}

function genericRule(subject: Exam["subject"], label: string): GradeRule {
  return {
    subject,
    validate(input) {
      requireSubjects(input, `${label}: corectarea nu acoperă distinct Subiectele I, II și III.`);
    },
  };
}

const mathematicsRule: GradeRule = {
  subject: "matematica",
  validate(input) {
    requireSubjects(input, "Matematică: lipsesc unul sau mai multe dintre Subiectele I, II și III din defalcare.");
    if (input.assessedItems.length < 4) {
      input.addReview("Matematică: itemii sau subitemii nu sunt defalcați suficient pentru baremul oficial.");
    }
  },
};

const romanianRule: GradeRule = {
  subject: "romana",
  validate(input) {
    const labels = input.assessedItems.map((item) => normalized(`${item.section} ${item.item}`)).join(" ");
    if (!/subiect(?:ul)?\s+i/.test(labels) || !/subiect(?:ul)?\s+ii/.test(labels) || !/subiect(?:ul)?\s+iii/.test(labels)) {
      input.addReview("Română: lipsesc Subiectele I, II sau III din defalcare.");
    }
    if (!/(i\.?a|i\.?b|criteri|redact)/.test(labels)) {
      input.addReview("Română: criteriile de conținut și redactare trebuie identificate explicit.");
    }
  },
};

const informaticsRule: GradeRule = {
  subject: "informatica",
  validate(input) {
    requireSubjects(input, "Informatică: lipsesc Subiectele I, II sau III din defalcare.");
    const labels = input.assessedItems.map((item) => normalized(`${item.section} ${item.item} ${item.feedback}`)).join(" ");
    if (!/(algoritm|program|cod|fisier|iesire|output)/.test(labels)) {
      input.addReview("Informatică: corectarea trebuie să indice cerințele de algoritm, cod sau ieșire observabile.");
    }
  },
};

const physicsAreas = [
  { id: "A", pattern: /^(?:aria\s+)?a(?:\.|\s|-)|mecanic/ },
  { id: "B", pattern: /^(?:aria\s+)?b(?:\.|\s|-)|termodinamic/ },
  { id: "C", pattern: /^(?:aria\s+)?c(?:\.|\s|-)|curent(?:ul)?\s+continuu|electric/ },
  { id: "D", pattern: /^(?:aria\s+)?d(?:\.|\s|-)|optic/ },
] as const;

const physicsRule: GradeRule = {
  subject: "fizica",
  validate(input) {
    const coverage = new Map<string, Set<string>>();
    for (const item of input.assessedItems) {
      const area = physicsAreas.find(({ pattern }) => pattern.test(normalized(item.section)))?.id;
      const marker = normalized(item.section).match(/subiect(?:ul)?\s+(iii|ii|i)\b/)?.[1]?.toUpperCase();
      if (!area || !marker) continue;
      const subjects = coverage.get(area) ?? new Set<string>();
      subjects.add(marker);
      coverage.set(area, subjects);
    }
    if (coverage.size !== 2) input.addReview("La Fizică trebuie evaluate exact două arii tematice identificabile.");
    for (const [area, subjects] of coverage) {
      if (!(["I", "II", "III"] as const).every((subject) => subjects.has(subject))) {
        input.addReview(`Fizică: aria ${area} nu acoperă distinct Subiectele I, II și III.`);
      }
    }
  },
};

const rules = [
  mathematicsRule,
  romanianRule,
  informaticsRule,
  physicsRule,
  genericRule("istorie", "Istorie"),
  genericRule("biologie", "Biologie"),
  genericRule("chimie", "Chimie"),
  genericRule("geografie", "Geografie"),
  genericRule("logica", "Logică"),
  genericRule("psihologie", "Psihologie"),
  genericRule("sociologie", "Sociologie"),
  genericRule("economie", "Economie"),
  genericRule("filosofie", "Filosofie"),
] as const;

const ruleBySubject = new Map<Exam["subject"], GradeRule>(rules.map((rule) => [rule.subject, rule]));

export function gradingRuleForSubject(subject: Exam["subject"]): GradeRule {
  const rule = ruleBySubject.get(subject);
  if (!rule) throw new Error(`Nu există regulă de corectare pentru materia ${subject}.`);
  return rule;
}

export function validateSubjectGrade(input: GradeRuleInput) {
  gradingRuleForSubject(input.exam.subject).validate(input);
}
