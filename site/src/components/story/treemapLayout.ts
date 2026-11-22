import { hierarchy, treemap, treemapSquarify } from 'd3';
import type { CofogNode } from '@/lib/story-shared';

/**
 * Two layouts of the same view — one for wide screens, one for phones — so the HTML tiles can be
 * placed in percentages and switched by a CSS media query: no JavaScript measurement, the first
 * paint is already correct (and the chart is readable without JavaScript).
 */
export interface Box {
  x: number;
  y: number;
  w: number;
  h: number;
}
export interface Placed {
  node: CofogNode;
  /** 1 = tile or group box, 2 = tile inside a group box */
  depth: 1 | 2;
  /** Has visible children: this box is a group with a header strip. */
  grouped: boolean;
  box: Box; // in % of the container
  /** Enough room for the label / for the label and the value. */
  fit: { label: boolean; value: boolean };
}

const W = 1000;
const H = 560;
/** Reference width in px of the chart on wide screens (the layout adapts by %, flags are heuristics). */
const REF_W = 940;
const PAD_PX = 30;

const visibleKids = (n: CofogNode) => (n.children ?? []).filter((c) => c.value > 0);

/** The view rooted at `root`: its children, and their children when there are several. */
function viewTree(root: CofogNode): CofogNode {
  const kids = visibleKids(root).map((k) => {
    const grandkids = visibleKids(k);
    return grandkids.length > 1
      ? { ...k, children: grandkids.map((g) => ({ ...g, children: undefined })) }
      : { ...k, children: undefined };
  });
  return { ...root, children: kids };
}

export function layoutView(root: CofogNode): Placed[] {
  const tree = viewTree(root);
  const padUnits = (PAD_PX / REF_W) * W; // header strip, in layout units
  const h = hierarchy<CofogNode>(tree, (n) => n.children)
    .sum((n) => (n.children ? 0 : n.value))
    .sort((a, b) => (b.value ?? 0) - (a.value ?? 0));
  const laid = treemap<CofogNode>()
    .size([W, H])
    .paddingTop((n) => (n.depth === 1 && n.children ? padUnits : 0))
    .paddingInner(0)
    .round(false)
    .tile(treemapSquarify.ratio(1.15))(h);
  const containerH = (REF_W * H) / W;
  const out: Placed[] = [];
  laid.each((n) => {
    if (n.depth === 0) return;
    const wpx = ((n.x1 - n.x0) / W) * REF_W;
    const hpx = ((n.y1 - n.y0) / H) * containerH;
    const label = wpx >= 64 && hpx >= 34;
    out.push({
      node: n.data,
      depth: n.depth as 1 | 2,
      grouped: !!n.children,
      box: {
        x: (n.x0 / W) * 100,
        y: (n.y0 / H) * 100,
        w: ((n.x1 - n.x0) / W) * 100,
        h: ((n.y1 - n.y0) / H) * 100,
      },
      fit: { label, value: label && hpx >= 54 },
    });
  });
  return out;
}
