# Importul olimpiadelor

`import-olympiads.mjs` este importatorul reproductibil, bazat pe catalog, pentru olimpiadele cu documente. Catalogul este `olympiad-sources.json`; el separă disciplinele, acoperirea declarată și adaptoarele surselor. O etapă fără sursă verificată rămâne explicit `unavailable`: absența nu este interpretată drept acoperire completă.

## Rulare

```sh
node scripts/import-olympiads.mjs
node scripts/import-olympiads.mjs --check-sources --subject=romana
node scripts/import-olympiads.mjs --apply
```

Rularea implicită validează catalogul și afișează planul, fără rețea și fără scrieri. `--check-sources` descarcă și clasifică în memorie, dar nu scrie. `--apply` descarcă, scrie activele și manifestul. Filtrele `--subject=<slug>` și `--source=<id>` limitează o rulare. Destinațiile pot fi schimbate cu `--manifest=...`, `--assets=...` și `--asset-base-url=...`.

Importul nu șterge fișiere existente. Sursele eșuate și cele indisponibile sunt păstrate în `sources`/`gaps`, cu motiv. Fișierele identice sunt stocate o singură dată după SHA-256; înregistrările semantic distincte rămân separate și sunt raportate în `duplicateContentGroups`.

## Contractul manifestului (versiunea 2)

La nivelul rădăcină:

- `version`, `catalogVersion`, `generatedAt`;
- `assetBaseUrl`: prefixul stabil peste care se adaugă `assetKey`;
- `coverage`: starea declarată pentru fiecare disciplină și etapă;
- `documents`, `assets`, `sources`, `gaps`, `duplicateContentGroups`.

Fiecare document are următorul contract stabil:

```json
{
  "id": "identificator-determinist",
  "olympiadSubject": "fizica",
  "stage": "judeteana",
  "year": 2026,
  "county": "București",
  "grade": 10,
  "kind": "subject",
  "title": "ONF X proba teoretica subiect",
  "sourceUrl": "https://...",
  "pairKey": "fizica:judeteana:2026:bucuresti:clasa-10:ro:onf-x-proba-teoretica",
  "language": "ro",
  "assetKey": "pdf/<sha256>.pdf",
  "sha256": "...",
  "size": 12345,
  "provenance": []
}
```

`county` și `grade` lipsesc când nu pot fi deduse fără ambiguitate. `kind` este `subject`, `solution` sau `combined`. `pairKey` elimină numai termenii de rol (subiect/barem/soluție) și clasa deja structurată; păstrează termeni precum `teoretica`, `practica`, `baraj` și identificatorii variantelor. Astfel, mai multe probe ori variante din aceeași clasă nu sunt colapsate. O sursă poate furniza explicit `pairKey` când denumirile fișierelor nu permit asocierea sigură.

`provenance` reține ID-ul sursei, pagina catalog, editorul și momentul descărcării. `legacyPdfPath` este rezervat migrărilor din manifestul vechi și nu este produs pentru activele noi.

## Adaptoare

- `direct`: PDF sau arhivă directă;
- `template`: produs cartezian de ani/clase peste un URL șablon;
- `html-links`: linkuri filtrate explicit dintr-o pagină-catalog;
- `html-paginated-search`: parcurge rezultatele paginate, verifică pagina fiecărui material și importă PDF-ul sursă;
- `unavailable`: gol verificat, cu motiv, fără trafic de rețea.

Arhivele ZIP/RAR/7z sunt extrase cu `7z`. PDF-urile sunt validate prin semnătură înainte de includere. Metadatele explicite din catalog au prioritate; anul, etapa, clasa, rolul, limba și județul sunt deduse numai când lipsesc.

Catalogul combină pachetele oficiale `subiecte.edu.ro` pentru etapa județeană 2026, arhiva istorică Olimpiade.ro și sursele SSMR/mate.info.ro deja folosite de integrarea matematicii. Manifestul păstrează rezultatul fiecărei surse, astfel încât golurile și fișierele indisponibile să rămână verificabile.

După import, include PDF-ul și textul extras în următoarea arhivă offline GitHub Release, sub cheile determinate de SHA-256. Actualizează apoi versiunea și sumele de control din `scripts/install-assets.mjs`.
