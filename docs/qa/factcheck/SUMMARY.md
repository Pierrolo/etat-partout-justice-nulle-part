# Fact-check — summary for the merge decision (2026-11-21)

## What was checked
- **Round 1 (October version):** 8 checkers, 3 Opus and 5 Sonnet, worked on a frozen build.
  - Scope: ≈ 4 900 data points and ≈ 2 900 statements.
  - Areas: current law 2026, plan rules, the authors' figures, public statistics, story pages, explorers (465 niches, calendar, 81 amendments), questionnaire, situations, glossary, simulator, Méthode, À propos.
  - Method: an Opus verifier then tried to disprove every non-plan finding before any change. 25 were confirmed and 2 rejected. 2 proposed "fixes" were themselves wrong and were not applied.
- **The authors republished their material** on 17–18 Nov 2026 (`research/DIFF-2026-10-to-2026-11.md`). There are now 84 amendments (37 changed, 3 new). The biggest change: PLF-P1 n° 28 now **reduces** the universal aid by 3 300 €/year per pensioner instead of increasing it. The whole site was rebased on that version (engine v1.2.0, pipeline on `data/derived-2026-11-21/`).
- **Round 2 (November version):** 3 checkers, 1 Opus and 2 Sonnet, worked on the rebuilt site.
  - Scope: ≈ 6 400 values and statements.
  - Results: all 84 amendments with their PDF page, the état B tables to the euro, 109 calendar events, 237 workbook cells, every quote and calcul, the pension rule, the book's own worked examples. Of the 80 round-1 errors, 70 were fixed, 5 superseded and 5 re-fixed.
- **Final round-2 fixes:**
  - the scope of the n° 26 indemnity;
  - the n° 27 versement de patrimoine;
  - ~50 niches reclassified against Am. 1 III / III bis / IV;
  - 29 broken source links;
  - today's DMTO (≈ 12 640 € on 200 000 €);
  - the bouclier floor per household;
  - the PLFSS n° 9 CSG on capital income;
  - new conflicts D40 and D41 documented.

All reports, with file:line and sources, are in this folder.

## Known open points (not errors, but worth knowing)
- **SMIC:** +1,6 % announced on 9 Nov for 1 Dec 2026; the decree was not published as of 21 Nov. The site uses 12,31 €/h, which is correct today, and /methode carries a dated note. **Update on 1 Dec** once the decree is out.
- **Plan version:** the site follows the amendments « publiés les 17 et 18 novembre 2026 ». If the authors republish again, re-run `scripts/recrawl_site.py` and the diff, then rebase.
- **Conflicts inside the authors' own material** are shown, not resolved (`pipeline/DISCREPANCIES.md`, /methode):
  - GraphAFU vs n° 28 (D38);
  - niche text vs workbook (D40, 37 niches);
  - who pays the DMTO (D41);
  - the 4 vs 5 taxes.
- **Inferences, labelled as such:** niches 110203 and 60203; the pension pro-rata default (172 quarters) when the user leaves the field empty.
- **Omissions left (not errors):** two dated entries could be added to the amendments list, n° 32 (1 Jan 2027) and n° 31 (1 Jan 2028).
- **Sources unreachable from the sandbox:** Légifrance (403) and caf.fr. A few values were confirmed through service-public.fr, BOFiP, OpenFisca or press reports of the decree instead, as noted in each report.
