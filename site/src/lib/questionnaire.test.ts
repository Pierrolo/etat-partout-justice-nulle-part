import { describe, expect, it } from 'vitest';
import { num } from '@/lib/facts';
import { questionnaire } from '@/lib/questionnaire';
import {
  bilanSentence,
  choiceVerdict,
  scaleVerdict,
  type Question,
  type ScaleQuestion,
} from '@/lib/questionnaire-model';

function scale(id: string): ScaleQuestion {
  const q = questionnaire().find((item) => item.id === id);
  if (!q || q.kind !== 'scale') throw new Error(`missing scale ${id}`);
  return q;
}

describe('scaleVerdict', () => {
  it('treats a guess inside the band as close', () => {
    expect(scaleVerdict(7, 6.36, 1.5)).toEqual({ close: true, text: 'Très proche.' });
  });

  it('states the ratio when the guess is well above', () => {
    const v = scaleVerdict(40, 6.36, 1.5);
    expect(v.close).toBe(false);
    expect(v.text).toContain('fois plus');
  });

  it('rounds a near-ten ratio to a whole number', () => {
    expect(scaleVerdict(8, 0.8, 1).text).toBe('C’est 10 fois plus que la référence.');
    expect(scaleVerdict(12, 23.4, 3).text).toBe('C’est 2 fois moins que la référence.');
  });

  it('states the ratio when the guess is well below', () => {
    expect(scaleVerdict(5, 23, 3).text).toContain('fois moins');
  });

  it('does not divide when the guess is zero', () => {
    const v = scaleVerdict(0, 6.36, 1.5);
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

  it('keeps author figures marked as announcements, and measurements unmarked', () => {
    const byId = new Map(questions.map((q) => [q.id, q]));
    expect(byId.get('agences')?.caveat?.tone).toBe('note');
    expect(byId.get('heure')?.caveat?.tone).toBe('announced');
    expect(byId.get('impots')?.caveat?.tone).toBe('announced');
    expect(byId.get('securite')?.caveat).toBeUndefined();
    expect(byId.get('dette')?.caveat).toBeUndefined();
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
