/**
 * rehype plugin for `docs/METHODE.md` (rendered by pages/methode.astro). Plain hast, no dependency.
 *
 *   - drops the first <h1> (the page has its own hero);
 *   - `## Titre {#id}` → stable heading ids (#calcul, #registre, #openfisca…);
 *   - hypothesis rows `| H12 | … |` of the register get `id="h12"` and a self-link: one stable anchor
 *     per hypothesis (#h1, #h2…), which the simulator deep-links to;
 *   - tables become focusable, labelled, horizontally scrollable regions;
 *   - site-relative links (`/simulateur/`) get the base path;
 *   - French typography on every text node (lib/typo.ts);
 *   - first use of each acronym in a section → glossary toggletip (same markup as <GlossaryTerm>).
 */
import { readFileSync } from 'node:fs';
import { typo } from './typo.ts';

const glossary = JSON.parse(
  readFileSync(new URL('../data/glossaire.json', import.meta.url), 'utf8'),
);

/** Visible text → glossary id. Acronyms are case-sensitive; phrases are matched as written. */
const AUTO_TERMS = [
  ['AFU', 'afu'],
  ['CSG', 'csg'],
  ['CRDS', 'crds'],
  ['RSA', 'rsa'],
  ['AAH', 'aah'],
  ['ASPA', 'aspa'],
  ['APL', 'aides-logement'],
  ['CMG', 'cmg'],
  ['PAJE', 'paje'],
  ['ASF', 'asf'],
  ['AEEH', 'aeeh'],
  ['CEE', 'cee'],
  ['TVA', 'tva'],
  ['ARE', 'are'],
  ['RGDU', 'rgdu'],
  ['CNRACL', 'cnracl'],
  ['CMI', 'cmi'],
  ['BMAF', 'bmaf'],
  ['prime d’activité', 'prime-activite'],
  ["prime d'activité", 'prime-activite'],
  ['quotient familial', 'quotient-familial'],
  ['décote', 'decote'],
  ['taux marginal', 'taux-marginal'],
  ['revenu disponible', 'revenu-disponible'],
  ['revenu net imposable', 'revenu-net-imposable'],
  ['bouclier sanitaire', 'bouclier-sanitaire'],
  ['compte éducation', 'compte-education'],
  ['foyer fiscal', 'foyer-fiscal'],
];

const entryOf = (id) => {
  for (const [key, v] of Object.entries(glossary)) {
    if (key === id) return { id, ...v };
  }
  return undefined;
};

const el = (tagName, properties = {}, children = []) => ({
  type: 'element',
  tagName,
  properties,
  children,
});
const text = (value) => ({ type: 'text', value });
const textOf = (node) =>
  node.type === 'text' ? node.value : (node.children ?? []).map(textOf).join('');

const SKIP = new Set(['code', 'a', 'button', 'h1', 'h2', 'h3', 'h4', 'th', 'pre']);

export function rehypeMethode(options = {}) {
  const base = (options.base ?? '/').replace(/\/?$/, '/');
  const withBase = (href) =>
    href.startsWith('/') && !href.startsWith('//') ? `${base}${href.slice(1)}` : href;

  const patterns = AUTO_TERMS.map(([visible, id]) => ({
    id,
    re: new RegExp(
      `(?<![\\p{L}\\d])${visible.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}(?![\\p{L}\\d])`,
      'u',
    ),
    visible,
  })).filter((p) => entryOf(p.id));

  return (tree) => {
    let n = 0;
    let seen = new Set();
    let section = '';

    const termNode = (id, shown) => {
      const e = entryOf(id);
      n += 1;
      const uid = `gloss-${id}-${n}`;
      const href = e.href ? withBase(e.href) : undefined;
      const props = {
        type: 'button',
        className: ['gloss-btn'],
        'aria-expanded': 'false',
        'aria-controls': uid,
        'data-term': typo(e.term),
        'data-definition': typo(e.definition),
        title: `${typo(e.term)} : ${typo(e.definition)}`,
      };
      if (href) props['data-href'] = href;
      return el('span', { className: ['gloss'], 'data-gloss': id }, [
        el('button', props, [
          text(shown),
          el('span', { className: ['sr-only'] }, [text(' (définition)')]),
        ]),
        el('span', { id: uid, className: ['gloss-live'], role: 'status' }),
      ]);
    };

    /** Split one text value into text / glossary nodes (first use per section only). */
    const withTerms = (value) => {
      let pieces = [value];
      for (const { id, re, visible } of patterns) {
        if (seen.has(id)) continue;
        const next = [];
        let done = false;
        for (const piece of pieces) {
          if (done || typeof piece !== 'string') {
            next.push(piece);
            continue;
          }
          const m = re.exec(piece);
          if (!m) {
            next.push(piece);
            continue;
          }
          done = true;
          seen.add(id);
          if (m.index > 0) next.push(piece.slice(0, m.index));
          next.push(termNode(id, visible));
          const rest = piece.slice(m.index + visible.length);
          if (rest) next.push(rest);
        }
        pieces = next;
      }
      return pieces.map((p) => (typeof p === 'string' ? text(p) : p));
    };

    const walk = (node, parent, index, inSkip) => {
      if (node.type === 'text') {
        const value = typo(node.value);
        if (inSkip) {
          node.value = value;
          return;
        }
        const pieces = withTerms(value);
        if (pieces.length === 1) {
          node.value = value;
          return;
        }
        parent.children.splice(index, 1, ...pieces);
        return;
      }
      if (node.type !== 'element') {
        for (let i = 0; i < (node.children ?? []).length; i += 1) {
          walk(node.children[i], node, i, inSkip);
        }
        return;
      }
      const tag = node.tagName;
      const props = node.properties ?? (node.properties = {});

      if (tag === 'h2') {
        seen = new Set();
        const last = node.children[node.children.length - 1];
        if (last?.type === 'text') {
          const m = /\s*\{#([\w-]+)\}\s*$/.exec(last.value);
          if (m) {
            props.id = m[1];
            last.value = last.value.slice(0, m.index);
          }
        }
        section = textOf(node);
      }
      if (tag === 'a' && typeof props.href === 'string') props.href = withBase(props.href);
      if (tag === 'tr') {
        const first = node.children.find((c) => c.type === 'element' && c.tagName === 'td');
        const label = first ? textOf(first).trim() : '';
        if (/^H\d+$/.test(label)) {
          const id = label.toLowerCase();
          props.id = id;
          first.children = [
            el(
              'a',
              { href: `#${id}`, className: ['h-anchor'], 'aria-label': `Lien vers ${label}` },
              [text(label)],
            ),
          ];
          // Visible number stays short; link is the cell content.
        }
      }

      const skipChildren = inSkip || SKIP.has(tag);
      for (let i = 0; i < node.children.length; i += 1) {
        const before = node.children.length;
        walk(node.children[i], node, i, skipChildren);
        if (node.children.length !== before) i += node.children.length - before;
      }

      if (tag === 'table') {
        const cls = Array.isArray(props.className) ? props.className : [];
        props.className = [...cls, 'data-table', 'methode-table'];
      }
    };

    // First pass: drop the first h1, then transform.
    const h1 = tree.children.findIndex((c) => c.type === 'element' && c.tagName === 'h1');
    if (h1 >= 0) tree.children.splice(h1, 1);
    for (let i = 0; i < tree.children.length; i += 1) {
      const before = tree.children.length;
      walk(tree.children[i], tree, i, false);
      if (tree.children.length !== before) i += tree.children.length - before;
    }

    // Wrap tables (after the walk so labels know their section).
    let current = '';
    const wrapped = [];
    for (const child of tree.children) {
      if (child.type === 'element' && child.tagName === 'h2') current = textOf(child);
      if (child.type === 'element' && child.tagName === 'table') {
        wrapped.push(
          el(
            'div',
            {
              className: ['table-scroll'],
              role: 'region',
              tabIndex: 0,
              'aria-label': `Tableau : ${current || section}`.replace(/\s+/g, ' '),
            },
            [child],
          ),
        );
      } else wrapped.push(child);
    }
    tree.children = wrapped;
  };
}
