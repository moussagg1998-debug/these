// Minimal RFC 5545 (iCalendar) VEVENT generator for the "add to calendar"
// export feature (see .planning/banani/phase-9-student-messaging.md). No
// Google/Outlook Calendar API integration exists (would need a separate
// OAuth scope beyond the sign-in-only Google integration this app has), so
// this produces a generic .ics file any calendar app can import.
export interface IcsEventInput {
  title: string;
  startAt: Date;
  durationMinutes?: number;
  description?: string;
  /** Minutes before startAt to fire a VALARM reminder. Omit for no reminder. */
  reminderMinutesBefore?: number;
}

function toIcsDate(d: Date): string {
  return `${d.toISOString().replace(/[-:]/g, '').split('.')[0]}Z`;
}

function escapeIcsText(s: string): string {
  return s.replace(/\\/g, '\\\\').replace(/;/g, '\\;').replace(/,/g, '\\,').replace(/\n/g, '\\n');
}

export function buildIcs({
  title,
  startAt,
  durationMinutes = 60,
  description,
  reminderMinutesBefore,
}: IcsEventInput): string {
  const endAt = new Date(startAt.getTime() + durationMinutes * 60_000);
  const uid = `${startAt.getTime()}-${Math.random().toString(36).slice(2)}@thesefacile`;

  const lines = [
    'BEGIN:VCALENDAR',
    'VERSION:2.0',
    'PRODID:-//ThèseFacile//FR',
    'BEGIN:VEVENT',
    `UID:${uid}`,
    `DTSTAMP:${toIcsDate(new Date())}`,
    `DTSTART:${toIcsDate(startAt)}`,
    `DTEND:${toIcsDate(endAt)}`,
    `SUMMARY:${escapeIcsText(title)}`,
  ];

  if (description) {
    lines.push(`DESCRIPTION:${escapeIcsText(description)}`);
  }

  if (reminderMinutesBefore !== undefined) {
    lines.push(
      'BEGIN:VALARM',
      'ACTION:DISPLAY',
      `DESCRIPTION:${escapeIcsText(title)}`,
      `TRIGGER:-PT${reminderMinutesBefore}M`,
      'END:VALARM',
    );
  }

  lines.push('END:VEVENT', 'END:VCALENDAR');
  return lines.join('\r\n');
}

export function downloadIcs(filename: string, content: string): void {
  const blob = new Blob([content], { type: 'text/calendar;charset=utf-8' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}
