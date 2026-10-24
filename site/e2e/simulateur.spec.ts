import AxeBuilder from '@axe-core/playwright';
import { expect, test, type Locator, type Page } from '@playwright/test';

/**
 * The simulator, end to end, after the user tests: nothing before answering, persona flows, the three-layer
 * result, shared links with their recap, the « Marc » regression (a field showing 1 400 while the calculation
 * used 1 478), the 820 px waterfall header, and « Qui gagne, qui perd ? ».
 * Written against the UI contract (labels, roles, test ids), not against numbers.
 */

const isMobile = (page: Page) => (page.viewportSize()?.width ?? 1280) < 640;
const labelOf = (input: Locator) => input.locator('xpath=ancestor::label[1]');
const radio = (scope: Page | Locator, name: string | RegExp) =>
  labelOf(
    scope.getByRole('radio', typeof name === 'string' ? { name, exact: true } : { name }),
  ).click();
const field = (page: Page, key: string) => page.locator(`[data-field="${key}"]`);
const figure = (page: Page) => page.getByTestId('headline-figure');
const settle = (page: Page) => page.waitForTimeout(500);

async function next(page: Page) {
  if (isMobile(page)) await page.getByRole('button', { name: 'Suivant', exact: true }).click();
}

interface AdultSpec {
  age: number;
  activity: string;
  status?: string;
  salary?: number;
  pension?: number;
  disability?: string;
}
interface Persona {
  couple: string | RegExp;
  married?: string;
  children?: number[];
  childcare?: string;
  childSupport?: { answer: string; amount?: number };
  adults: AdultSpec[];
  housing: string;
  rent?: number;
  zone?: string;
}

const CADRE = 'Salarié du privé, cadre';
const PRIVE = 'Salarié du privé, non-cadre';
const FONCT = 'Fonctionnaire (école, hôpital, mairie…)';
const DIRIGEANT = 'Dirigeant·e de SAS/SARL (assimilé salarié)';
const TNS = 'Indépendant / gérant majoritaire (TNS)';

const PERSONAS: Record<string, Persona> = {
  nadia: {
    couple: 'En couple',
    married: 'Non',
    children: [12],
    adults: [
      { age: 41, activity: 'En emploi', status: PRIVE, salary: 1427 },
      { age: 43, activity: 'En emploi', status: PRIVE, salary: 1700 },
    ],
    housing: 'Locataire',
    rent: 480,
    zone: 'Zone 2',
  },
  josiane: {
    couple: /^Seul/,
    adults: [{ age: 74, activity: 'À la retraite', pension: 980 }],
    housing: 'Propriétaire, sans crédit',
  },
  thomas: {
    couple: 'En couple',
    married: 'Oui',
    children: [7, 3],
    childcare: 'Assistante maternelle',
    adults: [
      { age: 38, activity: 'En emploi', status: CADRE, salary: 4800 },
      { age: 37, activity: 'En emploi', status: PRIVE, salary: 2300 },
    ],
    housing: 'Propriétaire, avec crédit',
  },
  samir: {
    couple: 'En couple',
    married: 'Oui',
    children: [5],
    adults: [
      { age: 40, activity: 'En emploi', status: DIRIGEANT, salary: 3000 },
      { age: 38, activity: 'En emploi', status: FONCT, salary: 2100 },
    ],
    housing: 'Locataire',
    rent: 1050,
    zone: 'Zone 2',
  },
  camille: {
    couple: /^Seul/,
    adults: [{ age: 29, activity: 'En emploi', status: FONCT, salary: 2050 }],
    housing: 'Locataire',
    rent: 900,
    zone: 'Zone 1',
  },
  loneParent: {
    couple: /^Seul/,
    children: [9],
    childSupport: { answer: 'Oui', amount: 200 },
    adults: [{ age: 36, activity: 'En emploi', status: PRIVE, salary: 1600 }],
    housing: 'Locataire',
    rent: 560,
    zone: 'Zone 3',
  },
  handicap: {
    couple: /^Seul/,
    adults: [
      { age: 45, activity: 'Autre situation, sans revenu', disability: 'Oui, taux de 50 à 79 %' },
    ],
    housing: 'Locataire',
    rent: 450,
    zone: 'Zone 2',
  },
  jeune: {
    couple: /^Seul/,
    adults: [{ age: 22, activity: 'Autre situation, sans revenu' }],
    housing: 'Hébergé·e gratuitement',
  },
  tns: {
    couple: /^Seul/,
    adults: [{ age: 45, activity: 'En emploi', status: TNS }],
    housing: 'Locataire',
    rent: 700,
    zone: 'Zone 2',
  },
};

async function fillPersona(page: Page, p: Persona, opts: { finish?: boolean } = {}) {
  await radio(field(page, 'foyer.couple'), p.couple);
  if (p.married) await radio(field(page, 'foyer.married'), p.married);
  for (const age of p.children ?? []) {
    await page.getByRole('button', { name: /^Ajouter (un|un autre) enfant$/ }).click();
    await page
      .getByLabel(/^Âge de l.enfant \d/)
      .last()
      .fill(String(age));
  }
  if (p.childcare) await radio(page, p.childcare);
  if (p.childSupport) {
    await radio(field(page, 'foyer.childSupport'), p.childSupport.answer);
    if (p.childSupport.amount)
      await page.locator('#child-support').fill(String(p.childSupport.amount));
  }
  await next(page);
  for (const [i, a] of p.adults.entries()) {
    await page.locator(`#a${i}-age`).fill(String(a.age));
    await radio(field(page, `adult${i}.activity`), a.activity);
    if (a.status) await radio(field(page, `adult${i}.status`), a.status);
    if (a.salary) await page.locator(`#a${i}-salary`).fill(String(a.salary));
    if (a.pension) await page.locator(`#a${i}-pension`).fill(String(a.pension));
    if (a.disability)
      await radio(page.getByRole('group', { name: /handicap reconnu/ }).nth(i), a.disability);
  }
  await next(page);
  await radio(field(page, 'housing.status'), p.housing);
  if (p.rent !== undefined) await page.locator('#rent').fill(String(p.rent));
  if (p.zone) await radio(field(page, 'housing.zone'), p.zone);
  await next(page);
  if (isMobile(page) && opts.finish !== false)
    await page.getByRole('button', { name: 'Voir mon résultat' }).click();
  await settle(page);
}

const body = (page: Page) => page.locator('body').innerText();

test.beforeEach(async ({ page }) => {
  await page.goto('simulateur/');
  await page.waitForLoadState('networkidle');
});

/* ── 1. No result before answering ──────────────────────────────────────── */

test('nothing is pre-answered and no result number is shown before answering', async ({ page }) => {
  await expect(figure(page)).toHaveCount(0);
  await expect(page.getByTestId('headline-hero')).toHaveCount(0);
  await expect(page.getByTestId('headline-side')).toHaveCount(0);
  if (!isMobile(page)) {
    await expect(page.locator('[data-testid="empty-result"]:visible').first()).toBeVisible();
    await expect(
      page
        .locator('[data-testid="empty-result"]:visible')
        .getByText('Répondez aux questions pour voir votre résultat.'),
    ).toBeVisible();
  }
  await expect(page.locator('[data-field="foyer.couple"] input:checked')).toHaveCount(0);
  await expect(page.locator('#a0-age')).toHaveValue('');
  await expect(page.locator('#rent')).toHaveCount(0); // not even asked before « Locataire »
  const text = await body(page);
  expect(text).not.toMatch(/[+−]\s?\d[\d  ]*\s?€\s?\/\s?mois/);
  expect(text).not.toMatch(/votre ménage aurait/);
});

test('a couple must answer « marié ou pacsé » — no default — and the partner’s fields say « Son »', async ({
  page,
}) => {
  await radio(field(page, 'foyer.couple'), 'En couple');
  await expect(field(page, 'foyer.married').locator('input:checked')).toHaveCount(0);
  await expect(field(page, 'foyer.married')).toContainText('marié·e ou pacsé·e');
  await expect(page.getByLabel('Son âge')).toBeAttached();
  await expect(page.getByText('Seul / seule (célibataire, veuf ou veuve, divorcé…)')).toBeVisible();
});

/* ── 2. Persona flows ───────────────────────────────────────────────────── */

test('Nadia (couple not married, 1 child, HLM tenant): the three layers, plain summary, no 0,0 %, no docs/', async ({
  page,
}) => {
  await fillPersona(page, PERSONAS.nadia!);
  await expect(figure(page)).toBeVisible();
  await expect(figure(page)).toHaveText(/^[+−]\s?\d/);
  await expect(page.getByTestId('headline-hero')).toContainText(
    'après impôts, aides et TVA estimée',
  );

  // layer 1: the plain summary
  const enClair = page.getByTestId('en-clair');
  await expect(enClair).toContainText('Ce qui augmente');
  await expect(enClair).toContainText('Ce qui baisse');
  await expect(enClair).toContainText('Pourquoi');
  await expect(enClair).toContainText('Ce qui est sûr');
  await expect(page.getByTestId('prominent-losses')).toBeVisible();
  await expect(page.getByTestId('recap')).toContainText('ni marié·e ni pacsé·e');

  // layer 2: the waterfall, with « Vos aides aujourd’hui » and a reason for each zero
  await expect(page.getByRole('heading', { name: 'Le détail' })).toBeVisible();
  await expect(page.getByTestId('benefits-today')).toContainText('Prime d’activité');
  await page
    .getByTestId('benefits-today')
    .getByText(/Voir les 12 aides/)
    .click();
  await expect(page.locator('[data-benefit="aides_logement"]')).toContainText('Pourquoi 0 €');

  // layer 3 is collapsed
  const more = page.getByTestId('more');
  await expect(more.getByRole('heading', { name: 'Pour aller plus loin' })).toBeVisible();
  expect(await more.locator('details[open]').count()).toBe(0);

  const text = await body(page);
  expect(text).not.toMatch(/0,0\s?%/);
  expect(text).not.toMatch(/docs\//);
  expect(text).not.toMatch(/TODO/);
  // the old tier vocabulary is gone
  expect(text).not.toMatch(/Écrit dans la loi/);
});

test('Josiane (retiree, 980 €): no salaried fields, a plain summary, indexation loss next to the figure', async ({
  page,
}) => {
  await radio(field(page, 'foyer.couple'), /^Seul/);
  await next(page);
  await radio(field(page, 'adult0.activity'), 'À la retraite');
  await expect(page.locator('#a0-salary')).toHaveCount(0);
  await expect(field(page, 'adult0.status')).toHaveCount(0);
  await page.goto('simulateur/');
  await page.waitForLoadState('networkidle');
  await fillPersona(page, PERSONAS.josiane!);
  await expect(figure(page)).toBeVisible();
  await expect(page.getByTestId('en-clair')).toContainText('Pourquoi');
  await expect(
    page.locator('[data-testid="prominent-item"][data-item="gel_indexation"]'),
  ).toBeVisible();
  await expect(page.getByRole('button', { name: 'Votre heure de travail' })).toHaveCount(0);
});

test('Thomas (married, 2 children, one with an assistante maternelle): childcare counted, default cost announced', async ({
  page,
}) => {
  await fillPersona(page, PERSONAS.thomas!);
  await expect(figure(page)).toBeVisible();
  await expect(
    page.getByRole('note').filter({ hasText: 'Frais de garde non renseignés' }),
  ).toBeVisible();
  await expect(page.getByTestId('en-clair')).toBeVisible();
  await expect(
    page.locator('[data-testid="prominent-item"][data-item="creche_cmg"]'),
  ).toBeVisible();
  await expect(page.getByTestId('recap')).toContainText('assistante maternelle');
});

test('childcare: micro-crèche is a mode and the monthly cost is asked', async ({ page }) => {
  await radio(field(page, 'foyer.couple'), /^Seul/);
  await page.getByRole('button', { name: 'Ajouter un enfant' }).click();
  await page.getByLabel(/^Âge de l.enfant 1$/).fill('2');
  await radio(page, 'Micro-crèche');
  await expect(page.getByLabel('Ce que coûte la garde, par mois')).toBeVisible();
});

test('Samir (dirigeant, partner fonctionnaire): fonctionnaire warning with a link, and « Et pour mes salariés ? »', async ({
  page,
}) => {
  await fillPersona(page, PERSONAS.samir!);
  await expect(figure(page)).toBeVisible();
  const warn = page.getByTestId('fonctionnaire-warning');
  await expect(warn).toBeVisible();
  await expect(warn.getByRole('link', { name: /agents publics/ }).first()).toHaveAttribute(
    'href',
    /comprendre\/situations\/#agent-public-indispensable$/,
  );
  await page
    .getByRole('navigation', { name: /Pour aller plus loin/ })
    .getByRole('button', { name: 'Et pour mes salariés ?' })
    .click();
  const panel = page.getByTestId('employer-panel');
  await expect(panel).toBeVisible();
  await panel.getByLabel(/^Salaire mensuel net d.un salarié/).fill('1900');
  await expect(page.getByTestId('employer-result')).toContainText('coût employeur');
});

test('Camille (fonctionnaire): the warning about her post sits next to the figure', async ({
  page,
}) => {
  await fillPersona(page, PERSONAS.camille!);
  await expect(figure(page)).toBeVisible();
  await expect(page.getByTestId('fonctionnaire-warning')).toContainText('fonctionnaire');
});

test('TNS: an honest « pas encore couvert », never a figure that would not be the household’s', async ({
  page,
}) => {
  await fillPersona(page, PERSONAS.tns!);
  await expect(page.getByTestId('unsupported-result')).toBeVisible();
  await expect(page.getByText('Pas encore couvert par le simulateur')).toBeVisible();
  await expect(figure(page)).toHaveCount(0);
});

test('lone parent: child support is asked; unanswered, no result; answered, it is in the recap', async ({
  page,
}) => {
  await radio(field(page, 'foyer.couple'), /^Seul/);
  await page.getByRole('button', { name: 'Ajouter un enfant' }).click();
  await page.getByLabel(/^Âge de l.enfant 1$/).fill('9');
  await expect(field(page, 'foyer.childSupport')).toContainText('pension alimentaire');
  await page.goto('simulateur/');
  await page.waitForLoadState('networkidle');
  await fillPersona(page, PERSONAS.loneParent!);
  await expect(figure(page)).toBeVisible();
  await expect(page.getByTestId('recap')).toContainText('pension alimentaire reçue');
});

test('both readings of H1 side by side when they differ (AAH 50–79 %)', async ({ page }) => {
  await fillPersona(page, PERSONAS.handicap!);
  const h1 = page.getByTestId('h1-readings');
  await expect(h1).toBeVisible();
  await expect(h1.locator('[data-reading]')).toHaveCount(2);
  await expect(h1).toContainText('Lecture retenue ici');
  await expect(h1.getByRole('link', { name: /Méthode/ })).toHaveAttribute('href', /methode\/#h1$/);
});

test('no percentage of nothing: « — » for the young person without income, never « 0,0 % »', async ({
  page,
}) => {
  await fillPersona(page, PERSONAS.jeune!);
  await expect(figure(page)).toBeVisible();
  await expect(page.getByTestId('headline-pct')).toContainText('—');
  expect(await body(page)).not.toMatch(/0,0\s?%/);
});

/* ── 3. The « Marc » regression: the field and the calculation always agree ── */

test('a field that is valid on screen but blocked by another (a child without age) never leaves a stale figure', async ({
  page,
}) => {
  test.skip(isMobile(page), 'desktop layout: all questions on one page');
  await fillPersona(page, {
    ...PERSONAS.camille!,
    adults: [{ age: 34, activity: 'En emploi', status: PRIVE, salary: 1478 }],
  });
  await expect(figure(page)).toBeVisible();
  // add two children, the second without an age: the form is incomplete
  await page.getByRole('button', { name: /^Ajouter (un|un autre) enfant$/ }).click();
  await page.getByLabel(/^Âge de l.enfant 1$/).fill('8');
  await page.getByRole('button', { name: 'Ajouter un autre enfant' }).click();
  await page.locator('#a0-salary').fill('1400');
  await settle(page);
  // no figure from the previous state, and the missing answer is named
  await expect(figure(page)).toHaveCount(0);
  await expect(page.locator('[data-testid="empty-result"]:visible').first()).toContainText(
    'l’âge de l’enfant 2',
  );
  await page.getByLabel(/^Âge de l.enfant 2$/).fill('3');
  await page.locator('#child-support').count();
  await radio(field(page, 'foyer.childSupport'), 'Non');
  await settle(page);
  await expect(figure(page)).toBeVisible();
  // and the calculation used what the field shows: 1 400 €, not the 1 478 € typed before
  await page
    .getByRole('button', { name: /Salaire net/ })
    .first()
    .click();
  const panel = page.locator('[id$="-0"]').filter({ hasText: 'Aujourd’hui' }).first();
  await expect(panel).toContainText(/1[  ]400,00/);
  await expect(panel).not.toContainText(/1[  ]478,00/);
});

/* ── 4. Sharing ─────────────────────────────────────────────────────────── */

test('the shared link restores the answers, shows the recap and a loading notice instead of the default page', async ({
  page,
  context,
}) => {
  await context.grantPermissions(['clipboard-read', 'clipboard-write']);
  await fillPersona(page, PERSONAS.nadia!);
  await page.waitForFunction(() => location.hash.startsWith('#v1.'));
  const url = page.url();
  expect(url).toMatch(/#v1\.[A-Za-z0-9_-]+$/);
  expect(url.split('#')[0]).not.toContain('?');
  const figureText = await figure(page).innerText();

  // « Copier le lien » copies the CURRENT valid state, even right after an edit (no stale debounced state)
  if (!isMobile(page)) {
    await page.locator('#rent').fill('520');
    await page
      .getByRole('button', { name: /Copier le lien|Partager/ })
      .first()
      .click();
    const copied = await page.evaluate(() => navigator.clipboard.readText());
    await settle(page);
    expect(copied).toBe(page.url());
    expect(copied).not.toBe(url);
    await page.locator('#rent').fill('480');
    await settle(page);
  }
  const fresh = await context.newPage();
  await fresh.goto(page.url());
  // until the situation is restored, the pre-rendered default page is hidden behind a notice (or already gone)
  await fresh.waitForLoadState('networkidle');
  await expect(fresh.getByTestId('headline-hero')).toBeVisible();
  await expect(fresh.locator('html')).not.toHaveAttribute('data-sim-hash', /.+/);
  await expect(fresh.getByTestId('recap')).toContainText('En couple');
  await expect(fresh.getByTestId('recap')).toContainText('480');
  await expect(
    fresh.getByRole('note').filter({ hasText: 'Vous regardez le résultat d’une autre personne' }),
  ).toBeVisible();
  expect(await figure(fresh).innerText()).toBe(figureText);
  await fresh.close();
});

test('the guard script hides the pre-rendered default page when a shared hash is present', async ({
  page,
}) => {
  await page.goto('about:blank');
  await page.route('**/*.js', (r) => r.abort()); // the island never loads: only the inline script runs
  await page.goto('simulateur/#v1.AAAA');
  await expect(page.locator('html')).toHaveAttribute('data-sim-hash', '1');
  await expect(page.getByTestId('sim-loading')).toBeVisible();
  await expect(page.getByTestId('sim-loading')).toContainText(
    'Chargement de la simulation partagée…',
  );
  await expect(page.locator('#sim-root')).toBeHidden();
});

test('an unreadable state hash is explained, and anchors like #main do not break the state', async ({
  page,
}) => {
  await page.goto('simulateur/#main');
  await expect(page.getByText(/Ce lien ne semble pas complet/)).toHaveCount(0);
  await page.goto('about:blank');
  await page.goto('simulateur/#v1.%%%');
  await expect(page.getByText(/Ce lien ne semble pas complet/)).toBeVisible();
  await expect(figure(page)).toHaveCount(0);
});

/* ── 5. Layer 3 and the hypotheses ──────────────────────────────────────── */

test('layer 3 opens on demand: hour of work consistent with the headline, curve, transition, hypotheses', async ({
  page,
}) => {
  await fillPersona(page, PERSONAS.nadia!);
  const nav = page.getByRole('navigation', { name: /Pour aller plus loin/ });

  await nav.getByRole('button', { name: 'Votre heure de travail' }).click();
  const sentence = page.getByTestId('hour-sentence');
  await expect(sentence).toBeVisible();
  await expect(sentence).toContainText('aide universelle');
  await expect(page.getByText(/l’État vous verse/i).first()).toBeVisible();

  await nav.getByRole('button', { name: 'Si je gagnais plus ?' }).click();
  await expect(page.getByRole('img', { name: /Courbes du revenu disponible/ })).toBeVisible();

  await nav.getByRole('button', { name: /La transition/ }).click();
  for (const id of ['2027', '2028', '2030', 'steady'])
    await expect(page.getByTestId(`photo-${id}`)).toBeAttached();

  await nav.getByRole('button', { name: /foyers types proches/ }).click();
  await expect(page.getByTestId('nearby-case')).toHaveCount(3);

  const before = await figure(page).innerText();
  await nav.getByRole('button', { name: 'Les hypothèses' }).click();
  const h2 = page.getByRole('switch', { name: /H2/ });
  await h2.scrollIntoViewIfNeeded();
  await labelOf(h2).click();
  await settle(page);
  expect(await figure(page).innerText()).not.toBe(before);
});

/* ── 6. The waterfall header on a tablet, keyboard, a11y ────────────────── */

test('820 px tablet: the waterfall axis labels do not overlap', async ({ page }) => {
  test.skip(isMobile(page), 'desktop project only (the viewport is set here)');
  await page.setViewportSize({ width: 820, height: 1180 });
  await page.reload();
  await page.waitForLoadState('networkidle');
  await fillPersona(page, PERSONAS.thomas!);
  const labels = page.getByTestId('waterfall-axis').locator('span');
  await labels.first().scrollIntoViewIfNeeded();
  const boxes = (await labels.evaluateAll((els) =>
    els.map((e) => {
      const r = e.getBoundingClientRect();
      return { l: r.left, r: r.right };
    }),
  )) as Array<{ l: number; r: number }>;
  expect(boxes.length).toBeGreaterThan(1);
  boxes.sort((a, b) => a.l - b.l);
  for (let i = 1; i < boxes.length; i++)
    expect(boxes[i]!.l).toBeGreaterThanOrEqual(boxes[i - 1]!.r - 0.5);
});

test('the question form is keyboard-operable: arrow keys change a choice', async ({ page }) => {
  const first = page.getByRole('radio', { name: /^Seul/ });
  await first.focus();
  await page.keyboard.press('ArrowDown');
  await expect(page.getByRole('radio', { name: 'En couple' })).toBeChecked();
});

test('errors are calm: nothing is shouted at a field nobody has visited', async ({ page }) => {
  if (isMobile(page)) return;
  await expect(page.locator('#a0-age-err')).toBeHidden();
  await page.locator('#a0-age').fill('4');
  await expect(page.locator('#a0-age-err')).toBeHidden(); // while typing
  await page.locator('#a0-age').blur();
  await expect(page.locator('#a0-age-err')).toContainText('compris entre 18 et 110');
});

test('no serious axe violation on the start state and on a full result', async ({ page }) => {
  test.setTimeout(90_000);
  const run = async () => {
    const r = await new AxeBuilder({ page })
      .withTags(['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa', 'wcag22aa'])
      .analyze();
    return r.violations
      .filter((v) => v.impact === 'serious' || v.impact === 'critical')
      .map((v) => `${v.id}: ${v.nodes.map((n) => n.target.join(' ')).join(' | ')}`);
  };
  expect(await run()).toEqual([]);
  await fillPersona(page, PERSONAS.thomas!);
  await page.getByRole('button', { name: 'Tout déplier' }).click();
  await page.getByTestId('more').getByRole('button', { name: 'Les hypothèses' }).click();
  expect(await run()).toEqual([]);
});

test('no horizontal scroll at 320 px with the result open', async ({ page }) => {
  await page.setViewportSize({ width: 320, height: 700 });
  await page.reload();
  await page.waitForLoadState('networkidle');
  await fillPersona(page, PERSONAS.nadia!);
  await page.getByRole('button', { name: 'Tout déplier' }).click();
  const { scrollWidth, clientWidth } = await page.evaluate(() => ({
    scrollWidth: document.documentElement.scrollWidth,
    clientWidth: document.documentElement.clientWidth,
  }));
  expect(scrollWidth).toBeLessThanOrEqual(clientWidth);
});

/* ── 7. /simulateur/cas-types/ ──────────────────────────────────────────── */

test.describe('cas-types', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('simulateur/cas-types/');
    await page.waitForLoadState('networkidle');
  });

  test('leads with the pattern in words and the caveat, not with a « 37 sur 47 » counter', async ({
    page,
  }) => {
    await expect(page.getByText('Des cas types, pas la population')).toBeVisible();
    await expect(page.getByText(/Ce n.est pas un échantillon représentatif/)).toBeVisible();
    await expect(page.getByTestId('pattern')).toContainText('perdent');
    const text = await body(page);
    expect(text).not.toMatch(/\d+\s+sur\s+\d+/);
    expect(text).not.toMatch(/Foyers types qui gagnent/);
    expect(text).not.toMatch(/0,0\s?%/);
  });

  test('every foyer has a visible label without hover, with a sign; losers next to winners', async ({
    page,
  }) => {
    const tiles = page.locator('[data-testid="cas-tile"]:visible');
    expect(await tiles.count()).toBeGreaterThan(10);
    const labels = await tiles.allTextContents();
    expect(labels.every((t) => /[+−]|0/.test(t))).toBe(true);
    if (isMobile(page)) await expect(tiles.first()).toContainText(/\S{3,}/);
  });

  test('clicking a foyer opens the simulator with its answers', async ({ page }) => {
    const tile = page.locator('[data-testid="cas-tile"]:visible').nth(8);
    if (isMobile(page)) await page.goto((await tile.getAttribute('href'))!);
    else await tile.click();
    await expect(page).toHaveURL(/simulateur\/#v1\./);
    await page.waitForLoadState('networkidle');
    await expect(page.getByTestId('headline-hero')).toBeVisible();
    await expect(page.getByTestId('recap')).toBeVisible();
  });

  test('€ / % switch relabels the tiles; no percentage of nothing', async ({ page }) => {
    await radio(page, '% du revenu');
    const texts = await page.locator('[data-testid="cas-tile"]:visible').allTextContents();
    expect(texts.some((t) => t.includes('%'))).toBe(true);
    expect(await body(page)).not.toMatch(/0,0\s?%/);
  });

  test('period and hypotheses recompute the map', async ({ page }) => {
    const read = async () =>
      (await page.locator('[data-testid="cas-tile"]:visible').allTextContents()).join('|');
    const before = await read();
    await radio(page, '2027');
    expect(await read()).not.toBe(before);
  });
});
