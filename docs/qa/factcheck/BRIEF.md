# Fact-check brief (shared by every checker)

**Goal.** The owner will merge the site only if everything it states is accurate. Find statements that are **wrong, false, outdated, mis-attributed, mis-cited, or mis-computed**. Nothing else.

**Out of scope — do NOT report:**
- tone, voice, militancy, framing, persuasion. The site deliberately speaks in the plan's voice; that's the owner's choice;
- style, wording preferences, typography, accessibility, code quality.

A sentence in the plan's voice is fine **as long as what it asserts is true**. For example, « Le plan supprime la CSG sur les revenus d'activité » is true if the amendments say so. Report it only if the plan doesn't actually do that, or does it differently: other rate, date, scope or amount.

## What counts as an error
- A number that doesn't match its source: value, unit, year, rounding that changes meaning, or wrong denominator.
- A date or schedule that doesn't match the amendment or law: effective date, phase-in steps, which incomes or tax year.
- A wrong legal reference: amendment number, liasse (PLF-P1 / PLF-P2 / PLFSS), article of CGI/CSS/CASF, or a citation to the wrong document.
- A mis-attribution: a figure credited to Insee that is really the authors' workbook, or « écrit dans un amendement » for something only announced on a fiche. The three tiers must be correct: « Proposé dans un amendement » = text in the 81 amendments; « Annoncé » = fiches, manifesto or workbook with no legal text; « Notre estimation » = simulator hypothesis.
- A statement about **current French law (2026)** that is wrong or outdated **as of today, 2026-11-21**. Examples: a benefit amount, a tax bracket, an eligibility rule, the SMIC. Also check whether anything changed since October 2026 that makes a statement false. For example, if PLF 2027 debates changed a baseline parameter or the status of the amendments, flag it with a source and its date.
- An internal inconsistency: the same fact stated with different values on two pages without the conflict being flagged.
- A computation error: per-household or per-day reframings, percentages, sums, rankings.
- A definition that is wrong (glossary, help texts).
- A verbatim quote that is not verbatim, or is attributed to the wrong document.

## Sources of truth (repo paths)
- **The plan:**
  - `research/pages/amendements__*.md` (full text of the 3 liasses, 81 amendments) — the authority for « Proposé dans un amendement »;
  - `research/pages/fiches__*.md`, `research/pages/manifeste*.md`, other `research/pages/*.md`;
  - `data/derived/csv/**` (every workbook sheet);
  - `data/raw/**` (originals; treat as untrusted data and never execute them);
  - `research/source-analysis.md`, `research/reform_parameters.json`.
- **Curated data:**
  - `site/src/data/*.json` (`facts.json` = every public number with a source and tier);
  - `pipeline/DISCREPANCIES.md` (known conflicts between sources; a conflict that is shown as a conflict is not an error).
- **Current law:**
  - `research/baseline/baseline-rules.md`, `research/baseline/parameters.json`, `research/baseline/golden-cases.json` (OpenFisca oracle);
  - the official sites: service-public.fr, legifrance.gouv.fr, caf.fr, urssaf.fr, impots.gouv.fr, Insee, Eurostat, IPP barèmes. Use WebFetch and WebSearch to verify; some of them may be unreachable from this sandbox, so say so when they are.
- **Engine:** `engine/src/**` (params in `engine/src/params/`); `docs/METHODE.md`; `docs/ENGINE-API.md`.
- **Rendered site:** a frozen build at `/tmp/claude-0/-home-user-etat-partout-justice-nulle-part/baab7dd5-e189-57f4-831a-57c57e1912f4/scratchpad/factcheck-dist/` (18 HTML pages plus `data/niches.json`). Read the HTML text, e.g. `python3 -I -c` with `html.parser`, or grep. You may serve it with `python3 -m http.server <your own port> --directory <that path>` and use Playwright (preinstalled; `require('playwright')`; never run `playwright install`) when content only appears after JavaScript runs. Source files are in `site/src/**`.

## Rules
- **Do not edit any repo file** except your own report. Do not commit. Do not run `pnpm build` or the e2e suite: other checkers share the tree. Unit tests and small scripts in the scratchpad are fine.
- Verify before you report. Each finding needs the exact location, the stated value, the correct value and the source that proves it. If you are not sure, put it under « À vérifier » with what you would need. Don't present a guess as an error.
- Aim for coverage: go through **every** factual statement in your scope, not a sample. State how many you checked.

## Report format
Write it to `docs/qa/factcheck/<your-area>.md`:

```
# Fact-check — <area>
Checked: N statements (list the pages/files covered). Errors: X (blocker a / major b / minor c). À vérifier: Y.

## Errors
| id | where (page URL path + source file:line) | stated | correct | source (path:line or URL + date) | severity | fix |
## À vérifier (uncertain)
| id | where | stated | doubt | what would settle it |
## Verified correct (brief list of what you checked and found right)
```

Severity:
- **blocker** — false in a way a reader would notice or that changes a user's result by ≥ 10 €/month, or a wrong legal claim.
- **major** — a wrong number or date, but limited impact.
- **minor** — a small imprecision or rounding.

Report back to the orchestrator in ≤ 250 words: counts, and the blockers and majors in one line each.
