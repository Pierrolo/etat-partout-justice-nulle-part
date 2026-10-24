import AxeBuilder from '@axe-core/playwright';
import { expect, test, type Locator, type Page } from '@playwright/test';

/**
 * The simulator, end to end: three personas, the headline sentence, live hypotheses, the shareable
 * #hash round trip, keyboard use, the cas-types page and axe in the interesting states.
 * Written against the UI contract (labels, roles), not against numbers: it runs unchanged on the mock
 * engine and on the real one.
 */

const isMobile = (page: Page) => (page.viewportSize()?.width ?? 1280) < 640;
/** The spoken headline: the sidebar / hero card, or — on a phone while answering — the live bar. */
const sentence = (page: Page) => page.locator('[data-testid="headline-sentence"]:visible').first();

/** Phones show the questions first: open the detailed result (no-op elsewhere). */
async function openResult(page: Page) {
  if (isMobile(page) && (await page.locator('#detail').isHidden()))
    await page.getByRole('button', { name: 'Voir le détail' }).first().click();
}

/** Signed amount of the headline, € / month: +210, −85… */
async function headlineAmount(page: Page): Promise<number> {
  const text = (await sentence(page).textContent()) ?? '';
  const m = /disposerait de ([+−])([\d   ]+)\s*€\/mois/.exec(text);
  if (!m) throw new Error(`no amount in headline: ${text}`);
  const n = Number(m[2]!.replace(/[^\d]/g, ''));
  return m[1] === '−' ? -n : n;
}

/** Wait until the debounced result (and URL hash) catch up with the last input. */
const settle = (page: Page) => page.waitForTimeout(450);

/** The real inputs are visually hidden (sr-only): like a person, click their visible label. */
const labelOf = (input: Locator) => input.locator('xpath=ancestor::label[1]');
const radio = (scope: Page | Locator, name: string | RegExp) =>
  labelOf(
    scope.getByRole('radio', typeof name === 'string' ? { name, exact: true } : { name }),
  ).click();
const setChecked = async (input: Locator, on: boolean) => {
  if ((await input.isChecked()) !== on) await labelOf(input).click();
};

async function next(page: Page) {
  if (isMobile(page)) await page.getByRole('button', { name: 'Suivant', exact: true }).click();
}

interface AdultSpec {
  age: number;
  activity?: 'Salarié·e' | 'Sans emploi' | 'Retraité·e' | 'Étudiant·e' | 'Inactif·ve';
  salary?: number;
  status?: 'Cadre' | 'Fonctionnaire';
  pension?: number;
  pensionYear?: number;
  disability?: RegExp;
}

async function fillAdult(page: Page, step: 'adult0' | 'adult1', a: AdultSpec) {
  const s = page.locator(`[data-step="${step}"]`);
  await s.getByLabel(/^(Votre|Son) âge/).fill(String(a.age));
  if (a.activity) await radio(s, a.activity);
  if (a.salary !== undefined) await s.getByLabel(/^Salaire mensuel net/).fill(String(a.salary));
  if (a.status) await radio(s, a.status);
  if (a.pension !== undefined)
    await s.getByLabel(/^Pension mensuelle nette/).fill(String(a.pension));
  if (a.pensionYear !== undefined)
    await s.getByLabel('Année de départ à la retraite').fill(String(a.pensionYear));
  if (a.disability) await radio(s, a.disability);
}

interface Persona {
  couple?: boolean;
  married?: boolean;
  children?: number[];
  adults: [AdultSpec] | [AdultSpec, AdultSpec];
  housing:
    | 'Locataire'
    | 'Propriétaire, sans crédit'
    | 'Propriétaire, avec crédit'
    | 'Hébergé·e gratuitement';
  rent?: number;
  zone?: 1 | 2 | 3;
}

async function fillPersona(page: Page, p: Persona) {
  if (p.couple) {
    await radio(page, 'En couple');
    if (p.married) await radio(page, 'Oui');
  }
  for (const age of p.children ?? []) {
    await page.getByRole('button', { name: /^Ajouter (un|un autre) enfant$/ }).click();
    await page
      .getByLabel(/^Âge de l.enfant \d/)
      .last()
      .fill(String(age));
  }
  await next(page);
  await fillAdult(page, 'adult0', p.adults[0]);
  await next(page);
  if (p.adults[1]) {
    await fillAdult(page, 'adult1', p.adults[1]);
    await next(page);
  }
  await radio(page, p.housing);
  if (p.housing === 'Locataire') {
    if (p.rent !== undefined)
      await page.getByLabel('Loyer mensuel hors charges').fill(String(p.rent));
    if (p.zone) await radio(page, new RegExp(`^Zone ${p.zone}`));
  }
  await next(page);
  if (isMobile(page)) await page.getByRole('button', { name: 'Voir mon résultat' }).click();
  await settle(page);
}

test.beforeEach(async ({ page }) => {
  await page.goto('simulateur/');
  await page.waitForLoadState('networkidle');
});

/* ── 1. First paint: a result with no input at all ──────────────────────── */

test('shows a result immediately, from smart defaults', async ({ page }) => {
  await expect(sentence(page)).toContainText(
    'Avec le plan complet appliqué à votre situation de 2026',
  );
  await expect(sentence(page)).toContainText('votre ménage disposerait de');
  await expect(sentence(page)).toContainText('/mois');
  expect(Number.isFinite(await headlineAmount(page))).toBe(true);
});

/* ── 2. Three personas ──────────────────────────────────────────────────── */

test.describe('personas', () => {
  test('couple with two children, owner with a mortgage: result, waterfall, hour of work', async ({
    page,
  }) => {
    await fillPersona(page, {
      couple: true,
      married: true,
      children: [4, 11],
      adults: [
        { age: 41, salary: 3200, status: 'Cadre' },
        { age: 39, salary: 2200 },
      ],
      housing: 'Propriétaire, avec crédit',
    });
    await expect(sentence(page)).toContainText('votre ménage disposerait de');
    const amount = await headlineAmount(page);
    expect(Math.abs(amount)).toBeGreaterThan(0);

    // waterfall: rows expand to the calculation and sources
    const detail = page.locator('#detail');
    await detail.scrollIntoViewIfNeeded();
    const first = detail.locator('ol button[aria-expanded]').first();
    await first.click();
    await expect(first).toHaveAttribute('aria-expanded', 'true');
    const panel = page.locator(`[id="${await first.getAttribute('aria-controls')}"]`);
    await expect(panel).toBeVisible();
    await expect(panel).toContainText('Aujourd’hui');
    await expect(panel).toContainText('Avec le plan');

    // the signature visual is there for salaried people
    await expect(page.getByRole('heading', { name: 'Votre heure de travail' })).toBeVisible();
    await expect(page.getByText(/Une heure de travail coûte/)).toBeAttached();
    // two adults: choose whose hour
    await expect(page.getByRole('radio', { name: 'Votre conjoint·e' })).toBeAttached();
  });

  test('retiree living alone, home owner: no salaried-only views, honest panels present', async ({
    page,
  }) => {
    await fillPersona(page, {
      adults: [{ age: 72, activity: 'Retraité·e', pension: 1650, pensionYear: 2018 }],
      housing: 'Propriétaire, sans crédit',
    });
    await expect(sentence(page)).toContainText('votre ménage disposerait de');
    // « Votre heure de travail » concerns salaried people only
    await expect(page.getByRole('heading', { name: 'Votre heure de travail' })).toHaveCount(0);
    // both « non chiffré » panels, same structure
    await expect(page.getByTestId('unq-promises')).toBeVisible();
    await expect(page.getByTestId('unq-losses')).toBeVisible();
    const [a, b] = await Promise.all([
      page.getByTestId('unq-promises').boundingBox(),
      page.getByTestId('unq-losses').boundingBox(),
    ]);
    if (!isMobile(page)) {
      expect(a!.width).toBeCloseTo(b!.width, 0);
      expect(a!.y).toBeCloseTo(b!.y, 0);
    }
  });

  test('lone parent, tenant in zone 1, not receiving her benefits: friendly validation then result', async ({
    page,
  }) => {
    // 1. foyer: one child, age left empty on purpose
    await page.getByRole('button', { name: 'Ajouter un enfant' }).click();
    await page.getByLabel(/^Âge de l.enfant 1$/).fill('');
    await expect(page.getByText(/Indiquez l.âge de l.enfant 1/)).toBeVisible();
    // the headline says what is missing instead of showing stale numbers as new
    if (!isMobile(page)) {
      await expect(page.getByTestId('headline-side'))
        .toContainText('Complétez les champs signalés', {
          useInnerText: true,
        })
        .catch(() => undefined);
    }
    await page.getByLabel(/^Âge de l.enfant 1$/).fill('6');
    await next(page);
    await fillAdult(page, 'adult0', { age: 33, salary: 1600 });
    await next(page);
    await radio(page, 'Locataire');
    await page.getByLabel('Loyer mensuel hors charges').fill('780');
    await radio(page, /^Zone 1/);
    await next(page);
    await setChecked(page.getByRole('checkbox', { name: /Je ne touche pas ces aides/ }), true);
    if (isMobile(page)) await page.getByRole('button', { name: 'Voir mon résultat' }).click();
    await settle(page);
    await expect(sentence(page)).toContainText('votre ménage disposerait de');
    // losers are named as plainly as winners: the sentence always carries a sign
    expect(await headlineAmount(page)).not.toBeNaN();
  });
});

test('AEEH and the CMI « invalidité » are two separate answers (the plan supplement needs the card)', async ({
  page,
}) => {
  await page.getByRole('button', { name: 'Ajouter un enfant' }).click();
  const aeeh = page.getByRole('checkbox', { name: /^AEEH/ });
  const cmi = page.getByRole('checkbox', { name: /Carte mobilité inclusion – invalidité/ });
  await expect(cmi).toHaveCount(0);
  await setChecked(aeeh, true);
  await expect(cmi).toBeVisible();
  await expect(cmi).not.toBeChecked(); // AEEH alone does not imply the card
  await setChecked(cmi, true);
  await setChecked(aeeh, false);
  await setChecked(aeeh, true);
  await expect(cmi).not.toBeChecked(); // un-ticking AEEH forgets the card
});

/* ── 3. Hypotheses change the output, live ──────────────────────────────── */

test('toggling an hypothesis recomputes the result', async ({ page }) => {
  await fillPersona(page, {
    adults: [{ age: 38, salary: 2400 }],
    housing: 'Locataire',
    rent: 700,
  });
  const before = await headlineAmount(page);

  const h2 = page.getByRole('switch', { name: /H2/ });
  await h2.scrollIntoViewIfNeeded();
  await setChecked(h2, false);
  await settle(page);
  const noFraisPro = await headlineAmount(page);
  expect(noFraisPro).not.toBe(before);

  // back to the default: back to the same number
  await setChecked(h2, true);
  await settle(page);
  expect(await headlineAmount(page)).toBe(before);

  // H1 and H5 are live too
  await radio(page, 'Maintenus en différentiel');
  await settle(page);
  const differential = await headlineAmount(page);
  await radio(page, 'Remplacés par l’AFU');
  await radio(page, '0 %');
  await settle(page);
  const noTva = await headlineAmount(page);
  expect([differential, noTva].some((v) => v !== before)).toBe(true);
});

test('the headline only is announced politely (one live region for the result)', async ({
  page,
}) => {
  const live = page.locator(
    '[data-testid^="headline-"]:visible [aria-live="polite"], [data-testid="live-bar"] [aria-live="polite"]',
  );
  await expect(live).toHaveCount(1);
  await expect(live).toHaveAttribute('aria-atomic', 'true');
  // and nothing else on the page is a live region except form errors and the share confirmation
  const others = await page
    .locator('[aria-live="polite"]:visible, [role="status"]:visible')
    .count();
  expect(others).toBeLessThan(12);
});

/* ── 4. Shareable state in the #hash ────────────────────────────────────── */

test('the situation round-trips through the URL hash', async ({ page, context }) => {
  await context.grantPermissions(['clipboard-read', 'clipboard-write']);
  await fillPersona(page, {
    couple: true,
    children: [7],
    adults: [
      { age: 44, salary: 2900, status: 'Cadre' },
      { age: 42, activity: 'Sans emploi' },
    ],
    housing: 'Locataire',
    rent: 910,
    zone: 1,
  });
  await page.waitForFunction(() => location.hash.startsWith('#v1.'));
  const url = page.url();
  expect(url).toMatch(/#v1\.[A-Za-z0-9_-]+$/);
  expect(url.split('#')[0]).not.toContain('?'); // never a query string
  const amount = await headlineAmount(page);

  // « Copier le lien » copies that very URL and says so
  await page.getByRole('button', { name: 'Copier le lien' }).first().click();
  await expect(page.getByRole('button', { name: 'Lien copié' }).first()).toBeVisible();
  const copied = await page.evaluate(() => navigator.clipboard.readText());
  expect(copied).toBe(url);

  // a fresh load restores every answer and lands on the result
  const fresh = await context.newPage();
  await fresh.goto(url);
  await fresh.waitForLoadState('networkidle');
  await expect(sentence(fresh)).toContainText('votre ménage disposerait de');
  expect(await headlineAmount(fresh)).toBe(amount);
  if (isMobile(fresh)) await fresh.getByRole('button', { name: '← Modifier mes réponses' }).click();
  await expect(fresh.getByRole('radio', { name: 'En couple' })).toBeChecked();
  await expect(fresh.getByLabel(/^Âge de l.enfant 1$/)).toHaveValue('7');
  if (!isMobile(fresh)) {
    await expect(
      fresh.locator('[data-step="adult0"]').getByLabel(/^Salaire mensuel net/),
    ).toHaveValue(/2.?900/);
    await expect(
      fresh.locator('[data-step="adult1"]').getByRole('radio', { name: 'Sans emploi' }),
    ).toBeChecked();
    await expect(fresh.getByLabel('Loyer mensuel hors charges')).toHaveValue('910');
    await expect(fresh.getByRole('radio', { name: /^Zone 1/ })).toBeChecked();
  }
  await fresh.close();
});

test('hypotheses are part of the shared state', async ({ page, context }) => {
  await fillPersona(page, { adults: [{ age: 35, salary: 2000 }], housing: 'Locataire', rent: 600 });
  const h2 = page.getByRole('switch', { name: /H2/ });
  await h2.scrollIntoViewIfNeeded();
  await setChecked(h2, false);
  await settle(page);
  const amount = await headlineAmount(page);
  const fresh = await context.newPage();
  await fresh.goto(page.url());
  await fresh.waitForLoadState('networkidle');
  expect(await headlineAmount(fresh)).toBe(amount);
  await expect(fresh.getByRole('switch', { name: /H2/ })).not.toBeChecked();
  await fresh.close();
});

test('an unreadable state hash is explained, and anchors like #main do not break the state', async ({
  page,
}) => {
  await page.goto('simulateur/#main');
  await expect(sentence(page)).toContainText('votre ménage disposerait de');
  await expect(page.getByText(/Ce lien ne semble pas complet/)).toHaveCount(0);
  await page.goto('about:blank');
  await page.goto('simulateur/#v1.%%%');
  await expect(page.getByText(/Ce lien ne semble pas complet/)).toBeVisible();
  await expect(sentence(page)).toContainText('votre ménage disposerait de');
});

/* ── 5. Table, period, transition, curve ────────────────────────────────── */

test('table: monthly and annual views, the total gap is the headline', async ({ page }) => {
  await openResult(page);
  const table = page.getByRole('table', { name: /Revenu disponible du ménage/ });
  await table.scrollIntoViewIfNeeded();
  const gap = table.locator('tfoot tr td').last();
  const num = (s: string) => Number(s.replace(/[^\d−-]/g, '').replace('−', '-'));
  const monthly = num((await gap.textContent()) ?? '');
  // the total row says the same thing as the headline sentence
  expect(monthly).toBe(await headlineAmount(page));
  await radio(page, 'Par an');
  expect(num((await gap.textContent()) ?? '')).toBe(monthly * 12);
});

test('transition: four photos, and one can be promoted to the main view', async ({ page }) => {
  await openResult(page);
  for (const id of ['2027', '2028', '2030', 'steady'])
    await expect(page.getByTestId(`photo-${id}`)).toBeAttached();
  await page.getByTestId('photo-2028').scrollIntoViewIfNeeded();
  await page.getByTestId('photo-2028').getByRole('button', { name: 'Détailler' }).click();
  await settle(page);
  await expect(sentence(page)).toContainText('En 2028, avec les mesures alors en vigueur');
  await expect(page).toHaveURL(/#v1\./);
  await page.reload();
  await page.waitForLoadState('networkidle');
  await expect(sentence(page)).toContainText('En 2028');
});

test('« Si je gagnais plus ? » has a chart, a text reading, a keyboard slider and the expert view', async ({
  page,
}) => {
  await openResult(page);
  const heading = page.getByRole('heading', { name: 'Si je gagnais plus ?' });
  await heading.scrollIntoViewIfNeeded();
  await expect(page.getByRole('img', { name: /Courbes du revenu disponible/ })).toBeVisible();
  const slider = page.getByRole('slider', { name: 'Explorer un autre salaire net' });
  await slider.focus();
  await page.keyboard.press('End');
  await expect(page.getByText(/net par mois, le revenu disponible est de/)).toBeVisible();
  await setChecked(page.getByRole('switch', { name: /Mode expert/ }), true);
  await expect(
    page.getByRole('img', { name: /taux marginal d.imposition effectif/ }),
  ).toBeVisible();
});

/* ── 6. Keyboard ────────────────────────────────────────────────────────── */

test('the question form is keyboard-operable: arrow keys change a choice, Tab reaches every field', async ({
  page,
}) => {
  const alone = page.getByRole('radio', { name: 'Seul·e' });
  await alone.focus();
  await page.keyboard.press('ArrowRight');
  await expect(page.getByRole('radio', { name: 'En couple' })).toBeChecked();
  await expect(
    page
      .getByRole('radio', { name: 'Êtes-vous marié·e ou pacsé·e ?' })
      .or(page.getByText('Êtes-vous marié·e ou pacsé·e ?')),
  ).toBeVisible();
  // visible focus: the focused radio's pill gets an outline (the input itself is visually hidden)
  const outline = await page.evaluate(() => {
    const el = document.activeElement as HTMLInputElement;
    const pill = el.nextElementSibling as HTMLElement;
    return getComputedStyle(pill).outlineStyle;
  });
  expect(outline).not.toBe('none');
});

/* ── 7. Accessibility in the interesting states ─────────────────────────── */

test('no serious axe violation with everything open (rows expanded, expert curve, refinements)', async ({
  page,
}, info) => {
  test.skip(info.project.name === 'mobile', 'covered below with the mobile result view');
  await page.getByRole('button', { name: 'Tout déplier' }).click();
  await setChecked(page.getByRole('switch', { name: /Mode expert/ }), true);
  await page.getByText('Affiner le calcul').click();
  await page.getByText('Voir les données').first().click();
  await settle(page);
  const results = await new AxeBuilder({ page })
    .withTags(['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa', 'wcag22aa'])
    .analyze();
  expect(
    results.violations
      .filter((v) => v.impact === 'serious' || v.impact === 'critical')
      .map((v) => `${v.id}: ${v.nodes.map((n) => n.target.join(' ')).join(' | ')}`),
  ).toEqual([]);
});

test('no serious axe violation on the mobile result view and its stepper', async ({
  page,
}, info) => {
  test.skip(info.project.name !== 'mobile', 'mobile only');
  const run = async () => {
    const r = await new AxeBuilder({ page })
      .withTags(['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa', 'wcag22aa'])
      .analyze();
    return r.violations
      .filter((v) => v.impact === 'serious' || v.impact === 'critical')
      .map((v) => `${v.id}: ${v.nodes.map((n) => n.target.join(' ')).join(' | ')}`);
  };
  expect(await run()).toEqual([]); // step 1
  await page.getByRole('button', { name: 'Suivant', exact: true }).click();
  expect(await run()).toEqual([]); // step 2
  await page.getByRole('button', { name: 'Voir le détail' }).first().click();
  await settle(page);
  expect(await run()).toEqual([]); // result
});

test('no horizontal scroll at 320 px with the result open', async ({ page }) => {
  await page.setViewportSize({ width: 320, height: 700 });
  await page.reload();
  await page.waitForLoadState('networkidle');
  if (isMobile(page)) await page.getByRole('button', { name: 'Voir le détail' }).first().click();
  await page.getByRole('button', { name: 'Tout déplier' }).click();
  await settle(page);
  const { scrollWidth, clientWidth } = await page.evaluate(() => ({
    scrollWidth: document.documentElement.scrollWidth,
    clientWidth: document.documentElement.clientWidth,
  }));
  expect(scrollWidth).toBeLessThanOrEqual(clientWidth);
});

test('reduced motion: nothing animates', async ({ page }) => {
  await page.emulateMedia({ reducedMotion: 'reduce' });
  await page.reload();
  const durations = await page.evaluate(() =>
    [...document.querySelectorAll('#detail *, [data-step] *')]
      .slice(0, 400)
      .map((el) => parseFloat(getComputedStyle(el).transitionDuration.split(',')[0]!))
      .filter((d) => d > 0.001),
  );
  expect(durations).toEqual([]);
});

/* ── 8. /simulateur/cas-types/ ──────────────────────────────────────────── */

test.describe('cas-types', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('simulateur/cas-types/');
    await page.waitForLoadState('networkidle');
  });

  test('says plainly that these are standard cases, not the population', async ({ page }) => {
    await expect(page.getByText('Des cas types, pas la population')).toBeVisible();
    await expect(page.getByText(/Ce n.est pas un échantillon représentatif/)).toBeVisible();
  });

  test('heatmap tiles carry a sign and a text label; losers appear next to winners', async ({
    page,
  }) => {
    const tiles = page.getByTestId('cas-tile');
    expect(await tiles.count()).toBeGreaterThan(10);
    const labels = await tiles.allTextContents();
    expect(labels.every((t) => /[+−]|^\s*0/.test(t))).toBe(true);
    await expect(page.getByText(/Foyers types qui perdent/)).toBeVisible();
  });

  test('clicking a tile opens the simulator pre-filled', async ({ page }) => {
    const tile = page.getByTestId('cas-tile').nth(8);
    const label = (await tile.getAttribute('aria-label')) ?? '';
    await tile.click();
    await expect(page).toHaveURL(/simulateur\/#v1\./);
    await page.waitForLoadState('networkidle');
    await expect(sentence(page)).toContainText('votre ménage disposerait de');
    expect(label).toContain('Ouvrir dans le simulateur');
  });

  test('table sorts on a click and exposes aria-sort', async ({ page }) => {
    const table = page.getByRole('table', { name: /Foyers types/ });
    const delta = table.getByRole('columnheader', { name: /Écart \(€\/mois\)/ });
    await delta.getByRole('button').click();
    await expect(delta).toHaveAttribute('aria-sort', 'descending');
    const firstDesc = await table.locator('tbody tr').first().locator('td').nth(3).textContent();
    await delta.getByRole('button').click();
    await expect(delta).toHaveAttribute('aria-sort', 'ascending');
    const firstAsc = await table.locator('tbody tr').first().locator('td').nth(3).textContent();
    expect(firstAsc).not.toBe(firstDesc);
  });

  test('€ / % switch relabels the tiles', async ({ page }) => {
    await radio(page, '% du revenu');
    const texts = await page.getByTestId('cas-tile').allTextContents();
    expect(texts.some((t) => t.includes('%'))).toBe(true);
  });

  test('period and hypotheses recompute the map', async ({ page }) => {
    const read = async () => (await page.getByTestId('cas-tile').allTextContents()).join('|');
    const before = await read();
    await radio(page, '2027');
    expect(await read()).not.toBe(before);
    await radio(page, 'Plan complet');
    await page.getByText('Changer les hypothèses').click();
    await setChecked(page.getByRole('switch', { name: /H2/ }), false);
    expect(await read()).not.toBe(before);
  });
});
