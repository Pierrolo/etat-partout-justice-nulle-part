import * as Plot from '@observablehq/plot';
import { useEffect, useRef, useState } from 'react';
import { plotCss, plotDefaults } from '@/lib/chart-theme';

export interface PlotFigureProps {
  /**
   * Plot options, or a function of the available width (px) — use the function form to adapt
   * margins / label placement on phones. Must be referentially stable (module constant or useMemo).
   */
  options: Plot.PlotOptions | ((width: number) => Plot.PlotOptions);
  /** Short accessible name of the chart. */
  label: string;
  /** Longer description (aria-description); the visible summary lives in ChartFrame. */
  description?: string;
  /** Called with the rendered <svg>/<figure> right after each render (add hatch patterns, tooltips…). */
  onRender?: (el: SVGSVGElement | HTMLElement) => void;
  /** Fixed height; omit to let Plot decide from its marks. */
  height?: number;
  className?: string;
}

/**
 * Renders an Observable Plot chart client-side, responsive to its container width, with the
 * project theme (`plotDefaults`) pre-applied. Use inside `ChartFrame` and hydrate with
 * `client:visible`. Without JavaScript the surrounding ChartFrame still provides summary + data table.
 */
export function PlotFigure({
  options,
  label,
  description,
  onRender,
  height,
  className,
}: PlotFigureProps) {
  const host = useRef<HTMLDivElement>(null);
  const [width, setWidth] = useState(0);

  useEffect(() => {
    const el = host.current;
    if (!el) return;
    const ro = new ResizeObserver(([entry]) => {
      if (entry) setWidth(Math.floor(entry.contentRect.width));
    });
    ro.observe(el);
    setWidth(Math.floor(el.getBoundingClientRect().width));
    return () => ro.disconnect();
  }, []);

  useEffect(() => {
    const el = host.current;
    if (!el || width < 120) return;
    const resolved = typeof options === 'function' ? options(width) : options;
    const chart = Plot.plot({
      ...plotDefaults(),
      className: 'epjn-plot',
      width,
      ...(height ? { height } : {}),
      ...resolved,
      ariaLabel: label,
      ariaDescription: description,
    } as Plot.PlotOptions);
    const style = document.createElement('style');
    style.textContent = plotCss;
    chart.prepend(style);
    el.replaceChildren(chart);
    onRender?.(chart);
    return () => chart.remove();
  }, [options, width, label, description, height, onRender]);

  return <div ref={host} className={className} style={{ minHeight: height ?? 160 }} />;
}
