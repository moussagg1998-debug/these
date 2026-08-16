// Settings → Notifications → "Rappels d'échéances" — automatic email fired
// by the deadline-reminder cron when one of an encadrant's deadlines falls
// within the reminder window. Mirrors reminder-email.ts's shape (subject/
// html/text, escape every interpolated value — WR-03) — this is a
// ThèseFacile domain template, not a generic-starter auth template.
import 'server-only';

export interface DeadlineReminderEmailArgs {
  encadrantName: string;
  studentName: string;
  thesisTopic: string;
  deadlineTitle: string;
  /** Pre-formatted (server has no user date-format preference to read). */
  dueAtLabel: string;
  daysUntilDue: number;
}

export interface DeadlineReminderEmailTemplate {
  subject: string;
  html: string;
  text: string;
}

function htmlEscape(s: string): string {
  return s
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

export function deadlineReminderEmail(
  args: DeadlineReminderEmailArgs,
): DeadlineReminderEmailTemplate {
  const encadrantName = htmlEscape(args.encadrantName);
  const studentName = htmlEscape(args.studentName);
  const thesisTopic = htmlEscape(args.thesisTopic);
  const deadlineTitle = htmlEscape(args.deadlineTitle);
  const dueAtLabel = htmlEscape(args.dueAtLabel);
  const dayLabel =
    args.daysUntilDue <= 0
      ? "aujourd'hui"
      : `dans ${args.daysUntilDue} jour${args.daysUntilDue > 1 ? 's' : ''}`;
  const subject = `Échéance à venir : ${args.deadlineTitle}`;

  return {
    subject,
    html: `<p>Bonjour ${encadrantName},</p><p><strong>${deadlineTitle}</strong> pour ${studentName} (${thesisTopic}) arrive à échéance ${dayLabel}, le ${dueAtLabel}.</p><hr><p style="color:#7A7569;font-size:12px;">Rappel automatique envoyé par ThèseFacile — désactivable dans Paramètres &gt; Notifications.</p>`,
    text: `Bonjour ${args.encadrantName},\n\n${args.deadlineTitle} pour ${args.studentName} (${args.thesisTopic}) arrive à échéance ${dayLabel}, le ${args.dueAtLabel}.\n\n— Rappel automatique envoyé par ThèseFacile.`,
  };
}
