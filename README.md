# « Et moi, dans tout ça ? »

Compagnon **indépendant** et open source du livre _« État partout, justice nulle part »_ (Barrat, Marle, Mitterrand — Éditions Chronique, 2026).

1. **Et moi ?** — en moins d'une minute, voir ce que les propositions du livre changeraient pour _son_ foyer, en euros par mois, chaque euro relié à un amendement ou à une hypothèse déclarée.
2. **Comprendre** — parcourir les données du livre (dépenses publiques, agences, niches fiscales, calendrier…) en graphiques explorables, ramenés à l'échelle d'un foyer.

> **Outil indépendant, non affilié à l'association Résolution ni à l'État.**
> Données : france-resolution.fr, Insee, Eurostat, DGFiP.

Principes (détail : [`docs/VISION.md`](docs/VISION.md) §2) : fidèle _et_ honnête (les perdants sont affichés) · tout chiffre a une source · loi / annonce / hypothèse toujours distinguées · 100 % côté client (aucun cookie, traceur ni requête tierce) · accessible (WCAG 2.2 AA) · rapide sur mobile · identité visuelle propre (ni DSFR, ni Marianne, ni bleu-blanc-rouge).

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
  src/styles/     tokens.css (jetons, clair/sombre) · global.css (Tailwind, polices, base)
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

Édition calme et factuelle — un explicatif de rédaction, pas un site ministériel ni un tract. **Voir `/styleguide`** (noindex) pour tout, rendu avec les vrais composants.

- **Couleurs** : papier `#faf8f4`, encre `#15171c`, **un seul accent** « le plan » (violet `#602e9d`), paire divergente sûre pour le daltonisme (gain bleu-vert `#00737a`, perte orange-vermillon `#bc3f06` — jamais rouge/vert). Clair et sombre via `light-dark()` + `<html data-theme>`. Contrastes AA vérifiés par test (`pnpm --filter @epjn/site contrast`).
- **Niveaux de preuve** : « Écrit dans la loi » (plein) · « Annoncé par les auteurs » (hachuré, tireté) · « Hypothèse du simulateur » (pointillé). Jamais la couleur seule.
- **Polices** (auto-hébergées, `@fontsource`) : Fraunces (titres, grands chiffres), Inter (interface). Chiffres tabulaires pour les colonnes de montants (`num`).
- **Formatage** : tout nombre affiché passe par `src/lib/format.ts` (espace fine insécable, `1 234 €`, `+212 €`, `Md€`, reformulations par foyer / jour).
- **Graphiques** : `src/lib/chart-theme.ts` (palettes validées, réglages Observable Plot, formateurs français) + `ChartFrame` (résumé en clair, tableau, CSV, source).

Règle : pas de couleur, de taille ni de composant inventés dans une page — étendre les jetons.

## Licence

Code : [MIT](LICENSE) — © Contributeurs du projet « Et moi, dans tout ça ? ». Les données de tiers gardent leurs conditions (classeurs et amendements de Résolution : aucune licence indiquée, cités avec attribution ; Insee et DGFiP : Licence Ouverte 2.0 ; Eurostat : CC BY 4.0) — voir la page « À propos » du site.

## Contribuer / signaler une erreur

Ouvrez une _issue_. Les hypothèses du simulateur sont publiées sur la page « Méthode » (source : `docs/METHODE.md`). Aucune page publiée ne contient de marqueur `TODO` : un test e2e le vérifie.

---

## In English

**« Et moi, dans tout ça ? »** ("And me, in all this?") is an independent, open-source companion to the French book _« État partout, justice nulle part »_. It lets a visitor see, in under a minute, what the book's proposals would change for their own household (€/month, every euro traced to an amendment or a stated hypothesis), and explore the underlying public-finance data.

**Independent — not affiliated with the association Résolution or with the French State.** Fully client-side: no backend, no cookie, no tracker, no third-party request (enforced by an e2e test).

Stack: pnpm workspaces · Astro 6 (static) + React 19 islands · Tailwind CSS v4 · Observable Plot + d3 · TypeScript (strict) · Vitest + fast-check · Playwright + axe. Run `pnpm install && pnpm dev`; see the table above for test commands, and open `/styleguide` for the design system.
