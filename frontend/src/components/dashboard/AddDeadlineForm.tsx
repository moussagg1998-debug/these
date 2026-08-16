// Banani `AddDeadlineForm.jsx` — "Ajouter une échéance" modal.
//
// Field-scope notes (see .planning/banani/phase-5-deadlines.md):
// - "Étudiant" selects a thesis (POST target is /api/theses/[id]/deadlines,
//   scoped per-thesis, not per-student).
// - "Chapitre ou livrable" maps to `title`; "Priorité" (Normale/Haute/
//   Urgente) maps 1:1 onto the existing `urgency` enum (low/medium/high).
// - The reminder checkbox maps to `Deadline.remindEnabled` (default true) —
//   the deadline-reminder cron already scans every deadline due within 3
//   days and notifies the encadrant; unchecking this opts this one deadline
//   out of that scan.
'use client';

import { useState, type FormEvent } from 'react';
import { api, ApiError } from '@/lib/api';
import { Icon } from '@/components/ui/Icon';
import { displayName, type ThesisDeadline, type ThesisListItem } from '@/lib/theses';

const PRIORITIES = [
  { value: 'low', label: 'Normale', selectedClass: 'bg-secondary text-secondary-foreground' },
  { value: 'medium', label: 'Haute', selectedClass: 'bg-warning text-warning-foreground' },
  {
    value: 'high',
    label: 'Urgente',
    selectedClass: 'bg-danger text-danger-foreground font-semibold',
  },
] as const;

const ERROR_MESSAGES: Record<string, string> = {
  ENCADRANT_ONLY: 'Seul le/la responsable de cette thèse peut ajouter une échéance.',
  VALIDATION_FAILED: 'Vérifiez les champs du formulaire.',
};

interface AddDeadlineFormProps {
  theses: ThesisListItem[];
  onClose: () => void;
  onCreated: (deadline: ThesisDeadline, studentName: string) => void;
}

export function AddDeadlineForm({ theses, onClose, onCreated }: AddDeadlineFormProps) {
  const [thesisId, setThesisId] = useState('');
  const [title, setTitle] = useState('');
  const [dueAt, setDueAt] = useState('');
  const [urgency, setUrgency] = useState<(typeof PRIORITIES)[number]['value']>('low');
  const [description, setDescription] = useState('');
  const [remindEnabled, setRemindEnabled] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    if (!thesisId) {
      setError('Sélectionnez un étudiant.');
      return;
    }
    setError(null);
    setSubmitting(true);
    try {
      const deadline = await api<ThesisDeadline>(`/api/theses/${thesisId}/deadlines`, {
        method: 'POST',
        body: {
          title,
          dueAt: new Date(dueAt).toISOString(),
          urgency,
          remindEnabled,
          ...(description.trim() ? { description: description.trim() } : {}),
        },
      });
      const thesis = theses.find((t) => t.id === thesisId);
      onCreated(deadline, thesis ? displayName(thesis.student) : '');
    } catch (err) {
      if (err instanceof ApiError) {
        setError(ERROR_MESSAGES[err.code] ?? err.message);
      } else {
        setError('Une erreur est survenue.');
      }
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 px-4 motion-safe:animate-fade-in">
      <div className="bg-surface rounded-lg shadow-2xl w-96 max-w-full motion-safe:animate-scale-in">
        <div className="px-6 py-4 border-b border-border flex items-center justify-between">
          <h2 className="text-lg font-semibold font-headings text-foreground">
            Ajouter une échéance
          </h2>
          <button
            type="button"
            onClick={onClose}
            className="text-muted-foreground transition duration-150 hover:text-foreground motion-safe:active:scale-90"
            aria-label="Fermer"
          >
            <Icon i="x" size={18} />
          </button>
        </div>

        <form onSubmit={onSubmit}>
          <div className="px-6 py-5 flex flex-col gap-4">
            <label className="flex flex-col gap-1.5">
              <span className="text-xs font-medium uppercase tracking-widest text-muted-foreground">
                Étudiant
              </span>
              <select
                required
                value={thesisId}
                onChange={(e) => setThesisId(e.target.value)}
                className="border border-border rounded-sm px-3 py-2.5 text-sm text-foreground bg-input outline-none"
              >
                <option value="">Sélectionner…</option>
                {theses.map((t) => (
                  <option key={t.id} value={t.id}>
                    {displayName(t.student)}
                  </option>
                ))}
              </select>
            </label>

            <label className="flex flex-col gap-1.5">
              <span className="text-xs font-medium uppercase tracking-widest text-muted-foreground">
                Chapitre ou livrable
              </span>
              <input
                type="text"
                required
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                placeholder="Ex. Chapitre 2, Introduction, Dépôt final…"
                className="border border-border rounded-sm px-3 py-2.5 text-sm text-foreground bg-input outline-none"
              />
            </label>

            <label className="flex flex-col gap-1.5">
              <span className="text-xs font-medium uppercase tracking-widest text-muted-foreground">
                Date d&apos;échéance
              </span>
              <div className="relative">
                <input
                  type="date"
                  required
                  value={dueAt}
                  onChange={(e) => setDueAt(e.target.value)}
                  className="w-full border border-border rounded-sm px-3 py-2.5 pr-9 text-sm text-foreground bg-input outline-none"
                />
                <Icon
                  i="calendar"
                  size={14}
                  className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-primary"
                />
              </div>
            </label>

            <div className="flex flex-col gap-1.5">
              <span className="text-xs font-medium uppercase tracking-widest text-muted-foreground">
                Priorité
              </span>
              <div className="flex items-center gap-2">
                {PRIORITIES.map((p) => (
                  <button
                    key={p.value}
                    type="button"
                    onClick={() => setUrgency(p.value)}
                    className={`px-3 py-1.5 text-xs font-medium rounded-sm flex-1 text-center transition duration-150 motion-safe:active:scale-[0.97] ${
                      urgency === p.value
                        ? p.selectedClass
                        : 'bg-surface border border-border text-foreground hover:bg-input'
                    }`}
                  >
                    {p.label}
                  </button>
                ))}
              </div>
            </div>

            <label className="flex flex-col gap-1.5">
              <span className="text-xs font-medium uppercase tracking-widest text-muted-foreground">
                Description (optionnel)
              </span>
              <textarea
                rows={3}
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                placeholder="Ajouter un contexte ou des instructions…"
                className="border border-border rounded-sm px-3 py-2.5 text-sm text-foreground bg-input outline-none resize-none"
              />
            </label>

            <label className="w-full flex items-center gap-3 py-2 border-t border-border mt-2 cursor-pointer">
              <input
                type="checkbox"
                checked={remindEnabled}
                onChange={(e) => setRemindEnabled(e.target.checked)}
                className="w-4 h-4 cursor-pointer accent-primary"
              />
              <span className="text-sm text-foreground">Envoyer un rappel 3 jours avant</span>
            </label>

            {error && (
              <p role="alert" className="text-sm text-danger">
                {error}
              </p>
            )}
          </div>

          <div className="px-6 py-4 border-t border-border bg-input flex items-center justify-end gap-2">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 text-sm font-medium text-muted-foreground border border-border rounded-sm transition-colors duration-150 hover:bg-surface"
            >
              Annuler
            </button>
            <button
              type="submit"
              disabled={submitting}
              className="px-4 py-2 text-sm font-medium bg-primary text-primary-foreground rounded-sm disabled:opacity-50 transition duration-150 motion-safe:active:scale-[0.98]"
            >
              {submitting ? 'Création…' : "Créer l'échéance"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
