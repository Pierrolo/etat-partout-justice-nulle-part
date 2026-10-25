import type { ReactNode } from 'react';
import { SegmentedControl, Switch, Term, TierBadge } from '@/components/ui';
import type { Comparison, Hypotheses as Hyp } from '@/lib/engine-types';
import type { Tier } from '@/lib/tiers';
import { withBase } from '@/lib/site';

export interface HypothesisControlsProps {
  value: Hyp;
  onChange: (next: Hyp) => void;
  idPrefix?: string;
}

function Row({ tier, children }: { tier: Tier; children: ReactNode }) {
  return (
    <div className="space-y-2 border-b border-rule py-4 first:pt-0 last:border-b-0 last:pb-0">
      <TierBadge tier={tier} size="sm" />
      {children}
    </div>
  );
}

/** The four user-toggleable hypotheses (docs/VISION.md §6: H1, H2, H5, includeTva). */
export function HypothesisControls({ value, onChange, idPrefix = 'hyp' }: HypothesisControlsProps) {
  return (
    <div className="space-y-0">
      <Row tier="announced">
        <SegmentedControl
          name={`${idPrefix}-h1`}
          legend="H1 · Le RSA, la prime d’activité, l’AAH et les bourses sont-ils remplacés ?"
          hint={
            <>
              Le programme parle de les remplacer par l’aide universelle (<Term id="afu">AFU</Term>
              ), mais aucun amendement ne les supprime. Nous les remplaçons par défaut ; vous pouvez
              voir l’autre lecture (<Term id="differentiel">différentiel</Term>
              {'). '}
              <a href={withBase('/methode/#h1')}>Pourquoi ce choix →</a>
            </>
          }
          options={[
            { value: 'replaced', label: 'Remplacés par l’aide universelle' },
            { value: 'differential', label: 'Maintenus, réduits de l’aide universelle' },
          ]}
          value={value.H1_benefits}
          onChange={(H1_benefits) => onChange({ ...value, H1_benefits })}
        />
      </Row>
      <Row tier="hypothesis">
        <Switch
          label="H2 · Déduction de 10 % pour frais professionnels"
          hint={
            <>
              Le texte ne l’abroge pas. Si on la supprime, on retrouve les chiffres cités dans le
              plan ; l’impôt est alors un peu plus {'élevé. '}
              <a href={withBase('/methode/#h2')}>Détail →</a>
            </>
          }
          checked={value.H2_fraisPro10}
          onChange={(H2_fraisPro10) => onChange({ ...value, H2_fraisPro10 })}
          stateLabels={['Maintenue', 'Supprimée']}
        />
      </Row>
      <Row tier="hypothesis">
        <SegmentedControl
          name={`${idPrefix}-h5`}
          legend="H5 · Part de la hausse de TVA répercutée sur les prix"
          hint={
            <>
              Les taux réduits de <Term id="tva">TVA</Term> passent à 20 %. Quelle part se retrouve
              dans les prix que vous payez ? <a href={withBase('/methode/#h5')}>Détail →</a>
            </>
          }
          options={[
            { value: '0', label: '0 %' },
            { value: '0.5', label: '50 %' },
            { value: '1', label: '100 %' },
          ]}
          value={String(value.H5_tvaPassThrough) as '0' | '0.5' | '1'}
          onChange={(v) => onChange({ ...value, H5_tvaPassThrough: Number(v) as 0 | 0.5 | 1 })}
        />
      </Row>
      <Row tier="hypothesis">
        <Switch
          label="Compter l’effet estimé de la TVA dans le revenu disponible"
          hint="Estimation à partir de votre consommation, sans calcul précis de votre panier."
          checked={value.includeTva}
          onChange={(includeTva) => onChange({ ...value, includeTva })}
          stateLabels={['Comptée', 'Exclue']}
        />
      </Row>
    </div>
  );
}

export interface HypothesesSectionProps extends HypothesisControlsProps {
  comparison: Comparison | null;
}

export function HypothesesSection({ value, onChange, comparison }: HypothesesSectionProps) {
  return (
    <section id="hypotheses" aria-labelledby="hyp-title" className="space-y-4">
      <header className="max-w-3xl space-y-1.5">
        <h4
          id="hyp-title"
          className="font-serif text-xl font-medium leading-snug tracking-tight text-ink sm:text-2xl"
        >
          Les choix que nous avons dû faire
        </h4>
        <p className="text-[0.9375rem] text-ink-2">
          Là où le texte est muet, nous avons dû choisir. Changez un choix : le résultat se met à
          jour tout de suite.
        </p>
      </header>

      <div className="grid gap-4 lg:grid-cols-[minmax(0,1.3fr)_minmax(0,1fr)]">
        <div className="card">
          <HypothesisControls value={value} onChange={onChange} />
        </div>
        <div className="space-y-4">
          {comparison && (
            <div className="card">
              <h5 className="mb-3 text-base font-semibold text-ink">Ce que le moteur a retenu</h5>
              <ul className="space-y-3 text-sm">
                {comparison.activeHypotheses.map((a) => (
                  <li key={a.id} className="space-y-1">
                    <p className="font-medium text-ink">{a.label}</p>
                    <p className="flex flex-wrap items-center gap-2 text-ink-2">
                      <span className="font-semibold">{a.value}</span>
                      <TierBadge tier={a.tier} short size="sm" />
                    </p>
                  </li>
                ))}
              </ul>
            </div>
          )}
        </div>
      </div>
    </section>
  );
}

export function NotModelled({ items }: { items: string[] }) {
  return (
    <section aria-labelledby="nm-title" className="card space-y-3">
      <h4
        id="nm-title"
        className="font-serif text-xl font-medium leading-snug tracking-tight text-ink sm:text-2xl"
      >
        Ce que le simulateur ne compte pas
      </h4>
      <p className="text-[0.9375rem] text-ink-2">
        Pour votre foyer, ces points ne sont pas dans le calcul. Ils peuvent changer le résultat,
        dans un sens comme dans l’autre.
      </p>
      <ul className="list-disc space-y-1.5 ps-5 text-[0.9375rem] text-ink marker:text-ink-3">
        {items.map((s) => (
          <li key={s}>{s}</li>
        ))}
      </ul>
      <p className="text-sm">
        <a href={withBase('/methode/')}>Méthode, sources et registre complet des hypothèses →</a>
      </p>
    </section>
  );
}
