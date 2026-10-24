/**
 * Site-wide constants: names, navigation, page registry and URL helpers.
 * Keep copy here (not in components) when it appears on more than one page.
 */

export const SITE = {
  name: 'Et moi, dans tout ça ?',
  /** Used in <title> suffix. */
  titleSuffix: 'Et moi, dans tout ça ?',
  description:
    'Compagnon indépendant du livre « État partout, justice nulle part » : voyez ce que le plan changerait pour votre foyer, et où va l’argent public.',
  locale: 'fr_FR',
  independence: 'Outil indépendant, non affilié à l’association Résolution ni à l’État.',
  dataSources: 'Données : france-resolution.fr, Insee, Eurostat, DGFiP.',
} as const;

export interface NavItem {
  label: string;
  href: string;
}

/** Primary navigation (header). Hrefs are site-relative, with trailing slash; pass through `withBase`. */
export const NAV: NavItem[] = [
  { label: 'Simulateur', href: '/simulateur/' },
  { label: 'Comprendre', href: '/comprendre/' },
  { label: 'Méthode', href: '/methode/' },
  { label: 'À propos', href: '/a-propos/' },
];

export interface DashboardPage {
  slug: string;
  href: string;
  title: string;
  /** Card label on the hub, ≤ 60 characters. */
  teaser: string;
}

/** The dashboard pages of docs/VISION.md §4 (hub cards, sub-navigation, prev/next). */
export const COMPRENDRE_PAGES: DashboardPage[] = [
  {
    slug: 'depenses',
    href: '/comprendre/depenses/',
    title: 'Où va l’argent public ?',
    teaser: 'Les dépenses publiques par grande fonction, ramenées à votre foyer.',
  },
  {
    slug: 'europe',
    href: '/comprendre/europe/',
    title: 'La France face à l’Europe',
    teaser: 'Dépenses, déficit, revenu médian : la France comparée à ses voisins.',
  },
  {
    slug: 'etat-partout',
    href: '/comprendre/etat-partout/',
    title: 'L’État partout',
    teaser: 'Ministères, agences, impôts, niches, formulaires, mots de loi.',
  },
  {
    slug: 'le-plan',
    href: '/comprendre/le-plan/',
    title: 'Le plan en un schéma',
    teaser: 'D’où viennent les économies, où elles vont : salaire net et épargne.',
  },
  {
    slug: 'niches',
    href: '/comprendre/niches/',
    title: 'Explorer les niches fiscales',
    teaser: 'Cherchez, triez par coût, repérez celles qui vous concernent.',
  },
  {
    slug: 'agences',
    href: '/comprendre/agences/',
    title: 'Le sort des agences',
    teaser: 'Que deviennent les agences de l’État ? Une liste consultable.',
  },
  {
    slug: 'calendrier',
    href: '/comprendre/calendrier/',
    title: 'La transition 2027 → 2030',
    teaser: 'Chaque mesure datée, sur une frise.',
  },
  {
    slug: 'amendements',
    href: '/comprendre/amendements/',
    title: 'Les amendements, par thème',
    teaser: 'Les textes de loi proposés, classés par sujet et consultables.',
  },
];

/** Prefix a site-relative path ("/simulateur/") with the configured base ("/repo-name/"). */
export function withBase(path: string): string {
  const base = import.meta.env.BASE_URL ?? '/';
  if (/^([a-z][a-z0-9+.-]*:|#|\/\/)/i.test(path)) return path; // absolute URL or fragment
  const b = base.endsWith('/') ? base : `${base}/`;
  return `${b}${path.replace(/^\//, '')}`;
}

/** True when `current` (a pathname) is the page `href` or below it. */
export function isCurrent(current: string, href: string): boolean {
  const cur = current.replace(/\/+$/, '') + '/';
  const target = withBase(href).replace(/\/+$/, '') + '/';
  return cur === target || (href !== '/' && cur.startsWith(target));
}
