# « Et moi, dans tout ça ? »

Explicatif **open source** du plan présenté dans le livre _« État partout, justice nulle part »_ (Barrat, Marle, Mitterrand — Éditions Chronique, 2026). Le site parle du plan avec ses propres mots, pour le faire comprendre. Il n'en est pas l'auteur : il n'est ni l'association Résolution ni les auteurs du livre, ne parle pas à leur place, et n'est affilié à aucune administration.

1. **Et moi ?** — en moins d'une minute, voir ce que le plan changerait pour _son_ foyer, en euros par mois, chaque euro relié à un amendement ou à une hypothèse déclarée.
2. **Comprendre** — parcourir les données du plan (dépenses publiques, agences, niches fiscales, calendrier…) en graphiques explorables, ramenés à l'échelle d'un foyer.

> **Outil indépendant de l'association Résolution et de l'État.**
> Données : france-resolution.fr, Insee, Eurostat, DGFiP.

Principes (détail : [`docs/VISION.md`](docs/VISION.md) §2) : un explicatif du plan, honnête (les perdants sont affichés) · tout chiffre a une source (et les désaccords entre sources sont montrés) · trois niveaux de preuve toujours distingués : « Proposé dans un amendement », « Annoncé », « Notre estimation » · 100 % côté client (tous les calculs se font dans le navigateur ; aucun cookie, traceur ni requête tierce) · accessible (WCAG 2.2 AA) · rapide sur mobile · identité visuelle propre (ni DSFR, ni Marianne, ni bleu-blanc-rouge).

## Démarrer

Prérequis : Node 22 (`.nvmrc`) et [pnpm](https://pnpm.io) 10.

```bash
pnpm install
pnpm dev            # http://localhost:4321 — le site (Astro)
pnpm build          # site statique dans site/dist/
pnpm preview        # sert site/dist/
```

| Commande         | Rôle                                                                       |
| ---------------- | -------------------------------------------------------------------------- |
| `pnpm test`      | tests unitaires : moteur (Vitest + fast-check) et site (format, contraste) |
| `pnpm test:e2e`  | Playwright + axe sur **chaque page du build** + zéro requête tierce        |
| `pnpm typecheck` | TypeScript strict (`tsc`) + `astro check`                                  |
| `pnpm lint`      | ESLint (flat config) + Prettier `--check`                                  |
| `pnpm format`    | Prettier `--write`                                                         |

`test:e2e` s'exécute sur le build : lancez `pnpm build` d'abord. Dans un environnement où Chromium est préinstallé (`/opt/pw-browsers/chromium`), il est utilisé automatiquement ; ailleurs : `pnpm --filter @epjn/site exec playwright install chromium`.

Variables d'environnement (build) :

- `BASE_PATH` — sous-chemin de publication, ex. `/etat-partout-justice-nulle-part/` pour GitHub Pages (défaut `/`).
- `SITE_URL` — origine absolue (ex. `https://user.github.io`), utilisée pour `canonical` et Open Graph.
- `ASTRO_TELEMETRY_DISABLED=1` — recommandé en CI.

## Organisation du dépôt

```
engine/     @epjn/engine — moteur de calcul en TypeScript pur (complet, 118 tests ; voir docs/ENGINE-API.md)
site/       Astro 6 (statique) + îlots React 19 + Tailwind CSS v4
  src/styles/     tokens.css (jetons de base) · brand-ci.css (l'identité livrée, polices) · global.css (Tailwind, base)
  src/lib/        format.ts (formatage français) · chart-theme.ts · tiers.ts · site.ts · contrast.ts · csv.ts
  src/components/ui/      primitives accessibles (StatTile, ChartFrame, NumberInput…)
  src/components/charts/  PlotFigure (Observable Plot) + exemple
  src/components/explorer/ explorateurs de /comprendre : niches, calendrier, amendements (barres HTML, frise, petits multiples)
  src/components/site/    en-tête, pied de page, bascule de thème, Todo…
  src/layouts/    BaseLayout, DashboardLayout
  src/pages/      pages (voir /styleguide pour le système de design en vrai)
  src/data/       JSON produits par le pipeline (ne pas éditer à la main)
  e2e/            Playwright : smoke + axe + zéro requête tierce
pipeline/   scripts Python : data/derived → site/src/data/*.json
data/ research/ scripts/ docs/   matériaux de départ, recherche, spécification
.github/workflows/   ci.yml (lint, types, tests, build, e2e) · deploy.yml (GitHub Pages)
```

## Système de design (en bref)

Un style sobre et factuel — un explicatif du plan, pas un site ministériel ni un tract. **Une seule identité** (`site/src/styles/brand-ci.css`), sans bascule. **Voir `/styleguide`** (noindex) pour tout, rendu avec les vrais composants.

- **Couleurs** : papier `#f3f1ea`, encre `#121614`, **un seul accent chaud** (le signal `#ff5a1f`, en aplats et en traits, jamais en texte sur papier), teal `#0f5e55` en second plan, paire divergente sûre pour le daltonisme (gain teal, perte orange-signal — jamais rouge/vert). Clair et sombre via `light-dark()` + `<html data-theme>`. Contrastes AA vérifiés par test (`pnpm --filter @epjn/site contrast`).
- **Niveaux de preuve** : « Proposé dans un amendement » (plein) · « Annoncé » (hachuré, tireté) · « Notre estimation » (pointillé). Jamais la couleur seule.
- **Polices** (auto-hébergées, `@fontsource`) : Schibsted Grotesk (texte, titres), JetBrains Mono (étiquettes, chiffres clés). Chiffres tabulaires pour les colonnes de montants (`num`).
- **Formatage** : tout nombre affiché passe par `src/lib/format.ts` (espace fine insécable, `1 234 €`, `+212 €`, `Md€`, reformulations par foyer / jour).
- **Graphiques** : `src/lib/chart-theme.ts` (palettes validées, réglages Observable Plot, formateurs français) + `ChartFrame` (résumé en clair, tableau, CSV, source).

Règle : pas de couleur, de taille ni de composant inventés dans une page — étendre les jetons.

## Licence

Code : [MIT](LICENSE) — © Contributeurs du projet « Et moi, dans tout ça ? ». Les données de tiers gardent leurs conditions (classeurs, amendements, fiches et manifeste de Résolution : aucune licence indiquée, cités avec attribution ; Insee et DGFiP : Licence Ouverte 2.0 ; Eurostat : CC BY 4.0) — voir la page « À propos » du site.

## Contribuer / signaler une erreur

Ouvrez une _issue_. Les hypothèses du simulateur sont publiées sur la page « Méthode » (source : `docs/METHODE.md`). Aucune page publiée ne contient de marqueur `TODO` : un test e2e le vérifie.

---

## In English

**« Et moi, dans tout ça ? »** ("And me, in all this?") is an open-source explainer for the plan in the French book _« État partout, justice nulle part »_. It speaks about the plan in its own words and lets a visitor see, in under a minute, what the plan would change for their own household (€/month, every euro traced to an amendment or a stated hypothesis), and explore the underlying public-finance data. It is not the plan's author.

**Independent of the association Résolution and of the French State, not their site and not speaking for them.** Every calculation runs client-side: no backend, no cookie, no tracker, no third-party request (enforced by an e2e test).

Stack: pnpm workspaces · Astro 6 (static) + React 19 islands · Tailwind CSS v4 · Observable Plot + d3 · TypeScript (strict) · Vitest + fast-check · Playwright + axe. Run `pnpm install && pnpm dev`; see the table above for test commands, and open `/styleguide` for the design system.
