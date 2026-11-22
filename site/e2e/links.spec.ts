import { expect, test, type APIRequestContext } from '@playwright/test';
import { openAllDetails, scrollThrough } from './helpers';
import { builtPages } from './pages';

/**
 * Links (fact-check R2-01): the French typography pass once slipped a no-break space into the percent-encoding of
 * the source links (« …/S%C3<NBSP>%A9ries… »), which made 29 « chiffrage publié » links dead. On every page of the
 * production build, after the islands have mounted:
 *   - the HTML source (islands' serialized props included) holds no web address with a U+00A0 / U+202F, a raw space or
 *     a broken percent-escape;
 *   - every external link (`a[href^=http]`) is a well-formed address whose path decodes (no NBSP, no U+202F);
 *   - every internal link (same origin, anchors aside) answers 200.
 * External addresses are not fetched (the sandbox has no network and CI must not depend on a third party): the
 * address itself is what the build can get wrong.
 */

const SPACE_LIKE = /[    ]/;
/** A web address in HTML source: stops at a quote, a bracket, an ampersand (entities) or an ordinary space. */
const URL_IN_SOURCE = /https?:\/\/[^"'<>& \t\r\n]+/g;

function malformedAddress(raw: string): string | null {
  if (SPACE_LIKE.test(raw)) return 'espace insécable ou fine dans l’adresse';
  if (/\s/.test(raw)) return 'espace dans l’adresse';
  if (/%(?![0-9A-Fa-f]{2})/.test(raw)) return 'pourcentage mal formé';
  try {
    const u = new URL(raw);
    decodeURIComponent(u.pathname);
    decodeURIComponent(u.search);
    if (SPACE_LIKE.test(decodeURIComponent(u.pathname))) return 'espace insécable après décodage';
  } catch {
    return 'adresse ou encodage invalide';
  }
  return null;
}

/** Internal answers are cached per worker: pages share most of their links. */
const answered = new Map<string, number>();
async function statusOf(request: APIRequestContext, url: string): Promise<number> {
  const hit = answered.get(url);
  if (hit !== undefined) return hit;
  const res = await request.get(url, { maxRedirects: 5 });
  answered.set(url, res.status());
  return res.status();
}

test.describe('links on every page', () => {
  for (const path of builtPages()) {
    test(`${path || 'home'}: external addresses are clean, internal links resolve`, async ({
      page,
      request,
      baseURL,
    }) => {
      // 1. the raw HTML, islands' props included
      const html = await (await request.get(path)).text();
      const rawProblems: string[] = [];
      for (const m of html.matchAll(URL_IN_SOURCE)) {
        const why = malformedAddress(m[0]);
        if (why) rawProblems.push(`${why} : ${JSON.stringify(m[0]).slice(0, 140)}`);
      }
      expect(
        rawProblems.slice(0, 10),
        `${rawProblems.length} adresse(s) mal formée(s) dans le HTML`,
      ).toEqual([]);

      // 2. the live DOM, after the islands have mounted
      await page.goto(path);
      await scrollThrough(page);
      await openAllDetails(page);
      const hrefs = await page.$$eval('a[href]', (as) =>
        as.map((a) => (a as HTMLAnchorElement).getAttribute('href') ?? ''),
      );
      const external = [...new Set(hrefs.filter((h) => /^https?:\/\//i.test(h)))];
      const internal = [
        ...new Set(
          hrefs
            .filter(
              (h) => h && !/^(https?:|mailto:|tel:|javascript:)/i.test(h) && !h.startsWith('#'),
            )
            .map((h) => new URL(h, page.url()))
            .filter((u) => u.origin === new URL(baseURL!).origin)
            .map((u) => u.origin + u.pathname + u.search),
        ),
      ];
      const badExternal = external
        .map((h) => [h, malformedAddress(h)] as const)
        .filter(([, why]) => why)
        .map(([h, why]) => `${why} : ${JSON.stringify(h).slice(0, 140)}`);
      expect(badExternal, `${badExternal.length} lien(s) externe(s) mal formé(s)`).toEqual([]);

      const dead: string[] = [];
      for (const u of internal) {
        const status = await statusOf(request, u);
        if (status !== 200) dead.push(`${status} ${u}`);
      }
      expect(dead, `${dead.length} lien(s) interne(s) cassé(s)`).toEqual([]);
    });
  }
});
