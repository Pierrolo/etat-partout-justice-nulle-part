import { readFileSync } from 'node:fs';
import { expect, test, type Page } from '@playwright/test';

/**
 * Pages « Comprendre » interactives : niches, amendements, calendrier, à propos.
 * (L'accessibilité axe de chaque page et le reflow à 320 px sont couverts par smoke.spec.ts.)
 */

async function hydrated(page: Page, component: string) {
  await page.waitForSelector(`astro-island[component-url*="${component}"]:not([ssr])`);
}

test.describe('/comprendre/niches', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('comprendre/niches/');
    await hydrated(page, 'NichesExplorer');
    await page.waitForLoadState('networkidle');
  });

  const rows = (page: Page) => page.locator('[data-testid=niches-table] tbody tr');
  const summary = (page: Page) => page.getByTestId('niches-summary');

  test('affiche les chiffres clés et explique les totaux en conflit', async ({ page }) => {
    await expect(page.getByRole('heading', { level: 1 })).toContainText('465 niches fiscales');
    await expect(page.getByRole('heading', { name: 'Quel total retenir ?' })).toBeVisible();
    const main = page.locator('main');
    for (const total of ['89,4', '134,7', '143']) await expect(main).toContainText(`${total} Md€`);
    await expect(summary(page)).toContainText('465 niches');
  });

  test('la recherche ignore les accents et la casse, et l’URL garde le filtre', async ({
    page,
  }) => {
    const box = page.getByRole('searchbox', { name: 'Rechercher une niche' });
    await box.fill('CREDIT impot recherche');
    await expect(summary(page)).toContainText(/^\d+ niches?/);
    await expect(rows(page).first()).toContainText('Crédit d’impôt en faveur de la recherche');
    const accented = await summary(page).innerText();
    await box.fill('Crédit d’impôt recherche');
    await expect(summary(page)).toHaveText(accented);
    await expect.poll(() => page.evaluate(() => location.hash)).toContain('q=');
    await box.fill('zzzzqqqq');
    await expect(page.getByText('Aucune niche ne correspond')).toBeVisible();
    await page.getByRole('button', { name: 'réinitialisez tout' }).click();
    await expect(summary(page)).toContainText('465 niches');
  });

  test('les filtres par catégorie, impôt et « ménages » se combinent', async ({ page }) => {
    const chip = page.getByRole('button', { name: /^Entreprises/ });
    await chip.click();
    await expect(chip).toHaveAttribute('aria-pressed', 'true');
    await expect(summary(page)).toContainText('166 niches');
    const menages = page.getByRole('button', { name: /^Ménages/ });
    await menages.click();
    await expect(summary(page)).toContainText('281 niches'); // 166 + 115 (OU dans un groupe)
    await chip.click();
    await expect(summary(page)).toContainText('115 niches');
    await menages.click(); // catégorie « Ménages » ∩ switch : testé plus bas, ici on repart de zéro
    const toggle = page.getByRole('switch', { name: /Concerne souvent les ménages/ });
    await page.locator('label', { hasText: 'Concerne souvent les ménages' }).click();
    await expect(toggle).toBeChecked();
    await expect(summary(page)).toContainText('47 niches');
    // impôt : ET entre groupes
    await page.getByText('Plus de filtres').click();
    await page.getByRole('button', { name: /^Impôt sur le revenu\b(?! et)/ }).click();
    const n = await summary(page).innerText();
    expect(Number(/^(\d+)/.exec(n)![1])).toBeLessThan(47); // ET : moins que les 47 niches « ménages »
    await page.getByRole('button', { name: 'Réinitialiser les filtres' }).click();
    await expect(summary(page)).toContainText('465 niches');
  });

  test('un coût manquant est « non chiffré », jamais zéro', async ({ page }) => {
    await page.getByRole('searchbox', { name: 'Rechercher une niche' }).fill('40109');
    await expect(summary(page)).toContainText('hors 1 non chiffrée');
    const row = rows(page).filter({ hasText: 'non chiffré' });
    await expect(row).toHaveCount(1);
    await expect(row).toContainText('moins de 0,5 M€, non calculé'); // le motif, pas un zéro
    await expect(row).not.toContainText(/\b0\s*M€/);
  });

  test('le tri par coût est annoncé (aria-sort) et met les non chiffrées en dernier', async ({
    page,
  }) => {
    const cost = page.getByRole('columnheader', { name: /^Coût 2024/ });
    await expect(cost).toHaveAttribute('aria-sort', 'descending');
    await expect(rows(page).first()).toContainText('Crédit d’impôt en faveur de la recherche');
    await cost.getByRole('button').click();
    await expect(cost).toHaveAttribute('aria-sort', 'ascending');
    await expect(rows(page).first()).not.toContainText('en faveur de la recherche');
    await page
      .getByRole('columnheader', { name: /^Niche/ })
      .getByRole('button')
      .click();
    await expect(page.getByRole('columnheader', { name: /^Niche/ })).toHaveAttribute(
      'aria-sort',
      'ascending',
    );
  });

  test('pagination : 25 lignes par page, page suivante, état restauré depuis l’adresse', async ({
    page,
  }) => {
    await expect(rows(page)).toHaveCount(25);
    await page.getByRole('button', { name: 'Suivant' }).click();
    await expect(
      page.getByRole('navigation', { name: /Pagination/ }).getByText(/Page\s*2\s*sur/),
    ).toBeVisible();
    await expect.poll(() => page.evaluate(() => location.hash)).toContain('page=2');
    // lien partagé : filtres et page rétablis
    await page.goto('comprendre/niches/#cat=epargne&tri=nom&sens=asc');
    await hydrated(page, 'NichesExplorer');
    await expect(summary(page)).toContainText('22 niches');
    await expect(page.getByRole('button', { name: /^Épargne/ })).toHaveAttribute(
      'aria-pressed',
      'true',
    );
  });

  test('la sélection se télécharge en CSV ; un lien d’ancre ne réinitialise pas les filtres', async ({
    page,
  }) => {
    await page.getByRole('searchbox', { name: 'Rechercher une niche' }).fill('garde enfants');
    await expect(summary(page)).toContainText('3 niches');
    // un lien d'ancre de la page (#liste) ne doit pas effacer la recherche
    await page.getByRole('link', { name: /Aller directement à la liste/ }).click();
    await expect(summary(page)).toContainText('3 niches');
    const [download] = await Promise.all([
      page.waitForEvent('download'),
      page.getByRole('button', { name: 'Télécharger la sélection (CSV)' }).click(),
    ]);
    const csv = readFileSync(await download.path(), 'utf8');
    const lines = csv.trim().split(/\r?\n/);
    expect(lines).toHaveLength(1 + 3);
    expect(lines[0]).toContain('cout_2024_meur');
    expect(csv).toContain('Crédit d’impôt pour frais de garde');
  });

  test('chaque ligne a sa référence légale, son effet et un lien vers l’amendement', async ({
    page,
  }) => {
    const first = rows(page).first();
    await expect(first).toContainText('Réf. :');
    await expect(first.getByRole('link', { name: 'Amendement n° 1' }).first()).toHaveAttribute(
      'href',
      /comprendre\/amendements\/#PLF-P1-1$/,
    );
  });
});

test.describe('/comprendre/amendements', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('comprendre/amendements/');
    await hydrated(page, 'AmendementsExplorer');
  });

  const summary = (page: Page) => page.getByTestId('amendements-summary');

  test('dit clairement que ce sont des textes proposés, pas des lois', async ({ page }) => {
    await expect(page.getByText('Amendements rédigés, en attente de dépôt')).toBeVisible();
    await expect(page.getByText(/attendent d’être déposés, puis votés/)).toBeVisible();
    await expect(
      page.getByText(/texte rédigé, en attente de dépôt et de vote/i).first(),
    ).toBeVisible();
    await expect(summary(page)).toContainText('81 amendements');
  });

  test('la recherche trouve un amendement sans tenir compte des accents', async ({ page }) => {
    const box = page.getByRole('searchbox', { name: 'Rechercher un amendement' });
    await box.fill('TITRES restaurant');
    await expect(summary(page)).toContainText('1 amendement sur 81');
    const card = page.locator('article#PLF-P1-2');
    await expect(card).toBeVisible();
    await expect(card).toContainText('Titres-restaurant');
    await expect(card.getByText('Proposé dans un amendement')).toBeVisible();
    await expect(card.getByRole('link', { name: /Lire le texte/ })).toHaveAttribute(
      'href',
      /Liasse_PLF_P1\.pdf#page=\d+/,
    );
    await expect.poll(() => page.evaluate(() => location.hash)).toContain('q=');
    await box.fill('zzzzqqqq');
    await expect(page.getByText('Aucun amendement ne correspond')).toBeVisible();
  });

  test('regroupe par liasse puis par thème et filtre par liasse', async ({ page }) => {
    await expect(
      page.getByRole('heading', { level: 3, name: /PLF 2027, première partie/ }),
    ).toBeVisible();
    await expect(page.locator('article')).toHaveCount(81);
    await page.getByRole('button', { name: /^PLFSS 2027/ }).click();
    await expect(summary(page)).toContainText('8 amendements sur 81');
    await page.getByRole('button', { name: 'Réinitialiser les filtres' }).click();
    await page.getByRole('radio', { name: 'Thème', exact: true }).check({ force: true });
    await expect(
      page.getByRole('heading', { level: 3, name: /Crédits de l.État retirés/ }),
    ).toBeVisible();
    await page.locator('#am-theme').selectOption('credits_etat');
    await expect(summary(page)).toContainText('22 amendements sur 81');
  });

  test('le graphique des crédits retirés se déplie sur les programmes', async ({ page }) => {
    const list = page.getByRole('list', { name: /Crédits retirés par mission/ });
    await expect(list.locator('> li')).toHaveCount(22);
    const first = list.locator('> li').first();
    await expect(first).toContainText('Cohésion des territoires');
    await first.locator('summary').click();
    await expect(first.getByText('Aide à l’accès au logement')).toBeVisible();
    await expect(first.getByRole('link', { name: /Amendement PLF-P2 n° 1$/ })).toHaveAttribute(
      'href',
      /#PLF-P2-1$/,
    );
  });
});

test.describe('/comprendre/calendrier', () => {
  test('filtre par domaine, sans marqueur « aujourd’hui »', async ({ page }) => {
    await page.goto('comprendre/calendrier/');
    await hydrated(page, 'CalendrierExplorer');
    await expect(page.getByText(/104 mesures affichées sur 104/)).toBeVisible();
    await page.getByRole('button', { name: /^Collectivités/ }).click();
    await expect(page.getByText(/11 mesures affichées sur 104/)).toBeVisible();
    await expect(page.locator('main')).not.toContainText(/aujourd[’']hui/i);
    await page.getByRole('button', { name: 'Tous les domaines' }).click();
    await expect(page.getByText(/104 mesures affichées/)).toBeVisible();
  });

  test('chaque mesure renvoie à son amendement ; une date clé ouvre son groupe', async ({
    page,
  }) => {
    await page.goto('comprendre/calendrier/');
    await hydrated(page, 'CalendrierExplorer');
    await page.getByRole('link', { name: /Date clé 3 : 1er juillet 2027/ }).click();
    const group = page.locator('details#d-2027-07-01');
    await expect(group).toHaveAttribute('open', '');
    await expect(group.getByRole('link', { name: /^PLF-P1 n° \d+/ }).first()).toHaveAttribute(
      'href',
      /comprendre\/amendements\/#PLF-P1-\d+$/,
    );
  });

  test('un lien profond #d-AAAA-MM-JJ ouvre le groupe de cette date', async ({ page }) => {
    await page.goto('comprendre/calendrier/#d-2027-07-01');
    await hydrated(page, 'CalendrierExplorer');
    await expect(page.locator('details#d-2027-07-01')).toHaveAttribute('open', '');
    await expect(page.locator('details#d-2027-07-01')).toBeInViewport();
  });

  test('frise (écrans larges) : une pastille ouvre le détail de la date', async ({
    page,
    isMobile,
  }) => {
    test.skip(
      isMobile,
      'la frise horizontale est réservée aux écrans larges ; la liste verticale la remplace',
    );
    await page.goto('comprendre/calendrier/');
    await hydrated(page, 'CalendrierExplorer');
    const marker = page.getByRole('button', { name: /^1er juillet 2028 — TVA/ });
    await marker.click();
    await expect(marker).toHaveAttribute('aria-pressed', 'true');
    await expect(page.getByRole('heading', { level: 3, name: /1er juillet 2028/ })).toBeVisible();
  });

  test('les trajectoires se lisent aux flèches du clavier', async ({ page }) => {
    await page.goto('comprendre/calendrier/');
    await page.waitForLoadState('networkidle');
    const csg = page.getByRole('group', { name: /^CSG et CRDS sur les revenus d’activité/ });
    await csg.scrollIntoViewIfNeeded();
    await hydrated(page, 'StepCharts'); // îlot « client:visible » : prêt une fois le graphique à l'écran
    await csg.focus();
    await page.keyboard.press('Home');
    await expect(page.getByText(/1er janvier 2027\s: 9,7\spt/)).toBeVisible();
    await page.keyboard.press('ArrowRight');
    await expect(page.getByText(/1er juillet 2027\s: 8,1\spt/)).toBeVisible();
  });
});

test.describe('/a-propos', () => {
  test('indépendance, licence MIT, sources, vie privée et contact', async ({ page }) => {
    await page.goto('a-propos/');
    const main = page.locator('main');
    await expect(main).toContainText('indépendant de l’association Résolution');
    await expect(main).toContainText('licence MIT');
    await expect(main).toContainText('Licence Ouverte');
    await expect(main).toContainText('CC BY 4.0');
    await expect(main).toContainText('Aucun cookie');
    await expect(page.getByRole('link', { name: /suivi du dépôt/ })).toHaveAttribute(
      'href',
      /\/issues$/,
    );
    await expect(page.getByRole('table', { name: /Conditions de réutilisation/ })).toBeVisible();
  });
});
