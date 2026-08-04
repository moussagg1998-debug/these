// Added alongside the Phase 9 calendar-export feature — see
// .planning/banani/phase-9-student-messaging.md.
import { describe, expect, it } from 'vitest';
import { buildIcs } from './ics';

describe('buildIcs', () => {
  const startAt = new Date('2026-04-10T14:00:00.000Z');

  it('produces a valid VCALENDAR/VEVENT shell', () => {
    const ics = buildIcs({ title: 'Réunion', startAt });
    expect(ics).toContain('BEGIN:VCALENDAR');
    expect(ics).toContain('BEGIN:VEVENT');
    expect(ics).toContain('END:VEVENT');
    expect(ics).toContain('END:VCALENDAR');
    expect(ics).toContain('DTSTART:20260410T140000Z');
    expect(ics).toContain('DTEND:20260410T150000Z'); // default 60min duration
    expect(ics).toContain('SUMMARY:Réunion');
  });

  it('respects a custom duration', () => {
    const ics = buildIcs({ title: 'Point rapide', startAt, durationMinutes: 15 });
    expect(ics).toContain('DTEND:20260410T141500Z');
  });

  it('escapes commas, semicolons, and newlines in text fields', () => {
    const ics = buildIcs({
      title: 'Chapitre 3, révision; méthodologie',
      startAt,
      description: 'Ligne 1\nLigne 2',
    });
    expect(ics).toContain('SUMMARY:Chapitre 3\\, révision\\; méthodologie');
    expect(ics).toContain('DESCRIPTION:Ligne 1\\nLigne 2');
  });

  it('omits DESCRIPTION when not provided', () => {
    const ics = buildIcs({ title: 'Sans notes', startAt });
    expect(ics).not.toContain('DESCRIPTION');
  });

  it('adds a VALARM when reminderMinutesBefore is set', () => {
    const ics = buildIcs({ title: 'Avec rappel', startAt, reminderMinutesBefore: 30 });
    expect(ics).toContain('BEGIN:VALARM');
    expect(ics).toContain('TRIGGER:-PT30M');
    expect(ics).toContain('END:VALARM');
  });

  it('omits VALARM when reminderMinutesBefore is not set', () => {
    const ics = buildIcs({ title: 'Sans rappel', startAt });
    expect(ics).not.toContain('VALARM');
  });

  it('generates a unique UID per call', () => {
    const a = buildIcs({ title: 'A', startAt });
    const b = buildIcs({ title: 'B', startAt });
    const uidA = a.match(/UID:(.+)/)?.[1];
    const uidB = b.match(/UID:(.+)/)?.[1];
    expect(uidA).toBeTruthy();
    expect(uidA).not.toEqual(uidB);
  });
});
