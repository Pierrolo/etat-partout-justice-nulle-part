/**
 * « Votre situation : … » — the answers behind a result, in plain French, read back from the engine
 * `Household` (so it works for a form, a shared link and a cas type alike). Each group knows which step of
 * the form holds its answers, so the recap can offer « Modifier ».
 */
import type { Adult, Household } from '@/lib/engine-types';
import { formatEuro } from '@/lib/format';
import type { StepId } from '@/lib/sim/form';
import { typo } from '@/lib/typo';

export interface RecapGroup {
  id: 'foyer' | 'vous' | 'conjoint' | 'logement' | 'aides';
  step: StepId;
  /** « Foyer », « Vous »… */
  label: string;
  text: string;
}

const plural = (n: number, one: string, many: string) => `${n} ${n > 1 ? many : one}`;
const ageText = (a: number) => (a < 1 ? 'moins de 1 an' : plural(a, 'an', 'ans'));
const list = (xs: string[]) =>
  xs.length <= 1 ? (xs[0] ?? '') : `${xs.slice(0, -1).join(', ')} et ${xs[xs.length - 1]}`;

const STATUS: Record<string, string> = {
  prive: 'salarié·e du privé, non-cadre',
  cadre: 'salarié·e du privé, cadre',
  fonctionnaire: 'fonctionnaire',
  dirigeant_assimile: 'dirigeant·e assimilé·e salarié·e',
  tns: 'indépendant·e ou gérant·e majoritaire (non couvert par le simulateur)',
};

const DISABILITY: Record<string, string> = {
  aah_80: 'handicap avec AAH, taux de 80 % ou plus',
  aah_50_79: 'handicap avec AAH, taux de 50 à 79 %',
};

function adultText(a: Adult): string {
  const parts: string[] = [ageText(a.age)];
  if (a.activity === 'salarie' && a.salary) {
    const status = STATUS[a.salary.status] ?? 'salarié·e';
    if (a.salary.status === 'tns') parts.push(status);
    else {
      const ratio =
        a.salary.workRatio !== undefined && a.salary.workRatio < 1
          ? `, à ${Math.round(a.salary.workRatio * 100)} %`
          : '';
      parts.push(
        `${status}, ${formatEuro(a.salary.amount)} ${a.salary.basis === 'net' ? 'net' : 'brut'} par mois${ratio}`,
      );
    }
  } else if (a.activity === 'chomage') {
    const are = a.unemployment?.areMonthly ?? 0;
    parts.push(
      are > 0
        ? `sans emploi, allocation chômage de ${formatEuro(are)} par mois`
        : 'sans emploi, non indemnisé·e',
    );
  } else if (a.activity === 'retraite') {
    const p = a.pension;
    parts.push(
      p
        ? `retraité·e, pension de ${formatEuro(p.amount)} ${p.basis === 'net' ? 'nette' : 'brute'} par mois`
        : 'retraité·e',
    );
  } else if (a.activity === 'etudiant') parts.push('étudiant·e');
  else if (a.activity === 'inactif') parts.push('inactif·ve');
  else parts.push('salarié·e');
  const dis = DISABILITY[a.disability];
  if (dis) parts.push(dis);
  return parts.join(', ');
}

const CHILDCARE: Record<string, string> = {
  parent: 'enfants gardés par un parent',
  creche: 'crèche',
  micro_creche: 'micro-crèche',
  assistante_maternelle: 'assistante maternelle',
};

export function buildRecap(h: Household): RecapGroup[] {
  const out: RecapGroup[] = [];
  const couple = h.adults.length === 2;

  // Foyer
  const foyer: string[] = [];
  foyer.push(
    couple
      ? h.marriedOrPacs
        ? 'En couple, marié·e ou pacsé·e'
        : 'En couple, ni marié·e ni pacsé·e'
      : 'Seul·e',
  );
  if (h.children.length === 0) foyer.push('pas d’enfant à charge');
  else {
    foyer.push(
      `${plural(h.children.length, 'enfant', 'enfants')} à charge (${list(h.children.map((c) => ageText(c.age)))})`,
    );
    const aeeh = h.children.filter((c) => c.aeeh).length;
    if (aeeh > 0) foyer.push(`${plural(aeeh, 'enfant', 'enfants')} avec AEEH`);
  }
  const mode = h.extras?.childcare;
  if (mode && CHILDCARE[mode]) {
    const cost = h.extras?.childcareCostMonthly;
    foyer.push(
      mode === 'parent'
        ? CHILDCARE[mode]!
        : `garde : ${CHILDCARE[mode]}, ${cost !== undefined ? `${formatEuro(cost)} par mois` : 'coût non précisé'}`,
    );
  }
  if (!couple && h.children.some((c) => c.age < 20)) {
    const s = h.benefits.childSupportReceivedMonthly;
    foyer.push(
      s !== undefined && s > 0
        ? `pension alimentaire reçue : ${formatEuro(s)} par mois`
        : 'pas de pension alimentaire',
    );
  }
  if (h.benefits.isolementRecent) foyer.push('séparé·e depuis moins de 18 mois');
  out.push({ id: 'foyer', step: 'foyer', label: 'Foyer', text: foyer.join(' · ') });

  out.push({ id: 'vous', step: 'adults', label: 'Vous', text: adultText(h.adults[0]) });
  if (h.adults[1])
    out.push({
      id: 'conjoint',
      step: 'adults',
      label: 'Votre conjoint·e',
      text: adultText(h.adults[1]),
    });

  // Logement
  const hs = h.housing;
  const zone = hs.zone ?? 2;
  out.push({
    id: 'logement',
    step: 'logement',
    label: 'Logement',
    text:
      hs.status === 'locataire'
        ? `Locataire, loyer de ${formatEuro(hs.rentMonthly ?? 0)} par mois hors charges, zone ${zone}`
        : hs.status === 'proprietaire'
          ? 'Propriétaire, sans crédit'
          : hs.status === 'proprietaire_credit'
            ? 'Propriétaire, avec crédit'
            : 'Hébergé·e gratuitement',
  });

  // Aides + précisions
  const aides: string[] = [];
  if (h.benefits.nonRecours) aides.push('ne touche pas les aides auxquelles elle a droit');
  else if (h.benefits.cafOverrideMonthly !== undefined)
    aides.push(
      `total versé par la CAF indiqué : ${formatEuro(h.benefits.cafOverrideMonthly)} par mois`,
    );
  else aides.push('aides calculées par le simulateur');
  const e = h.extras;
  if (e?.emploiDomicileAnnual !== undefined)
    aides.push(`emploi à domicile : ${formatEuro(e.emploiDomicileAnnual)} par an`);
  if (e?.donsAnnual !== undefined) aides.push(`dons : ${formatEuro(e.donsAnnual)} par an`);
  if (e?.consumptionMonthly !== undefined)
    aides.push(`consommation : ${formatEuro(e.consumptionMonthly)} par mois`);
  out.push({ id: 'aides', step: 'aides', label: 'Aides', text: aides.join(' · ') });

  return out.map((g) => ({ ...g, text: typo(g.text) }));
}
