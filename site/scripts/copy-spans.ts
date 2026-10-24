/**
 * Finds the COPY (text a visitor can read) in source files, and nothing else: JSX/Astro text nodes and
 * the string literals / template chunks / attribute strings that carry prose. Never identifiers, import
 * paths, class names, URLs, CSS or script blocks.
 *
 * Shared by `typo-fix.mjs` (the French typography codemod) and by the facts-discipline unit test
 * (`src/lib/facts-discipline.test.ts`).
 *
 *   const { spans, problems } = copySpans(source, 'pages/index.astro');
 *   // spans: [{ start, end, kind, quote, raw }]  — offsets into `source`, `raw` = source.slice(start, end)
 *
 * Plain TypeScript without enums or parameter properties, so that `node` runs it directly.
 */
import ts from 'typescript';

export interface Span {
  start: number;
  end: number;
  kind: 'jsxtext' | 'string' | 'template';
  quote?: string;
  raw: string;
}
export interface CopyResult {
  spans: Span[];
  problems: string[];
}

/** Attributes that never carry prose (code, URLs, ids, styling, geometry, behaviour). */
const NOT_COPY_ATTR =
  /^(class|className|class:list|id|for|htmlFor|key|ref|href|src|srcSet|srcset|action|method|type|name|role|style|d|viewBox|transform|fill|stroke|strokeDasharray|points|x|y|x1|x2|y1|y2|cx|cy|r|rx|ry|width|height|fontWeight|fontSize|fontFamily|fontStyle|textAnchor|dominantBaseline|letterSpacing|opacity|strokeWidth|strokeLinecap|strokeLinejoin|dy|dx|preserveAspectRatio|clipPath|mask|filter|rel|target|slot|lang|charset|media|as|crossorigin|crossOrigin|loading|decoding|tabindex|tabIndex|autocomplete|autoComplete|inputMode|inputmode|pattern|min|max|step|value|defaultValue|download|sizes|is:.*|client:.*|set:.*|define:vars|data-.*|aria-(controls|labelledby|describedby|live|expanded|pressed|current|haspopup|orientation|sort|hidden|selected|checked|disabled|modal|atomic|relevant|busy|owns|activedescendant|level|posinset|setsize|valuemin|valuemax|valuenow|autocomplete|multiselectable|readonly|required|invalid))$/;

const SKIP_PARENT = new Set([
  ts.SyntaxKind.ImportDeclaration,
  ts.SyntaxKind.ExportDeclaration,
  ts.SyntaxKind.ExternalModuleReference,
  ts.SyntaxKind.ImportType,
  ts.SyntaxKind.LiteralType,
  ts.SyntaxKind.ModuleDeclaration,
  ts.SyntaxKind.ImportAttribute,
]);

/** Regexp-looking or code-looking strings are never copy. */
const CODE_LIKE = /^\d+$|\\[sdwbSDWB]|\(\?[:=!<]|\[\^|^\s*[#.]?[\w-]+\s*[{(]|^https?:|^\/[\w./-]*$|^[\w-]+\.(?:json|mjs|css|png|svg|woff2?)$/;

function attrNameOf(node: ts.Node): string | null {
  for (let n = node; n; n = n.parent) {
    if (ts.isJsxAttribute(n)) {
      const nm = n.name;
      return ts.isJsxNamespacedName(nm) ? `${nm.namespace.text}:${nm.name.text}` : nm.text;
    }
    if (ts.isJsxElement(n) || ts.isJsxSelfClosingElement(n) || ts.isJsxFragment(n)) return null;
    if (ts.isSourceFile(n)) return null;
  }
  return null;
}

function inTagged(node: ts.Node): boolean {
  for (let n = node.parent; n; n = n.parent) {
    if (ts.isTaggedTemplateExpression(n)) return true;
    if (ts.isStatement(n)) return false;
  }
  return false;
}

/** Spans of copy in one TS/TSX source text. `offset` shifts every span (used for Astro blocks). */
function tsSpans(text: string, kind: ts.ScriptKind, offset: number, out: CopyResult): readonly ts.Diagnostic[] {
  const sf = ts.createSourceFile('x.tsx', text, ts.ScriptTarget.Latest, true, kind);
  const push = (start: number, end: number, k: Span['kind'], quote?: string) => {
    if (end <= start) return;
    out.spans.push({ start: start + offset, end: end + offset, kind: k, quote, raw: text.slice(start, end) });
  };
  const visit = (node: ts.Node): void => {
    switch (node.kind) {
      case ts.SyntaxKind.JsxText:
        if (!(node as ts.JsxText).containsOnlyTriviaWhiteSpaces) push(node.pos, node.end, 'jsxtext');
        break;
      case ts.SyntaxKind.StringLiteral: {
        if (SKIP_PARENT.has(node.parent.kind)) break;
        if (ts.isPropertyAssignment(node.parent) && node.parent.name === node) break;
        if (ts.isPropertySignature(node.parent) || ts.isElementAccessExpression(node.parent)) break;
        const attr = attrNameOf(node);
        if (attr && NOT_COPY_ATTR.test(attr)) break;
        const raw = text.slice(node.getStart() + 1, node.end - 1);
        if (CODE_LIKE.test(raw)) break;
        push(node.getStart() + 1, node.end - 1, 'string', text[node.getStart()]);
        break;
      }
      case ts.SyntaxKind.NoSubstitutionTemplateLiteral:
        if (inTagged(node)) break;
        if (CODE_LIKE.test(text.slice(node.getStart() + 1, node.end - 1))) break;
        {
          const attr = attrNameOf(node);
          if (attr && NOT_COPY_ATTR.test(attr)) break;
        }
        push(node.getStart() + 1, node.end - 1, 'template', '`');
        break;
      case ts.SyntaxKind.TemplateHead:
      case ts.SyntaxKind.TemplateMiddle:
      case ts.SyntaxKind.TemplateTail: {
        if (inTagged(node.parent)) break;
        const attr = attrNameOf(node);
        if (attr && NOT_COPY_ATTR.test(attr)) break;
        const s = node.getStart() + 1;
        const e = node.kind === ts.SyntaxKind.TemplateTail ? node.end - 1 : node.end - 2;
        if (CODE_LIKE.test(text.slice(s, e))) break;
        push(s, e, 'template', '`');
        break;
      }
      default:
    }
    ts.forEachChild(node, visit);
  };
  visit(sf);
  return (sf as unknown as { parseDiagnostics?: readonly ts.Diagnostic[] }).parseDiagnostics ?? [];
}

/** Same-length blanking of regions that must never be scanned (keeps newlines and offsets). */
function blank(text: string, re: RegExp): string {
  return text.replace(re, (m) => m.replace(/[^\n]/g, ' '));
}

/** `filename` decides the parser: .astro, .tsx or .ts. */
export function copySpans(source: string, filename: string): CopyResult {
  const out: CopyResult = { spans: [], problems: [] };
  if (/\.astro$/.test(filename)) {
    const m = /^---\r?\n([\s\S]*?)\r?\n---/.exec(source);
    let templateStart = 0;
    if (m) {
      const body = m[1] ?? '';
      const fmStart = m[0].indexOf(body);
      const diags = tsSpans(body, ts.ScriptKind.TS, fmStart, out);
      if (diags.length) out.problems.push(`frontmatter: ${diags.length} parse error(s)`);
      templateStart = m[0].length;
    }
    let tpl = source.slice(templateStart);
    // Raw blocks and comments are not copy.
    tpl = blank(tpl, /<script\b[\s\S]*?<\/script>/g);
    tpl = blank(tpl, /<style\b[\s\S]*?<\/style>/g);
    tpl = blank(tpl, /<!--[\s\S]*?-->/g);
    tpl = blank(tpl, /<!doctype[^>]*>/gi);
    const head = 'const __t = (<>';
    const wrapped = `${head}${tpl}</>);`;
    const before = out.spans.length;
    const diags = tsSpans(wrapped, ts.ScriptKind.TSX, templateStart - head.length, out);
    if (diags.length) {
      out.problems.push(
        `template: ${diags.length} parse error(s), e.g. ${ts.flattenDiagnosticMessageText(diags[0]?.messageText ?? '', ' ')}`,
      );
      // Do not trust partial results of a broken parse.
      out.spans.length = before;
    }
  } else {
    const kind = /\.tsx$/.test(filename) ? ts.ScriptKind.TSX : ts.ScriptKind.TS;
    const diags = tsSpans(source, kind, 0, out);
    if (diags.length) out.problems.push(`${diags.length} parse error(s)`);
  }
  out.spans.sort((a, b) => a.start - b.start);
  return out;
}
