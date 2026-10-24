import type { Ref, RefObject } from 'react';
import { Button, Callout } from '@/components/ui';
import { cn } from '@/lib/cn';
import type { Household, Hypotheses, Period } from '@/lib/engine-types';
import type { StepId } from '@/lib/sim/form';
import { headlineSentence, periodLong, plainText, shareText } from '@/lib/sim/result';
import type { ResultData } from '@/lib/sim/state';
import { withBase } from '@/lib/site';
import { BenefitsToday } from './BenefitsToday';
import { EnClair } from './EnClair';
import { H1Readings } from './H1Readings';
import { Hero, UnsupportedResult } from './Hero';
import { MoreSections, type MoreHandle } from './MoreSections';
import { ProminentLosses } from './ProminentLosses';
import { Recap } from './Recap';
import { ShareButton } from './ShareButton';
import { Waterfall } from './Waterfall';

export interface ResultViewProps {
  data: ResultData;
  household: Household;
  hyp: Hypotheses;
  period: Period;
  stale: boolean;
  /** Opened from a link somebody shared: the answers are theirs, not the reader's. */
  shared: boolean;
  getUrl: () => string;
  engineVersion: string;
  baselineYear: string;
  onEdit: (step?: StepId) => void;
  onRestart: () => void;
  onHyp: (h: Hypotheses) => void;
  onPickPeriod: (p: Period) => void;
  heroRef: Ref<HTMLDivElement>;
  moreRef: RefObject<MoreHandle | null>;
}

/**
 * The result in three layers (docs/qa/FIX-PLAN.md): 1 « En clair » — the figure, the plain summary, what the
 * figure leaves out, both readings of H1, the answers; 2 « Le détail » — the waterfall and today's benefits;
 * 3 « Pour aller plus loin » — everything else, collapsed and loaded on demand.
 */
export function ResultView({
  data,
  household,
  hyp,
  period,
  stale,
  shared,
  getUrl,
  engineVersion,
  baselineYear,
  onEdit,
  onRestart,
  onHyp,
  onPickPeriod,
  heroRef,
  moreRef,
}: ResultViewProps) {
  const { comparison } = data;
  const owner = household.adults.some(
    (a) => a.salary?.status === 'dirigeant_assimile' || a.salary?.status === 'tns',
  );

  if (comparison.unsupported) {
    return (
      <div className="space-y-8">
        <UnsupportedResult messages={comparison.unsupported.map(plainText)} />
        <Recap household={household} onEdit={onEdit} shared={shared} />
        <MoreSections
          ref={moreRef}
          data={null}
          household={household}
          hyp={hyp}
          period={period}
          onHyp={onHyp}
          onPickPeriod={onPickPeriod}
          owner
        />
      </div>
    );
  }

  return (
    <div className={cn('space-y-10 transition-opacity duration-200', stale && 'opacity-70')}>
      {shared && (
        <Callout tone="note" title="Simulation partagée">
          <p>
            Vous regardez le résultat d’une autre personne : il décrit sa situation (les réponses
            sont rappelées plus bas), pas la vôtre.
          </p>
          <p className="mt-2">
            <Button variant="secondary" size="sm" onClick={onRestart}>
              Refaire avec ma situation
            </Button>
          </p>
        </Callout>
      )}

      {/* ── Couche 1 : en clair ─────────────────────────────────────── */}
      <div className="space-y-6" data-layer="1">
        <div ref={heroRef} className="space-y-3">
          <Button variant="ghost" size="sm" className="sm:hidden" onClick={() => onEdit()}>
            ← Modifier mes réponses
          </Button>
          <Hero
            data={data}
            period={period}
            stale={stale}
            getUrl={getUrl}
            shareText={shareText(comparison, data.display)}
            onEdit={() => onEdit()}
            onResetPeriod={() => onPickPeriod('steady')}
          />
          <p className="sr-only" data-testid="headline-sentence">
            {headlineSentence(comparison, data.display, period)}
          </p>
        </div>

        {comparison.warnings.length > 0 && (
          <Callout tone="note" title="À savoir sur ce calcul">
            <ul className="list-disc space-y-1 ps-5">
              {comparison.warnings.map((w) => (
                <li key={w}>{plainText(w)}</li>
              ))}
            </ul>
          </Callout>
        )}

        <EnClair data={data} />
        <ProminentLosses
          data={data}
          household={household}
          onSeeAll={() => moreRef.current?.open('noncompte')}
        />
        <H1Readings
          data={data}
          current={hyp.H1_benefits}
          onSwitch={(r) => onHyp({ ...hyp, H1_benefits: r })}
        />
        <Recap household={household} onEdit={onEdit} shared={shared} />
      </div>

      {/* ── Couche 2 : le détail ────────────────────────────────────── */}
      <section aria-labelledby="detail-title" data-layer="2" className="space-y-6">
        <header className="max-w-3xl space-y-1.5">
          <h2 id="detail-title" className="font-serif text-2xl font-medium text-ink sm:text-3xl">
            Le détail
          </h2>
          <p className="text-[0.9375rem] text-ink-2">
            D’où vient chaque euro, avec la source de chaque ligne, et ce que vous touchez
            aujourd’hui.
          </p>
        </header>
        <Waterfall data={data} periodLabel={periodLong(period)} />
        <BenefitsToday data={data} />
      </section>

      {/* ── Couche 3 : pour aller plus loin ─────────────────────────── */}
      <MoreSections
        ref={moreRef}
        data={data}
        household={household}
        hyp={hyp}
        period={period}
        onHyp={onHyp}
        onPickPeriod={onPickPeriod}
        owner={owner}
      />

      <section
        aria-labelledby="share-title"
        className="card flex flex-wrap items-center justify-between gap-4"
      >
        <div className="min-w-0 max-w-xl space-y-1">
          <h2 id="share-title" className="font-serif text-xl font-medium text-ink">
            Partager ce résultat
          </h2>
          <p className="text-sm text-ink-2">
            Le lien contient vos réponses dans son adresse (après le « # »). Rien n’est envoyé à un
            serveur : seule la personne qui ouvre le lien les verra, avec le résultat.
          </p>
          <p className="text-xs text-ink-3">
            Moteur de calcul, version {engineVersion}. {baselineYear}.
          </p>
          <p className="pt-1 text-sm">
            <a href={withBase('/simulateur/cas-types/')}>
              Voir comment le plan touche d’autres foyers : qui gagne, qui perd ? →
            </a>
          </p>
        </div>
        <ShareButton getUrl={getUrl} text={shareText(comparison, data.display)} variant="primary" />
      </section>
    </div>
  );
}
