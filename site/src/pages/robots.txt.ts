/**
 * robots.txt, with the absolute sitemap URL when the site origin is known (SITE_URL at build time).
 * `/styleguide/` stays crawlable on purpose: it carries `noindex`, which crawlers can only honour if they read it,
 * and it is left out of the sitemap.
 */
import type { APIRoute } from 'astro';

export const GET: APIRoute = ({ site }) => {
  const lines = ['User-agent: *', 'Allow: /'];
  if (site) {
    const base = import.meta.env.BASE_URL.replace(/\/?$/, '/');
    lines.push('', `Sitemap: ${new URL(`${base}sitemap-index.xml`, site).href}`);
  }
  return new Response(`${lines.join('\n')}\n`, {
    headers: { 'Content-Type': 'text/plain; charset=utf-8' },
  });
};
