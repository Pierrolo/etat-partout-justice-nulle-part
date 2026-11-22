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
  it('range chacun des 109 événements dans un couloir connu', () => {
    expect(events).toHaveLength(109);
    expect(events.every((e) => LANE_IDS.includes(e.lane))).toBe(true);
    const total = LANE_IDS.reduce((n, l) => n + events.filter((e) => e.lane === l).length, 0);
    expect(total).toBe(109);
  });

  it('isole la TVA, les accises et les certificats d’économies d’énergie', () => {
    const tva = events.filter((e) => e.lane === 'tva');
    expect(tva.length).toBeGreaterThanOrEqual(6);
    // alimentation à 20 % au 1er juillet 2030
    expect(tva.some((e) => e.date === '2030-07-01' && /Alimentation à 20 %/.test(e.label))).toBe(
      true,
    );
    // TVA, accises, douanes au 1er juillet 2027 (IV.D de l'amendement n° 1)
    expect(tva.some((e) => e.date === '2027-07-01' && /TVA, accises/.test(e.label))).toBe(true);
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
    expect(groups.reduce((n, g) => n + g.events.length, 0)).toBe(109);
    const dates = groups.map((g) => g.date);
    expect([...dates].sort()).toEqual(dates);
    expect(groups.find((g) => g.date === '2027-07-01')?.jalon?.title).toBeTruthy();
    expect(jalonsInFrise(jalons).length).toBe(jalons.length - 1); // 2051 est hors frise
  });

  it('n’affiche que les événements de la fenêtre 2027–2030 sur la frise', () => {
    const marks = laneMarkers(events);
    expect(marks.reduce((n, m) => n + m.events.length, 0)).toBe(105);
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

describe('calendrier-model: version de novembre 2026', () => {
  it('date chaque nature de crédit de l’état B : 1er janvier, 1er avril et 1er juillet 2027', () => {
    const etatB = events.filter((e) => e.label.startsWith('Crédits retirés à compter du'));
    expect(etatB.map((e) => e.date)).toEqual(['2027-01-01', '2027-04-01', '2027-07-01']);
    // 23 missions : l'hébergement d'urgence (1er avril) ne concerne que la mission « Cohésion des territoires »
    expect(etatB[0]!.amendments.length).toBeGreaterThan(18);
    expect(etatB[1]!.amendments).toEqual([{ liasse: 'PLF-P2', number: 1 }]);
    expect(etatB[2]!.amendments.length).toBeGreaterThan(15);
    expect(events.some((e) => e.date === '2027-04-01' && e.amendments[0]!.number === 33)).toBe(
      true,
    );
  });

  it('lit « janvier 2027 » pour le crédit d’impôt famille (n° 12) et « avril 2027 » pour l’hébergement (n° 33)', () => {
    const n12 = events.find((e) =>
      e.amendments.some((a) => a.liasse === 'PLF-P1' && a.number === 12),
    )!;
    expect(n12.date).toBe('2027-01-01');
    const n33 = events.find((e) =>
      e.amendments.some((a) => a.liasse === 'PLF-P2' && a.number === 33),
    )!;
    expect(n33.date).toBe('2027-04-01');
  });

  it('ajoute le jalon d’avril 2027 et lit 2051 comme la dernière année de la minoration', () => {
    expect(jalons.map((j) => j.date)).toContain('2027-04-01');
    const last = jalons[jalons.length - 1]!;
    expect(last.date).toBe('2051-01-01');
    expect(last.title).toMatch(/Dernière année de la minoration/);
    expect(last.summary).toMatch(/revenus de 2051/);
  });

  it('renvoie chaque événement à la page du PDF qui contient sa citation', () => {
    for (const e of events) expect(e.url, e.id).toMatch(/#page=\d+$/);
    const n28 = events.find((e) => e.date === '2051-01-01')!;
    expect(n28.url).toMatch(/Liasse_PLF_P1\.pdf#page=7[678]$/);
  });
});
