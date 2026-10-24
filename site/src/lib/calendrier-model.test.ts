import { describe, expect, it } from 'vitest';
import calendrier from '@/data/calendrier.json';
import { formatDateFr, formatDayMonthFr } from './dates';
import {
  FRISE_END,
  FRISE_START,
  LANES,
  LANE_IDS,
  PANEL_CONFIG,
  PANEL_ORDER,
  assignSubRows,
  frisePosition,
  groupByDate,
  jalonsInFrise,
  laneMarkers,
  markerDiameter,
  onSeries,
  stepPoints,
  toEvents,
  toJalons,
  toPanel,
  type RawEvent,
  type RawJalon,
  type RawTrajectory,
} from './calendrier-model';

const events = toEvents(calendrier.events as unknown as RawEvent[]);
const jalons = toJalons(calendrier.jalons as unknown as RawJalon[]);

describe('calendrier-model: couloirs', () => {
  it('range chacun des 104 événements dans un couloir connu', () => {
    expect(events).toHaveLength(104);
    expect(events.every((e) => LANE_IDS.includes(e.lane))).toBe(true);
    const total = LANE_IDS.reduce((n, l) => n + events.filter((e) => e.lane === l).length, 0);
    expect(total).toBe(104);
  });

  it('isole la TVA, les accises et les certificats d’économies d’énergie', () => {
    const tva = events.filter((e) => e.lane === 'tva');
    expect(tva.length).toBeGreaterThanOrEqual(6);
    expect(tva.some((e) => e.id === 'cal_102')).toBe(true); // alimentation à 20 %
    expect(tva.some((e) => e.id === 'cal_040')).toBe(true); // TVA, accises, douanes au 1er juillet 2027
  });

  it('donne à chaque couloir une couleur distincte et un texte lisible dessus', () => {
    const colors = LANE_IDS.map((l) => LANES[l].color);
    expect(new Set(colors).size).toBe(LANE_IDS.length);
    expect(onSeries(0)).toBe('var(--on-series-1)');
  });
});

describe('calendrier-model: dates', () => {
  it('place la frise de 2027 à 2030 et regroupe par date', () => {
    expect(frisePosition(FRISE_START)).toBe(0);
    expect(frisePosition(FRISE_END)).toBe(1);
    const groups = groupByDate(events, jalons);
    expect(groups.reduce((n, g) => n + g.events.length, 0)).toBe(104);
    const dates = groups.map((g) => g.date);
    expect([...dates].sort()).toEqual(dates);
    expect(groups.find((g) => g.date === '2027-07-01')?.jalon?.title).toBeTruthy();
    expect(jalonsInFrise(jalons).length).toBe(jalons.length - 1); // 2051 est hors frise
  });

  it('n’affiche que les événements de la fenêtre 2027–2030 sur la frise', () => {
    const marks = laneMarkers(events);
    expect(marks.reduce((n, m) => n + m.events.length, 0)).toBe(100);
    expect(marks.every((m) => m.date >= FRISE_START && m.date < FRISE_END)).toBe(true);
  });

  it('écrit les dates en français, « 1er » compris', () => {
    expect(formatDateFr('2027-07-01')).toBe('1er juillet 2027');
    expect(formatDateFr('2026-12-31')).toBe('31 décembre 2026');
    expect(formatDayMonthFr('2027-01-01')).toBe('1er janv.');
    expect(formatDayMonthFr('2027-12-31')).toBe('31 déc.');
  });
});

describe('calendrier-model: pastilles', () => {
  it('grossit avec le nombre de mesures, sans excès', () => {
    expect(markerDiameter(1)).toBe(14);
    expect(markerDiameter(2)).toBeGreaterThan(14);
    expect(markerDiameter(33)).toBeLessThanOrEqual(34);
  });

  it('répartit en sous-lignes les pastilles qui se recouvriraient', () => {
    expect(
      assignSubRows([
        { x: 0, d: 20 },
        { x: 100, d: 20 },
      ]),
    ).toEqual([0, 0]);
    expect(
      assignSubRows([
        { x: 0, d: 20 },
        { x: 10, d: 20 },
        { x: 20, d: 20 },
      ]),
    ).toEqual([0, 1, 2]);
    const rows = assignSubRows([
      { x: 50, d: 20 },
      { x: 0, d: 20 },
      { x: 55, d: 20 },
    ]);
    expect(rows[1]).toBe(0); // la plus à gauche prend la première ligne
    expect(new Set([rows[0], rows[2]]).size).toBe(2); // deux voisines ne partagent pas la ligne
  });
});

describe('calendrier-model: trajectoires', () => {
  const raw = calendrier.trajectoires as unknown as RawTrajectory[];

  it('configure un graphique pour chaque trajectoire affichée', () => {
    const shown = [...PANEL_ORDER.taux, ...PANEL_ORDER.part];
    expect(shown).toHaveLength(9);
    for (const id of shown) {
      expect(PANEL_CONFIG[id]).toBeDefined();
      expect(raw.some((t) => t.id === id)).toBe(true);
    }
  });

  it('lit la trajectoire CSG/CRDS : 9,7 puis six paliers jusqu’à zéro', () => {
    const csg = toPanel(raw.find((t) => t.id === 'csg_crds_activite_2027')!);
    expect(csg.steps.map((s) => s.value)).toEqual([9.7, 8.1, 6.5, 4.8, 3.2, 1.6, 0]);
    expect(csg.extra?.[1]).toEqual({ from: '2027-07-01', csg: 7.6, crds: 0.5 });
    const pts = stepPoints(csg);
    expect(pts[0]!.date).toBe('2027-01-01');
    expect(pts.at(-1)!.date).toBe('2028-01-01');
    expect(pts.at(-1)!.value).toBe(0);
  });

  it('signale le palier de départ déduit (non écrit dans la loi) et le ramène au début de la fenêtre', () => {
    const tva = toPanel(raw.find((t) => t.id === 'tva_alimentation')!);
    expect(tva.steps[0]!.hypothesis).toBe(true);
    const pts = stepPoints(tva);
    expect(pts[0]).toMatchObject({ date: '2027-01-01', value: 5.5, hypothesis: true });
    expect(pts.map((p) => p.value)).toEqual([5.5, 10, 15, 20, 20]);
  });

  it('garde le tiers, les deux tiers puis zéro pour les avantages réduits par étapes', () => {
    const apl = toPanel(raw.find((t) => t.id === 'apl_parc_conventionne')!);
    expect(apl.steps.map((s) => s.value)).toEqual([100, 66.67, 33.33, 0]);
    expect(apl.steps.every((s) => s.value >= 0 && s.value <= apl.yMax)).toBe(true);
  });
});
