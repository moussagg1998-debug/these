import { describe, it, expect } from 'vitest';
import { reminderEmail } from './reminder-email';

describe('reminderEmail', () => {
  it('returns { subject, html, text } all non-empty', () => {
    const t = reminderEmail({
      subject: 'Rappel',
      body: 'Bonjour Fatou,\n\nMerci de soumettre votre travail.',
      encadrantName: 'Pr. Amadou Diallo',
    });
    expect(t.subject).toBe('Rappel');
    expect(t.html).toBeTruthy();
    expect(t.text).toBeTruthy();
  });

  it('converts newlines to <br> in html but preserves them in text', () => {
    const t = reminderEmail({
      subject: 'Rappel',
      body: 'Ligne 1\nLigne 2',
      encadrantName: 'Pr. Diallo',
    });
    expect(t.html).toContain('Ligne 1<br>Ligne 2');
    expect(t.text).toContain('Ligne 1\nLigne 2');
  });

  it('escapes HTML-significant characters in the body', () => {
    const t = reminderEmail({
      subject: 'Rappel',
      body: '<script>alert(1)</script> & "quotes" \'single\'',
      encadrantName: 'Pr. Diallo',
    });
    expect(t.html).not.toContain('<script>');
    expect(t.html).toContain('&lt;script&gt;');
    expect(t.html).toContain('&amp;');
    expect(t.html).toContain('&quot;quotes&quot;');
    expect(t.html).toContain('&#39;single&#39;');
  });

  it('escapes HTML-significant characters in the encadrant name', () => {
    const t = reminderEmail({
      subject: 'Rappel',
      body: 'Bonjour',
      encadrantName: '<b>Evil</b>',
    });
    expect(t.html).not.toContain('<b>Evil</b>');
    expect(t.html).toContain('&lt;b&gt;Evil&lt;/b&gt;');
  });

  it('includes the encadrant name in the text signature', () => {
    const t = reminderEmail({
      subject: 'Rappel',
      body: 'Bonjour',
      encadrantName: 'Pr. Amadou Diallo',
    });
    expect(t.text).toContain('Pr. Amadou Diallo');
  });
});
