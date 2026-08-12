// Banani `AddStudentForm.jsx` — "Ajouter un étudiant" modal.
//
// Field-scope note (see .planning/banani/phase-3-encadrant-core.md): Banani's
// "Nom complet" field is NOT sent to POST /api/theses. The student's real
// name always comes from their own account, never from encadrant input —
// it's kept here only as a local "confirm who you're adding" step, and the
// success toast uses the server's real `student.name` instead.
'use client';

import { useState, type FormEvent } from 'react';
import { api, ApiError } from '@/lib/api';
import { Icon } from '@/components/ui/Icon';
import { UpgradeModal } from './UpgradeModal';
import type { ThesisListItem } from '@/lib/theses';

const STAGES = ['Rédaction', 'En attente', 'Révision', 'Bloqué', 'Soutenance'] as const;

const ERROR_MESSAGES: Record<string, string> = {
  STUDENT_NOT_FOUND:
    "Aucun compte étudiant n'existe avec cet email — l'étudiant doit d'abord créer son compte.",
  NOT_A_STUDENT: "Ce compte n'est pas un profil étudiant.",
  THESIS_ALREADY_EXISTS: 'Cet étudiant a déjà une thèse en cours.',
  VALIDATION_FAILED: 'Vérifiez les champs du formulaire.',
};

interface AddStudentFormProps {
  onClose: () => void;
  onCreated: (thesis: ThesisListItem & { student: { name: string | null; email: string } }) => void;
}

export function AddStudentForm({ onClose, onCreated }: AddStudentFormProps) {
  const [fullName, setFullName] = useState('');
  const [email, setEmail] = useState('');
  const [topic, setTopic] = useState('');
  const [stage, setStage] = useState<(typeof STAGES)[number]>('Rédaction');
  const [deadlineAt, setDeadlineAt] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [limitReached, setLimitReached] = useState(false);
  const [upgradeModalOpen, setUpgradeModalOpen] = useState(false);

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    if (!fullName.trim()) {
      setError('Saisissez le nom complet pour confirmer qui vous ajoutez.');
      return;
    }
    setError(null);
    setSubmitting(true);
    try {
      const thesis = await api<
        ThesisListItem & { student: { name: string | null; email: string } }
      >('/api/theses', {
        method: 'POST',
        body: {
          studentEmail: email,
          topic,
          stage,
          ...(deadlineAt ? { deadlineAt: new Date(deadlineAt).toISOString() } : {}),
        },
      });
      onCreated(thesis);
    } catch (err) {
      if (err instanceof ApiError) {
        if (err.code === 'STUDENT_LIMIT_REACHED') {
          setLimitReached(true);
        } else {
          setError(ERROR_MESSAGES[err.code] ?? err.message);
        }
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
            Ajouter un nouvel étudiant
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
                Nom complet
              </span>
              <input
                type="text"
                required
                value={fullName}
                onChange={(e) => setFullName(e.target.value)}
                placeholder="Ex. Fatou Sow"
                className="border border-border rounded-sm px-3 py-2.5 text-sm text-foreground bg-input outline-none"
              />
            </label>

            <label className="flex flex-col gap-1.5">
              <span className="text-xs font-medium uppercase tracking-widest text-muted-foreground">
                Adresse e-mail
              </span>
              <input
                type="email"
                required
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="fatou@universite.sn"
                className="border border-border rounded-sm px-3 py-2.5 text-sm text-foreground bg-input outline-none"
              />
            </label>

            <label className="flex flex-col gap-1.5">
              <span className="text-xs font-medium uppercase tracking-widest text-muted-foreground">
                Titre de la thèse / mémoire
              </span>
              <textarea
                required
                rows={2}
                value={topic}
                onChange={(e) => setTopic(e.target.value)}
                placeholder="Décrivez le sujet en 1-2 lignes"
                className="border border-border rounded-sm px-3 py-2.5 text-sm text-foreground bg-input outline-none resize-none"
              />
            </label>

            <label className="flex flex-col gap-1.5">
              <span className="text-xs font-medium uppercase tracking-widest text-muted-foreground">
                Étape actuelle
              </span>
              <select
                value={stage}
                onChange={(e) => setStage(e.target.value as (typeof STAGES)[number])}
                className="border border-border rounded-sm px-3 py-2.5 text-sm text-foreground bg-input outline-none"
              >
                {STAGES.map((s) => (
                  <option key={s} value={s}>
                    {s}
                  </option>
                ))}
              </select>
            </label>

            <label className="flex flex-col gap-1.5">
              <span className="text-xs font-medium uppercase tracking-widest text-muted-foreground">
                Échéance estimée
              </span>
              <div className="relative">
                <input
                  type="date"
                  value={deadlineAt}
                  onChange={(e) => setDeadlineAt(e.target.value)}
                  className="w-full border border-border rounded-sm px-3 py-2.5 pr-9 text-sm text-foreground bg-input outline-none"
                />
                <Icon
                  i="calendar"
                  size={14}
                  className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-primary"
                />
              </div>
            </label>

            {limitReached ? (
              <div className="flex flex-col gap-3 rounded-md border border-border bg-input p-4 text-center">
                <p className="text-sm text-foreground">
                  Limite d&apos;étudiants atteinte pour votre plan. Passez au plan Essentiel pour
                  ajouter davantage d&apos;étudiants.
                </p>
                <button
                  type="button"
                  onClick={() => setUpgradeModalOpen(true)}
                  className="rounded-sm bg-primary px-4 py-2 text-sm font-medium text-primary-foreground"
                >
                  Voir l&apos;offre Essentiel
                </button>
              </div>
            ) : (
              error && (
                <p role="alert" className="text-sm text-danger">
                  {error}
                </p>
              )
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
              {submitting ? 'Ajout…' : "Ajouter l'étudiant"}
            </button>
          </div>
        </form>
      </div>
      {upgradeModalOpen && <UpgradeModal onClose={() => setUpgradeModalOpen(false)} />}
    </div>
  );
}
