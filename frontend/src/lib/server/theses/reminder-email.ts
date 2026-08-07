// Phase 16 — "Rappels groupés" email factory. Mirrors the shape of
// lib/server/auth/email-templates.ts (subject/html/text, HTML-escape all
// interpolated values) without editing that file — this is a ThèseFacile
// domain template, not a generic-starter auth template.
//
// Unlike the auth templates, the body here is free text the encadrant
// typed (already personalized per-recipient by the caller — {{prénom}}
// substitution happens in the route, not here). WR-03 still applies: every
// interpolated value MUST be escaped before landing in the HTML string.
import 'server-only';

export interface ReminderEmailArgs {
  /** Already personalized (e.g. {{prénom}} replaced) by the caller. */
  subject: string;
  /** Already personalized plain-text body — newlines become <br> in HTML. */
  body: string;
  encadrantName: string;
}

export interface ReminderEmailTemplate {
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

export function reminderEmail(args: ReminderEmailArgs): ReminderEmailTemplate {
  const subject = args.subject.trim();
  const encadrantName = htmlEscape(args.encadrantName);
  const bodyHtml = htmlEscape(args.body).replace(/\n/g, '<br>');

  return {
    subject,
    html: `<p>${bodyHtml}</p><hr><p style="color:#7A7569;font-size:12px;">Envoyé par ${encadrantName} via ThèseFacile.</p>`,
    text: `${args.body}\n\n— Envoyé par ${args.encadrantName} via ThèseFacile.`,
  };
}
