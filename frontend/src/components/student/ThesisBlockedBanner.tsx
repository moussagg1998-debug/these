// Shown wherever the student could otherwise act on their thesis (dashboard,
// messaging, comments, file upload) once the encadrant sets Thesis.stage to
// "Bloqué" — mirrors the server-side THESIS_BLOCKED guard on
// POST /api/theses/[id]/{documents,messages,comments}. Read access stays
// open; only the student's own write actions are disabled.
import { Icon } from '@/components/ui/Icon';

export function ThesisBlockedBanner() {
  return (
    <div className="flex items-start gap-3 rounded-md border border-danger/30 bg-danger/5 p-4">
      <Icon i="alert-triangle" size={16} className="mt-0.5 shrink-0 text-danger" />
      <div>
        <div className="text-sm font-medium text-danger">Votre espace est bloqué</div>
        <p className="mt-0.5 text-xs text-danger/80">
          Votre encadrant a mis votre mémoire en pause. Vous ne pouvez pas déposer de document,
          envoyer de message ou commenter tant que ce statut n&apos;a pas changé.
        </p>
      </div>
    </div>
  );
}
