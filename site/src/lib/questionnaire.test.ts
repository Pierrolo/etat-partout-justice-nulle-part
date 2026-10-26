import { describe, expect, it } from 'vitest';
import { fact, num, type FactId } from '@/lib/facts';
import { questionnaire } from '@/lib/questionnaire';
import {
  CLOSE_REL,
  bilanSentence,
  choiceVerdict,
  closeBand,
  closeRule,
  scaleVerdict,
  verdictFor,
  type Question,
  type ScaleQuestion,
} from '@/lib/questionnaire-model';

function scale(id: string): ScaleQuestion {
  const q = questionnaire().find((item) => item.id === id);
  if (!q || q.kind !== 'scale') throw new Error(`missing scale ${id}`);
  return q;
}

function question(id: string): Question {
  const q = questionnaire().find((item) => item.id === id);
  if (!q) throw new Error(`missing question ${id}`);
  return q;
}

/** The same text with the French non-breaking spaces as plain ones, to compare words, not typography. */
const flat = (text: string) => text.replace(/[\u00a0\u202f]/g, ' ');

/** Every string a reader can see in a question. */
function allText(q: Question): string[] {
  const own = [q.eyebrow, q.prompt, q.hint, q.answerLead, ...q.body];
  if (q.caveat) own.push(q.caveat.title, q.caveat.text);
  if (q.also) own.push(q.also.label);
  own.push(q.more.label, ...q.sources.map((s) => s.label));
  if (q.kind === 'scale') own.push(q.truthLabel);
  else own.push(q.hitText, q.missText, ...q.options.map((o) => o.label));
  return own;
}

describe('scaleVerdict', () => {
  it('treats a guess inside the band as close', () => {
    expect(scaleVerdict(7, 6.36, 1)).toEqual({ close: true, text: 'Proche de la référence.' });
  });

  it('states the ratio when the guess is well above', () => {
    const v = scaleVerdict(40, 6.36, 1);
    expect(v.close).toBe(false);
    expect(v.text).toContain('fois plus');
  });

  it('rounds a near-ten ratio to a whole number', () => {
    expect(scaleVerdict(8, 0.8, 0.1).text).toBe('C’est 10 fois plus que la référence.');
    expect(scaleVerdict(12, 23.4, 2).text).toBe('C’est 2 fois moins que la référence.');
  });

  it('states the ratio when the guess is well below', () => {
    expect(scaleVerdict(5, 23, 2).text).toContain('fois moins');
  });

  it('does not divide when the guess is zero', () => {
    const v = scaleVerdict(0, 6.36, 1);
    expect(v.close).toBe(false);
    expect(v.text).toContain('zéro');
  });
});

describe('choiceVerdict', () => {
  it('accepts the matching option only', () => {
    expect(choiceVerdict('second', 'second').close).toBe(true);
    expect(choiceVerdict('first', 'second').close).toBe(false);
  });
});

describe('bilanSentence', () => {
  it('names the count of close guesses', () => {
    expect(bilanSentence(0, 7)).toContain('Aucune');
    expect(bilanSentence(7, 7)).toContain('Toutes');
    expect(bilanSentence(2, 7)).toContain('proches');
  });

  it('agrees the verb with the count: « 1 estimation … était proche », « 2 estimations … étaient proches »', () => {
    expect(bilanSentence(1, 19)).toMatch(/^1 estimation sur 19 était proche de la référence\./);
    expect(bilanSentence(1, 19)).not.toContain('étaient');
    expect(bilanSentence(2, 19)).toMatch(/^2 estimations sur 19 étaient proches de la référence\./);
    expect(bilanSentence(18, 19)).toContain('étaient proches');
  });

  it('claims nothing about how rarely these figures are shown together', () => {
    for (const n of [0, 1, 2, 19]) expect(bilanSentence(n, 19)).not.toContain('rarement');
    expect(bilanSentence(3, 19)).toContain('relié à sa source');
  });
});

describe('« proche » band (one rule for every numeric question)', () => {
  it('is the larger of one slider step and the relative rule', () => {
    expect(closeBand({ truth: 6.36, step: 1 })).toBe(1); // small share: one step
    expect(closeBand({ truth: 1104, step: 50 })).toBeCloseTo(CLOSE_REL * 1104);
    expect(closeBand({ truth: 77, step: 1 })).toBeCloseTo(CLOSE_REL * 77);
  });

  it('is relative: the same share of the reference wherever it is, never below a step', () => {
    for (const q of questionnaire()) {
      if (q.kind !== 'scale') continue;
      const band = closeBand(q);
      expect(band, q.id).toBeGreaterThanOrEqual(q.step);
      expect(band, q.id).toBeGreaterThanOrEqual(CLOSE_REL * Math.abs(q.truth) - 1e-9);
      // either the step (small reference) or exactly the relative rule: no third kind of band
      const isStep = band === q.step;
      const isRelative = Math.abs(band - CLOSE_REL * Math.abs(q.truth)) < 1e-9;
      expect(isStep || isRelative, q.id).toBe(true);
      // and no question carries a band of its own
      expect('closeAbs' in q, q.id).toBe(false);
    }
  });

  it('no longer calls 5 % of 6,4 % « très proche » while refusing 73 % for 77 %', () => {
    const securite = scale('securite');
    expect(verdictFor(securite, 7)?.close).toBe(true); // 0,6 pt off, within one step
    expect(verdictFor(securite, 5)?.close).toBe(false); // 1,4 pt off, 21 % of the reference
    const reste = scale('reste');
    expect(verdictFor(reste, 73)?.close).toBe(true); // 4 pts off, 5 % of the reference
    expect(verdictFor(reste, 60)?.close).toBe(false);
    const agences = scale('agences');
    expect(verdictFor(agences, 1000)?.close).toBe(true); // 9 % off
    expect(verdictFor(agences, 800)?.close).toBe(false); // 28 % off
  });

  it('is stated to the reader in one sentence', () => {
    expect(closeRule()).toContain('10');
    expect(closeRule()).toContain('près de la référence');
    expect(CLOSE_REL).toBe(0.1);
  });
});

describe('questionnaire', () => {
  const questions = questionnaire();

  it('opens on the security share people already meet on the hub', () => {
    const first = questions[0];
    expect(first?.id).toBe('securite');
    expect(first?.prompt).toContain('sécurité');
    expect(scale('securite').truth).toBeCloseTo(num('dep_part_securite_pct'));
    expect(scale('securite').answerLead).toBe('Le calcul');
  });

  it('shows the plan’s own figures with the « Annoncé » treatment, and measurements without it', () => {
    const byId = new Map(questions.map((q) => [q.id, q]));
    // figures that exist only in the plan's manifeste, fiches or published workbook (tier `annonce` in facts.json)
    const announcedBasis: Record<string, FactId> = {
      jour: 'dep_par_foyer_manifeste_eur',
      impots: 'impots_nombre_manifeste',
      cerfa: 'cerfa_nombre_manifeste',
      combinaisons: 'charges_sociales_combinaisons_manifeste',
      agences: 'agences_etat_avant',
      heure: 'va_heure_salaire_net_eur',
    };
    for (const [id, basis] of Object.entries(announcedBasis)) {
      const q = byId.get(id)!;
      expect(fact(basis).tier, `${id} is scored against an announced figure`).toBe('annonce');
      expect(q.tier, id).toBe('announced');
      expect(q.caveat?.tone, id).toBe('announced');
      expect(q.prompt, `${id} says whose figure it asks about`).toMatch(/\bplan\b/);
      expect(q.answerLead, id).toMatch(/plan/);
    }
    // a question carries the announced treatment only if its reference really is announced
    for (const q of questions) {
      if (q.tier === 'announced') expect(Object.keys(announcedBasis), q.id).toContain(q.id);
    }
    // amendment-based figures wear the amendment tier; measurements wear nothing
    expect(byId.get('indemnite')?.tier).toBe('law');
    expect(byId.get('reste')?.tier).toBe('law');
    for (const id of ['securite', 'dette', 'culture', 'chomage', 'retraites', 'niches', 'agents']) {
      expect(byId.get(id)?.tier, id).toBeUndefined();
    }
    expect(byId.get('securite')?.caveat).toBeUndefined();
    expect(byId.get('dette')?.caveat).toBeUndefined();
    // a count the workbook publishes as data keeps a plain note
    expect(byId.get('locaux')?.caveat?.tone).toBe('note');
  });

  it('never presents a question about the plan’s count as a question about the world', () => {
    expect(flat(question('impots').prompt)).toBe(
      'Selon le décompte du plan, combien d’impôts différents existe-t-il ?',
    );
    expect(question('cerfa').prompt).toContain('Selon le plan');
    expect(question('agences').prompt).toContain('Selon le décompte du plan');
    expect(question('combinaisons').prompt).toContain('Selon le plan');
    expect(question('jour').prompt).toContain('Selon le plan');
    expect(question('heure').prompt).toContain('Selon le chiffrage du plan');
    expect(question('locaux').prompt).toContain('le chiffrage du plan');
    expect(flat(question('impots').body.join(' '))).toContain('Le plan compte');
    // the 1 672 Md€ is all public administrations, not « l’État »
    expect(question('jour').body.join(' ')).toContain('administrations publiques');
  });

  it('cites the right amendment for the exit indemnity (n° 26) and the closed jobs (n° 24)', () => {
    expect(fact('indemnite_sortie_taux_pct').source.number).toBe(26);
    expect(fact('emplois_etat_fermes_annee_pleine_loi').source.number).toBe(24);
    const q = question('indemnite');
    const jobs = flat(q.body.find((p) => p.includes('emplois d’État en année pleine'))!);
    expect(jobs).toContain('PLF-P2 n° 24');
    expect(jobs).not.toContain('n° 26');
    expect(jobs.startsWith('Un autre amendement')).toBe(true);
    const indemnity = flat(q.body[0]!);
    expect(indemnity).toContain('PLF-P2 n° 26');
    expect(indemnity).not.toContain('n° 24');
    for (const text of allText(q)) {
      expect(text).not.toContain('Le même texte');
      expect(text).not.toContain('dans l’amendement proposé, encore à déposer');
    }
    expect(q.caveat?.text).toContain('deux amendements');
    expect(flat(q.caveat?.text ?? '')).toContain('PLF-P2 n° 26');
    expect(flat(q.caveat?.text ?? '')).toContain('PLF-P2 n° 24');
  });

  it('describes the indemnity as an indemnity on an assiette, not a salary « maintained »', () => {
    const q = question('indemnite');
    expect(q.prompt).not.toMatch(/maintient/);
    expect(q.prompt).toContain('licencié');
    expect(q.body[0]).toContain('assiette');
  });

  it('does not say the amendments are waiting to be filed or voted', () => {
    for (const q of questions) {
      for (const text of allText(q)) {
        expect(text, q.id).not.toMatch(
          /en attente de dépôt|attendent d’être déposés|encore à déposer/,
        );
        expect(text, q.id).not.toMatch(/puis votés?\b/);
      }
    }
  });

  it('surfaces the 4 vs 5 impôts conflict on the impôts question', () => {
    const q = question('impots');
    const body = q.body.join(' ');
    expect(body).toContain(String(num('impots_cibles_manifeste')));
    expect(body).toContain(String(num('impots_cibles_lettres')));
    expect(body).toContain('lettres aux élus');
    expect(body).toContain('cinquième');
    expect(q.sources.some((s) => /Lettres aux élus/.test(s.label))).toBe(true);
    expect(q.caveat?.title).toMatch(/Quatre impôts ou cinq/);
  });

  it('quotes the plan word for word, with its speaker', () => {
    const quoted = (id: FactId) => fact(id).source.quote!.replace(/'/g, '’');
    expect(flat(question('securite').body.join(' '))).toContain(
      `Le plan écrit que la défense, la police et la justice « ${flat(quoted('dep_part_regalien_manifeste_pct'))} »`,
    );
    expect(flat(question('impots').body.join(' '))).toContain(
      `Il écrit : « ${flat(quoted('impots_cibles_manifeste'))} »`,
    );
    expect(flat(question('reste').body.join(' '))).toContain(
      `La fiche Travailleur du plan le dit : « ${flat(quoted('ir_retention_marginale_fiche'))} »`,
    );
    // no figure is attributed to « on » or left without a speaker
    for (const q of questions) {
      for (const text of q.body) {
        expect(text, q.id).not.toMatch(/^On lit aussi|^À côté :|^Ailleurs, on lit/);
      }
    }
  });

  it('gives the 10× target of the law-words question a source chip', () => {
    const mots = question('mots');
    expect(mots.body.join(' ')).toContain(String(num('droit_mots_cible_diviseur')));
    expect(mots.sources.some((s) => /objectif/.test(s.label))).toBe(true);
  });

  it('counts the 35 ministries as the plan counts them, with a source', () => {
    const agences = question('agences');
    expect(agences.body.join(' ')).toContain('ministres délégués compris');
    expect(agences.sources.length).toBeGreaterThanOrEqual(5);
    expect(agences.sources.some((s) => /ministères gardés/.test(s.label))).toBe(true);
  });

  it('reconciles the 77 % answer with the simulator’s default H2, and links to it', () => {
    const reste = question('reste');
    expect(reste.kind).toBe('scale');
    expect(reste.body.join(' ')).toContain('hypothèse H2');
    expect(reste.body.join(' ')).toContain('frais professionnels');
    expect(reste.body.join(' ')).toContain('un peu plus');
    expect(reste.also?.href).toBe('/methode/#h2');
    expect(scale('reste').truth).toBeCloseTo(num('ir_retention_marginale_calc') * 100);
  });

  it('writes every guillemet and colon with the French non-breaking spaces', () => {
    const bad = [
      /[^\s\u00a0\u202f] [;:!?»]/, // a regular space before ; : ! ? »
      /« /, // a regular space after «
      /\d (€|%|Md€|M€)(?![\p{L}\d])/u, // a number split from its unit
      /\d \d{3}(?!\d)/, // a thousands group split by a regular space
    ];
    for (const q of questions) {
      for (const text of allText(q)) {
        for (const re of bad) expect(text, `${q.id}: ${text}`).not.toMatch(re);
      }
    }
    expect(question('europe').caveat?.text).toContain('«\u202frecord\u202f»');
  });

  it('accords the options of the debt question with « les intérêts » (masculine plural)', () => {
    const dette = question('dette');
    expect(dette.kind).toBe('choice');
    if (dette.kind !== 'choice') return;
    expect(dette.options.map((o) => o.label)).toEqual([
      'Plus lourds que la justice, plus légers que la défense',
      'Plus lourds que la justice et que la défense',
      'Plus légers que les deux',
    ]);
  });

  it('says whose figure it is in the closing summary: no generic « La table »', () => {
    for (const q of questions) {
      expect(q.answerLead, q.id).not.toBe('La table');
      expect(q.answerLead.length, q.id).toBeGreaterThan(3);
    }
    // the plan's own choice questions are introduced as the plan's, not as « the table »
    expect(question('combinaisons').answerLead).toBe('Le chiffre du plan');
    expect(question('suisse').answerLead).toBe('Eurostat');
  });

  it('says « l’inverse » when the report says the opposite', () => {
    const agents = question('agents');
    expect(agents.kind === 'choice' && agents.missText).toBe('Le rapport dit l’inverse.');
  });

  it('shows the Finland conflict on the rank question, and does not call France first', () => {
    const europe = questions.find((q) => q.id === 'europe');
    expect(europe?.kind).toBe('choice');
    if (europe?.kind !== 'choice') return;
    expect(europe.correctId).toBe('second');
    expect(europe.body.join(' ')).toContain('Finlande');
    expect(europe.body.join(' ')).toContain('record');
  });

  it('gives every question a source, a follow-up page, and an answer', () => {
    for (const q of questions) {
      expect(q.sources.length).toBeGreaterThan(0);
      expect(q.more.href.startsWith('/')).toBe(true);
      expect(q.body.length).toBeGreaterThan(0);
      expect(q.prompt.length).toBeGreaterThan(10);
    }
  });

  it('asks the comparisons the tables actually support', () => {
    const byId = new Map(questions.map((q) => [q.id, q]));
    const retraites = byId.get('retraites');
    const dette = byId.get('dette');
    const niches = byId.get('niches');
    const combinaisons = byId.get('combinaisons');
    const agents = byId.get('agents');
    expect(retraites?.kind).toBe('choice');
    expect(dette?.kind).toBe('choice');
    expect(niches?.kind).toBe('choice');
    if (retraites?.kind === 'choice') expect(retraites.correctId).toBe('yes');
    if (dette?.kind === 'choice') expect(dette.correctId).toBe('both');
    if (niches?.kind === 'choice') {
      expect(niches.body.join(' ')).toContain('taux réduits');
      expect(niches.correctId).toBe('yes');
    }
    if (combinaisons?.kind === 'choice') expect(combinaisons.correctId).toBe('billion');
    if (agents?.kind === 'choice') expect(agents.correctId).toBe('no');
    expect(num('dep_retraites_2024_md') / num('dep_total_2024_md')).toBeGreaterThan(
      num('dep_part_securite_pct') / 100 + num('dep_education_2024_md') / num('dep_total_2024_md'),
    );
  });

  it('uses a unique id per question', () => {
    const ids = questions.map((q: Question) => q.id);
    expect(new Set(ids).size).toBe(ids.length);
    expect(ids.length).toBeGreaterThan(12);
  });
});
