import {
  lazy,
  Suspense,
  useCallback,
  useImperativeHandle,
  useState,
  type ReactNode,
  type Ref,
} from 'react';
import { IconChevron } from '@/components/ui/icons';
import type { Household, Hypotheses, Period } from '@/lib/engine-types';
import { buildHeadline } from '@/lib/sim/result';
import type { ResultData } from '@/lib/sim/state';
import { cn } from '@/lib/cn';

// Layer 3 is loaded on demand: none of this (Observable Plot, the transition, the engine-heavy views)
// is needed to read the result, so none of it is in the first JavaScript the visitor downloads.
const HourOfWork = lazy(() => import('./HourOfWork').then((m) => ({ default: m.HourOfWork })));
const EarningsCurve = lazy(() =>
  import('./EarningsCurve').then((m) => ({ default: m.EarningsCurve })),
);
const Transition = lazy(() => import('./Transition').then((m) => ({ default: m.Transition })));
const NearbyCases = lazy(() => import('./NearbyCases').then((m) => ({ default: m.NearbyCases })));
const CompareTable = lazy(() =>
  import('./CompareTable').then((m) => ({ default: m.CompareTable })),
);
const HypothesesSection = lazy(() =>
  import('./Hypotheses').then((m) => ({ default: m.HypothesesSection })),
);
const NotCounted = lazy(() => import('./NotCounted').then((m) => ({ default: m.NotCounted })));
const EmployerPanel = lazy(() =>
  import('./EmployerPanel').then((m) => ({ default: m.EmployerPanel })),
);

export type MoreId =
  | 'heure'
  | 'courbe'
  | 'transition'
  | 'proches'
  | 'tableau'
  | 'hypotheses'
  | 'noncompte'
  | 'salaries';

export interface MoreHandle {
  open: (id: MoreId) => void;
}

export interface MoreSectionsProps {
  /** `null` when the household is outside the model (TNS): only the employer panel is offered. */
  data: ResultData | null;
  household: Household | null;
  hyp: Hypotheses;
  period: Period;
  onHyp: (h: Hypotheses) => void;
  onPickPeriod: (p: Period) => void;
  /** The person runs a business (dirigeant, TNS): the employer panel is addressed to them. */
  owner: boolean;
  ref?: Ref<MoreHandle>;
}

interface Section {
  id: MoreId;
  label: string;
  teaser: string;
  render: () => ReactNode;
}

function Loading() {
  return (
    <p role="status" className="px-1 py-6 text-[0.9375rem] text-ink-2">
      Chargement…
    </p>
  );
}

/**
 * « Pour aller plus loin » — layer 3, collapsed by default, with a compact in-page nav. Buttons (not
 * « # » links: the URL hash carries the shared state) open a section and bring it into view.
 */
export function MoreSections({
  data,
  household,
  hyp,
  period,
  onHyp,
  onPickPeriod,
  owner,
  ref,
}: MoreSectionsProps) {
  const [open, setOpen] = useState<Set<MoreId>>(new Set());
  const [mounted, setMounted] = useState<Set<MoreId>>(new Set());

  const setOne = useCallback((id: MoreId, on: boolean) => {
    setOpen((s) => {
      if (s.has(id) === on) return s;
      const n = new Set(s);
      if (on) n.add(id);
      else n.delete(id);
      return n;
    });
    if (on) setMounted((s) => (s.has(id) ? s : new Set(s).add(id)));
  }, []);

  const goTo = useCallback(
    (id: MoreId) => {
      setOne(id, true);
      requestAnimationFrame(() => {
        const el = document.getElementById(`plus-${id}`);
        if (!el) return;
        const reduce = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
        el.scrollIntoView({ behavior: reduce ? 'auto' : 'smooth', block: 'start' });
        el.querySelector<HTMLElement>('summary')?.focus({ preventScroll: true });
      });
    },
    [setOne],
  );
  useImperativeHandle(ref, () => ({ open: goTo }), [goTo]);

  const salaried = !!household?.adults.some((a) => a.activity === 'salarie' && a.salary);
  const headlineText = data
    ? `Pour tout votre foyer, avec les aides qui changent, l’aide universelle des enfants et la TVA, le résultat est de ${buildHeadline(data.comparison, data.display).amount.replace('/mois', ' par mois')}.`
    : '';

  const sections: Section[] = [];
  if (data && household) {
    const working = household.adults.some(
      (a) => a.activity === 'salarie' && a.salary && a.salary.status !== 'tns',
    );
    if (working)
      sections.push({
        id: 'heure',
        label: 'Votre heure de travail',
        teaser: 'Ce qu’une heure de travail vous laisse, aujourd’hui et avec le plan.',
        render: () => (
          <HourOfWork household={household} hypotheses={hyp} headlineText={headlineText} />
        ),
      });
    sections.push(
      {
        id: 'courbe',
        label: 'Si je gagnais plus ?',
        teaser: 'Votre revenu selon votre salaire, aujourd’hui et avec le plan.',
        render: () => (
          <EarningsCurve household={household} hypotheses={hyp} comparison={data.comparison} />
        ),
      },
      {
        id: 'transition',
        label: 'La transition, année par année',
        teaser: '2027, 2028, 2030 : le chemin jusqu’au plan complet.',
        render: () => (
          <Transition
            household={household}
            hypotheses={hyp}
            period={period}
            onPick={onPickPeriod}
          />
        ),
      },
      {
        id: 'proches',
        label: 'Des foyers types proches du vôtre',
        teaser: 'Trois cas types qui vous ressemblent, avec leur résultat.',
        render: () => (
          <NearbyCases
            household={household}
            hypotheses={hyp}
            period={period}
            comparison={data.comparison}
          />
        ),
      },
      {
        id: 'tableau',
        label: 'Le tableau avant / après',
        teaser: 'Toutes les lignes, par mois ou par an.',
        render: () => <CompareTable data={data} />,
      },
      {
        id: 'hypotheses',
        label: 'Les hypothèses',
        teaser: 'Les choix que nous avons dû faire : changez-en un, le résultat suit.',
        render: () => (
          <HypothesesSection value={hyp} onChange={onHyp} comparison={data.comparison} />
        ),
      },
      {
        id: 'noncompte',
        label: 'Ce que le simulateur ne compte pas',
        teaser: 'Promesses et pertes sans montant, et ce qui reste hors du calcul.',
        render: () => (
          <NotCounted
            promises={data.comparison.unquantified.promises}
            losses={data.comparison.unquantified.losses}
            notModelled={data.comparison.notModelled}
          />
        ),
      },
    );
  }
  if (salaried || owner)
    sections.push({
      id: 'salaries',
      label: 'Et pour mes salariés ?',
      teaser: 'Si vous employez du personnel : l’effet pour un salarié et pour vous.',
      render: () => <EmployerPanel owner={owner} />,
    });

  if (sections.length === 0) return null;

  return (
    <section aria-labelledby="plus-title" data-testid="more" className="space-y-4">
      <header className="max-w-3xl space-y-1.5">
        <h2 id="plus-title" className="font-serif text-2xl font-medium text-ink sm:text-3xl">
          Pour aller plus loin
        </h2>
        <p className="text-[0.9375rem] text-ink-2">
          Tout ce qui suit est facultatif. Ouvrez ce qui vous intéresse.
        </p>
      </header>

      <nav
        aria-label="Pour aller plus loin : aller à…"
        className="z-10 -mx-1 flex flex-wrap gap-2 bg-paper/90 px-1 py-2 backdrop-blur lg:sticky lg:top-2"
      >
        {sections.map((s) => (
          <button
            key={s.id}
            type="button"
            onClick={() => goTo(s.id)}
            aria-controls={`plus-${s.id}`}
            className="min-h-9 rounded-full border border-rule-strong bg-surface px-3.5 py-1 text-sm font-medium text-ink hover:border-ink"
          >
            {s.label}
          </button>
        ))}
      </nav>

      <div className="space-y-3">
        {sections.map((s) => (
          <details
            key={s.id}
            id={`plus-${s.id}`}
            open={open.has(s.id)}
            onToggle={(e) => setOne(s.id, e.currentTarget.open)}
            className="group scroll-mt-20 rounded-lg border border-rule bg-surface"
          >
            <summary className="flex min-h-12 cursor-pointer list-none items-center justify-between gap-3 px-4 py-3 marker:content-none hover:text-accent sm:px-5 [&::-webkit-details-marker]:hidden">
              <span className="min-w-0">
                <span className="block text-base font-semibold text-ink">{s.label}</span>
                <span className="hidden text-sm font-normal text-ink-2 sm:block">{s.teaser}</span>
              </span>
              <IconChevron
                size={20}
                className="shrink-0 text-ink-3 transition-transform duration-150 group-open:rotate-180"
              />
            </summary>
            <div className={cn('px-3 pb-4 sm:px-5')}>
              {mounted.has(s.id) && <Suspense fallback={<Loading />}>{s.render()}</Suspense>}
            </div>
          </details>
        ))}
      </div>
    </section>
  );
}
