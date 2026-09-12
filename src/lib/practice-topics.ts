/** Reviewed transcriptions of Subiectul I in the official Mate-Info models.
 * Source PDFs and point allocations are tested against the archive metadata.
 * This is deliberately a small curated collection, not an inferred full index.
 */
export const practiceTopics = [
  { id: "functii", title: "Funcții și grafice", item: 2 },
  { id: "logaritmi", title: "Ecuații logaritmice", item: 3 },
  { id: "numarare", title: "Numărare și probabilități", item: 4 },
  { id: "coordonate", title: "Geometrie în coordonate", item: 5 },
] as const;
export type PracticeTopic = typeof practiceTopics[number]["id"];
export type CuratedExercise = { id: string; topic: PracticeTopic; year: number; examId: string; reference: string; statement: string; rubric: string };
const entries: Array<[PracticeTopic, number, string, string]> = [
  ["functii", 2024, String.raw`Se consideră funcția $f:\mathbb R\to\mathbb R$, $f(x)=x^2+ax-a$, unde $a$ este număr real. Determinați numărul real $a$ pentru care punctul $A(3,-3)$ aparține graficului funcției $f$.`, String.raw`$f(3)=-3\Rightarrow 9+3a-a=-3$: **3p**. Rezultă $a=-6$: **2p**.`],
  ["functii", 2025, String.raw`Se consideră funcția $f:\mathbb R\to\mathbb R$, $f(x)=x^2-3x+5$. Determinați numerele reale $a$ pentru care punctul $A(a,5)$ aparține graficului funcției $f$.`, String.raw`$f(a)=5$, deci $a^2-3a=0$: **3p**. $a=0$ sau $a=3$: **2p**.`],
  ["functii", 2026, String.raw`Se consideră funcțiile $f:\mathbb R\to\mathbb R$, $f(x)=2x+1$ și $g:\mathbb R\to\mathbb R$, $g(x)=x+4$. Determinați numărul real $a$ pentru care $(f\circ g)(a)=-a$.`, String.raw`$g(a)=a+4$, $(f\circ g)(a)=2a+9$: **3p**. $2a+9=-a$, deci $a=-3$: **2p**.`],
  ["logaritmi", 2024, String.raw`Rezolvați în mulțimea numerelor reale ecuația $\log_2(x^2+8)=\log_2(8-2x)$.`, String.raw`$x^2+8=8-2x$, deci $x^2+2x=0$: **3p**. $x=-2$ sau $x=0$, ambele admise: **2p**.`],
  ["logaritmi", 2025, String.raw`Rezolvați în mulțimea numerelor reale ecuația $\log_6(7x-5)=\log_6(x+1)+\frac{1}{\log_x 6}$.`, String.raw`Pe domeniul de definiție ($x>5/7$, $x\ne1$), ecuația devine $\log_6(7x-5)=\log_6(x^2+x)$, deci $x^2-6x+5=0$: **3p**. $x=1$ nu convine, iar $x=5$ convine: **2p**.`],
  ["logaritmi", 2026, String.raw`Rezolvați în mulțimea numerelor reale ecuația $2\log_5 x=\log_5(4x+5)$.`, String.raw`$\log_5 x^2=\log_5(4x+5)$, deci $x^2-4x-5=0$: **2p**. $x=-1$ nu convine, iar $x=5$ convine: **3p**.`],
  ["numarare", 2024, String.raw`Determinați câte numere naturale de două cifre distincte, cu cifra zecilor pară, se pot forma cu elementele mulțimii $A=\{1,2,3,4,5\}$.`, String.raw`Cifra zecilor se alege în **2** moduri: **2p**. Pentru fiecare alegere există **4** cifre ale unităților, deci $2\cdot4=8$ numere: **3p**.`],
  ["numarare", 2025, String.raw`Calculați probabilitatea ca, alegând un număr din mulțimea numerelor naturale de două cifre, acesta să fie multiplu impar al lui $9$.`, String.raw`Există **90** de cazuri posibile: **2p**. Cazurile favorabile sunt $27,45,63,81,99$, deci $p=5/90=1/18$: **3p**.`],
  ["numarare", 2026, String.raw`Se consideră mulțimea $A=\{1,3,5,7,8\}$. Determinați câte numere naturale de două cifre distincte, cu cifra zecilor impară, se pot forma cu cifre din mulțimea $A$.`, String.raw`Cifra zecilor se alege în **4** moduri: **2p**. Pentru fiecare alegere există **4** cifre ale unităților, deci $4\cdot4=16$ numere: **3p**.`],
  ["coordonate", 2024, String.raw`În sistemul cartezian $xOy$ se consideră punctele $A(0,3)$ și $B(4,0)$. Determinați coordonatele punctului $C$ pentru care $\overrightarrow{OA}+\overrightarrow{OB}=\overrightarrow{OC}$.`, String.raw`$\overrightarrow{OA}=3\vec j$, $\overrightarrow{OB}=4\vec i$: **2p**. $\overrightarrow{OC}=4\vec i+3\vec j$, deci $C(4,3)$: **3p**.`],
  ["coordonate", 2025, String.raw`În reperul cartezian $xOy$ se consideră punctele $A(2,0)$, $B(2,4)$ și $C(5,a)$, unde $a$ este număr real. Determinați numărul real $a$, știind că dreptele $OB$ și $AC$ sunt paralele.`, String.raw`$m_{OB}=2$: **2p**. $m_{AC}=a/3$ și $m_{OB}=m_{AC}$, deci $a=6$: **3p**.`],
  ["coordonate", 2026, String.raw`În reperul cartezian $xOy$ se consideră punctele $A(0,5)$ și $B(3,4)$. Determinați coordonatele punctului $C$ pentru care $3\overrightarrow{OC}=\overrightarrow{OA}+\overrightarrow{OB}$.`, String.raw`$\overrightarrow{OA}=5\vec j$, $\overrightarrow{OB}=3\vec i+4\vec j$, deci suma este $3\vec i+9\vec j$: **3p**. $\overrightarrow{OC}=\vec i+3\vec j$, deci $C(1,3)$: **2p**.`],
];
export const curatedExercises: CuratedExercise[] = entries.map(([topic, year, statement, rubric]) => ({
  id: `mate-info-${year}-I-${practiceTopics.find((item) => item.id === topic)!.item}`, topic, year,
  examId: `bac-${year}-model-model-oficial`, reference: `Subiectul I · ${practiceTopics.find((item) => item.id === topic)!.item}`, statement, rubric,
}));
export function exercisesForTopic(topic: string) { return curatedExercises.filter((item) => item.topic === topic); }
