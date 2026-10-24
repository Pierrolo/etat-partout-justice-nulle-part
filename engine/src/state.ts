/**
 * URL-hash state: 'v1.' + base64url(JSON of a compact positional array). Versioned, ASCII-only, robust to garbage
 * (decodeState returns null on anything that is not a valid v1 payload). Optional fields round-trip exactly:
 * an absent optional field is encoded as null and decoded as absent.
 */
import type {
  Activity,
  Adult,
  Child,
  Disability,
  Household,
  HousingStatus,
  Hypotheses,
  Period,
  SalaryStatus,
} from './types.ts';

const ACT: Activity[] = ['salarie', 'chomage', 'retraite', 'etudiant', 'inactif'];
const STA: SalaryStatus[] = ['prive', 'cadre', 'fonctionnaire'];
const DIS: Disability[] = ['none', 'aah_80', 'aah_50_79'];
const HOU: HousingStatus[] = ['locataire', 'proprietaire', 'proprietaire_credit', 'gratuit'];
const CARE = ['parent', 'creche', 'assistante_maternelle'] as const;

const B64 = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789-_';

function b64urlEncode(ascii: string): string {
  let out = '';
  for (let i = 0; i < ascii.length; i += 3) {
    const a = ascii.charCodeAt(i);
    const b = i + 1 < ascii.length ? ascii.charCodeAt(i + 1) : NaN;
    const c = i + 2 < ascii.length ? ascii.charCodeAt(i + 2) : NaN;
    const n = (a << 16) | ((Number.isNaN(b) ? 0 : b) << 8) | (Number.isNaN(c) ? 0 : c);
    out += B64[(n >> 18) & 63]! + B64[(n >> 12) & 63]!;
    if (!Number.isNaN(b)) out += B64[(n >> 6) & 63]!;
    if (!Number.isNaN(c)) out += B64[n & 63]!;
  }
  return out;
}

function b64urlDecode(s: string): string | null {
  if (!/^[A-Za-z0-9_-]*$/.test(s) || s.length % 4 === 1) return null;
  let out = '';
  for (let i = 0; i < s.length; i += 4) {
    const chunk = s.slice(i, i + 4);
    const v = [...chunk].map((ch) => B64.indexOf(ch));
    const n = ((v[0] ?? 0) << 18) | ((v[1] ?? 0) << 12) | ((v[2] ?? 0) << 6) | (v[3] ?? 0);
    out += String.fromCharCode((n >> 16) & 255);
    if (chunk.length > 2) out += String.fromCharCode((n >> 8) & 255);
    if (chunk.length > 3) out += String.fromCharCode(n & 255);
  }
  return out;
}

const opt = <T>(x: T | undefined): T | null => (x === undefined ? null : x);
const bit = (x: boolean | undefined): 0 | 1 | null => (x === undefined ? null : x ? 1 : 0);

function encAdult(a: Adult): unknown[] {
  return [
    a.age,
    ACT.indexOf(a.activity),
    a.salary
      ? [
          a.salary.amount,
          a.salary.basis === 'brut' ? 1 : 0,
          STA.indexOf(a.salary.status),
          opt(a.salary.workRatio),
        ]
      : null,
    a.unemployment ? [a.unemployment.areMonthly] : null,
    a.pension ? [a.pension.amount, a.pension.basis === 'brut' ? 1 : 0, a.pension.startYear] : null,
    DIS.indexOf(a.disability),
  ];
}

export function encodeState(h: Household, hyp: Hypotheses, period: Period): string {
  const ex = h.extras;
  const payload = [
    1,
    [
      h.adults.map(encAdult),
      h.marriedOrPacs ? 1 : 0,
      h.children.map((c) => [c.age, bit(c.aeeh), bit(c.cmiInvalidite)]),
      [HOU.indexOf(h.housing.status), opt(h.housing.rentMonthly), opt(h.housing.zone)],
      [
        h.benefits.nonRecours ? 1 : 0,
        opt(h.benefits.cafOverrideMonthly),
        bit(h.benefits.isolementRecent),
      ],
      ex
        ? [
            ex.childcare === undefined ? null : CARE.indexOf(ex.childcare),
            opt(ex.childcareCostMonthly),
            opt(ex.emploiDomicileAnnual),
            opt(ex.donsAnnual),
            opt(ex.consumptionMonthly),
          ]
        : null,
    ],
    [
      hyp.H1_benefits === 'differential' ? 1 : 0,
      hyp.H2_fraisPro10 ? 1 : 0,
      hyp.H5_tvaPassThrough,
      hyp.includeTva ? 1 : 0,
    ],
    period === 'steady' ? 's' : period,
  ];
  return `v1.${b64urlEncode(JSON.stringify(payload))}`;
}

// ------------------------------------------------------------------------------------------------ decode
class Bad extends Error {}
const fail = (): never => {
  throw new Bad();
};
const arr = (x: unknown, len?: number): unknown[] =>
  Array.isArray(x) && (len === undefined || x.length === len) ? x : fail();
const num = (x: unknown): number => (typeof x === 'number' && Number.isFinite(x) ? x : fail());
const optNum = (x: unknown): number | undefined => (x === null ? undefined : num(x));
const idx = <T>(list: readonly T[], x: unknown): T => {
  const i = num(x);
  return Number.isInteger(i) && i >= 0 && i < list.length ? list[i]! : fail();
};
const optBit = (x: unknown): boolean | undefined =>
  x === null ? undefined : x === 1 ? true : x === 0 ? false : fail();
const flag = (x: unknown): boolean => (x === 1 ? true : x === 0 ? false : fail());

function decAdult(x: unknown): Adult {
  const a = arr(x, 6);
  const out: Adult = { age: num(a[0]), activity: idx(ACT, a[1]), disability: idx(DIS, a[5]) };
  if (a[2] !== null) {
    const s = arr(a[2], 4);
    out.salary = { amount: num(s[0]), basis: flag(s[1]) ? 'brut' : 'net', status: idx(STA, s[2]) };
    const wr = optNum(s[3]);
    if (wr !== undefined) out.salary.workRatio = wr;
  }
  if (a[3] !== null) out.unemployment = { areMonthly: num(arr(a[3], 1)[0]) };
  if (a[4] !== null) {
    const p = arr(a[4], 3);
    out.pension = { amount: num(p[0]), basis: flag(p[1]) ? 'brut' : 'net', startYear: num(p[2]) };
  }
  return out;
}

export function decodeState(
  s: string,
): { household: Household; hypotheses: Hypotheses; period: Period } | null {
  try {
    if (typeof s !== 'string' || !s.startsWith('v1.') || s.length > 20_000) return null;
    const json = b64urlDecode(s.slice(3));
    if (json === null) return null;
    const root = arr(JSON.parse(json), 4);
    if (root[0] !== 1) return null;
    const hh = arr(root[1], 6);
    const adultsRaw = arr(hh[0]);
    if (adultsRaw.length < 1 || adultsRaw.length > 2) return null;
    const adults = adultsRaw.map(decAdult) as Household['adults'];
    const children: Child[] = arr(hh[2]).map((c0) => {
      const c = arr(c0, 3);
      const out: Child = { age: num(c[0]) };
      const aeeh = optBit(c[1]);
      const cmi = optBit(c[2]);
      if (aeeh !== undefined) out.aeeh = aeeh;
      if (cmi !== undefined) out.cmiInvalidite = cmi;
      return out;
    });
    const hs = arr(hh[3], 3);
    const housing: Household['housing'] = { status: idx(HOU, hs[0]) };
    const rent = optNum(hs[1]);
    if (rent !== undefined) housing.rentMonthly = rent;
    if (hs[2] !== null) {
      const z = num(hs[2]);
      if (z !== 1 && z !== 2 && z !== 3) return null;
      housing.zone = z;
    }
    const bn = arr(hh[4], 3);
    const benefits: Household['benefits'] = { nonRecours: flag(bn[0]) };
    const caf = optNum(bn[1]);
    if (caf !== undefined) benefits.cafOverrideMonthly = caf;
    const iso = optBit(bn[2]);
    if (iso !== undefined) benefits.isolementRecent = iso;
    const household: Household = {
      adults,
      marriedOrPacs: flag(hh[1]),
      children,
      housing,
      benefits,
    };
    if (hh[5] !== null) {
      const e = arr(hh[5], 5);
      const extras: NonNullable<Household['extras']> = {};
      if (e[0] !== null) extras.childcare = idx(CARE, e[0]);
      const keys = [
        'childcareCostMonthly',
        'emploiDomicileAnnual',
        'donsAnnual',
        'consumptionMonthly',
      ] as const;
      keys.forEach((k, i) => {
        const v = optNum(e[i + 1]);
        if (v !== undefined) extras[k] = v;
      });
      household.extras = extras;
    }
    const hy = arr(root[2], 4);
    const h5 = num(hy[2]);
    if (h5 !== 0 && h5 !== 0.5 && h5 !== 1) return null;
    const hypotheses: Hypotheses = {
      H1_benefits: flag(hy[0]) ? 'differential' : 'replaced',
      H2_fraisPro10: flag(hy[1]),
      H5_tvaPassThrough: h5,
      includeTva: flag(hy[3]),
    };
    const p = root[3];
    const period: Period | null =
      p === 's' ? 'steady' : p === 2027 || p === 2028 || p === 2030 ? p : null;
    if (period === null) return null;
    return { household, hypotheses, period };
  } catch {
    return null;
  }
}
