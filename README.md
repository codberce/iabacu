# iabacu

Arhivă locală cu subiecte și bareme pentru Bacalaureat, Evaluarea Națională și olimpiade.

## Pornește pe calculatorul tău

Ai nevoie de [Node.js LTS](https://nodejs.org/) 22 sau mai nou și de aproximativ **8 GB liberi**.

1. Descarcă pachetul pentru sistemul tău din
   [cea mai nouă versiune](https://github.com/codberce/iabacu/releases/latest):
   - `iabacu-windows-….zip` pentru Windows;
   - `iabacu-macos-….tar.gz` pentru macOS;
   - `iabacu-linux-….tar.gz` pentru Linux.
2. Dezarhivează fișierul.
3. Pornește:
   - **Windows:** dublu clic pe `start-windows.bat`;
   - **macOS:** dublu clic pe `start-macos.command`;
   - **Linux:** rulează `./start.sh`.

La prima pornire se descarcă arhiva completă de aproximativ 4,5 GB din
[GitHub Releases](https://github.com/codberce/iabacu/releases/tag/offline-assets-v1).
Descărcările întrerupte sunt reluate, iar fișierele lipsă sunt reparate automat.
Aplicația este compilată o singură dată, apoi se deschide
<http://localhost:3000> și toate PDF-urile sunt servite de pe calculatorul tău.

Progresul, notele și conversațiile se păstrează numai în browser. Nu sunt
necesare conturi, baze de date sau alte servicii.

## AI opțional

Copiază `.env.example` ca `.env.local` și completează URL-ul și modelul unui
furnizor compatibil OpenAI. Cheia poate rămâne goală pentru un model local:

```dotenv
AI_PROVIDER_API_URL=http://localhost:11434/v1/chat/completions
AI_PROVIDER_MODEL=modelul-tău
AI_PROVIDER_API_KEY=
```

## Pentru dezvoltare

```bash
npx --yes pnpm@11.3.0 install --frozen-lockfile
npx --yes pnpm@11.3.0 assets
npx --yes pnpm@11.3.0 dev
```

Verificări:

```bash
pnpm lint
pnpm test
pnpm build
pnpm assets:verify
```

Codul este disponibil sub licența [MIT](LICENSE). Documentele educaționale
oficiale își păstrează regimul propriu; vezi [THIRD_PARTY_CONTENT.md](THIRD_PARTY_CONTENT.md).

> Proiect independent, fără afiliere cu Ministerul Educației. Răspunsurile AI
> pot greși și nu înlocuiesc baremul oficial sau profesorul.
