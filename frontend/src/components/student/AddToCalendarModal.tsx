// "Ajout au calendrier" — Banani `AddMeetingToCalendar.jsx`.
//
// Re-scoped from "schedule a meeting" (no Meeting model exists) to "export
// the thesis's next real Deadline as a downloadable .ics file" — see
// .planning/banani/phase-9-student-messaging.md for the full reasoning
// (dropped fake calendar-app selector, reworded sync copy for accuracy).
'use client';

import { useState } from 'react';
import { Icon } from '@/components/ui/Icon';
import { buildIcs, downloadIcs } from '@/lib/ics';
import { formatDate, type ThesisDeadline } from '@/lib/theses';

const REMINDER_OPTIONS = [
  { value: 15, label: '15 minutes avant' },
  { value: 30, label: '30 minutes avant' },
  { value: 60, label: '1 heure avant' },
  { value: 1440, label: '1 jour avant' },
];

interface AddToCalendarModalProps {
  deadline: ThesisDeadline;
  onClose: () => void;
}

export function AddToCalendarModal({ deadline, onClose }: AddToCalendarModalProps) {
  const [reminder, setReminder] = useState(60);
  const [notes, setNotes] = useState(deadline.description ?? '');

  function onDownload() {
    const ics = buildIcs({
      title: deadline.title,
      startAt: new Date(deadline.dueAt),
      reminderMinutesBefore: reminder,
      ...(notes.trim() ? { description: notes.trim() } : {}),
    });
    downloadIcs(`${deadline.title.replace(/[^a-z0-9]+/gi, '-').toLowerCase()}.ics`, ics);
    onClose();
  }

  return (
    <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 px-4 motion-safe:animate-fade-in">
      <div className="bg-surface border border-border rounded-lg shadow-lg w-full max-w-md p-6 flex flex-col gap-5 motion-safe:animate-scale-in">
        <div className="flex items-center justify-between">
          <h2 className="text-lg font-semibold font-headings text-foreground">
            Ajouter au calendrier
          </h2>
          <button
            type="button"
            onClick={onClose}
            className="text-muted-foreground transition duration-150 hover:text-foreground motion-safe:active:scale-90"
            aria-label="Fermer"
          >
            <Icon i="x" size={20} />
          </button>
        </div>

        <div className="bg-input rounded-md p-4 flex flex-col gap-1">
          <div className="flex items-start gap-3">
            <Icon i="calendar" size={18} className="text-primary shrink-0 mt-0.5" />
            <div className="flex-1 min-w-0">
              <div className="text-sm font-semibold text-foreground">{deadline.title}</div>
              <div className="text-xs text-muted-foreground mt-1">{formatDate(deadline.dueAt)}</div>
            </div>
          </div>
        </div>

        <label className="flex flex-col gap-1.5">
          <span className="text-xs font-medium text-foreground">Rappel</span>
          <select
            value={reminder}
            onChange={(e) => setReminder(Number(e.target.value))}
            className="border border-border rounded-md px-3 py-2 text-sm text-foreground bg-background outline-none"
          >
            {REMINDER_OPTIONS.map((o) => (
              <option key={o.value} value={o.value}>
                {o.label}
              </option>
            ))}
          </select>
        </label>

        <label className="flex flex-col gap-1.5">
          <span className="text-xs font-medium text-foreground">Notes (optionnel)</span>
          <textarea
            rows={3}
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            className="border border-border rounded-md px-3 py-2 text-sm text-foreground bg-background outline-none resize-none"
          />
        </label>

        <div className="flex items-center gap-3 pt-2">
          <button
            type="button"
            onClick={onDownload}
            className="flex-1 bg-primary text-primary-foreground text-sm font-medium py-2.5 rounded-md flex items-center justify-center transition duration-150 motion-safe:active:scale-[0.98]"
          >
            Ajouter à mon calendrier
          </button>
          <button
            type="button"
            onClick={onClose}
            className="flex-1 border border-border text-foreground text-sm font-medium py-2.5 rounded-md flex items-center justify-center transition-colors duration-150 hover:bg-input"
          >
            Annuler
          </button>
        </div>

        <p className="text-xs text-muted-foreground text-center">
          Le fichier téléchargé (.ics) peut être importé dans Google Calendar, Outlook, Apple
          Calendar, etc.
        </p>
      </div>
    </div>
  );
}
