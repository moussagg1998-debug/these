// Simpler than the encadrant `DocumentRow` (components/dashboard/) — no
// student-name/stage columns needed, since this is already "my" documents.
// `commented` is a real derivation (≥1 Comment linked to this document),
// replacing Banani's 3-state status pill (En cours de révision/Commenté/
// Validé) — no schema field backs a "validated" verdict, only whether
// feedback exists (see phase-7-dashboard-etudiant.md).
import { documentDisplayName, formatDate, formatFileSize, type ThesisDocument } from '@/lib/theses';
import { Icon } from '@/components/ui/Icon';
import { Skeleton } from '@/components/ui/Skeleton';

interface StudentDocumentRowProps {
  doc: ThesisDocument;
  commented: boolean;
}

export function StudentDocumentRow({ doc, commented }: StudentDocumentRowProps) {
  const isPendingSchedule = !!doc.scheduledAt && new Date(doc.scheduledAt).getTime() > Date.now();

  return (
    <div className="flex items-center gap-4 px-5 py-3.5 border-b border-border last:border-0 transition-colors duration-150 hover:bg-input/40">
      <div className="w-8 h-8 rounded-sm bg-secondary text-secondary-foreground flex items-center justify-center shrink-0">
        <Icon i="file-text" size={14} />
      </div>
      <div className="flex-1 min-w-0">
        <div className="text-sm font-medium text-foreground truncate">
          {documentDisplayName(doc)}
        </div>
        <div className="text-xs text-muted-foreground mt-0.5">
          {formatDate(doc.uploadedAt)} · {formatFileSize(doc.sizeBytes)}
        </div>
      </div>
      {isPendingSchedule ? (
        <div className="flex items-center gap-1 text-xs font-medium px-2 py-1 rounded-sm shrink-0 bg-accent/10 text-accent">
          <Icon i="clock" size={11} />
          Programmé · {formatDate(doc.scheduledAt as string)}
        </div>
      ) : (
        <div
          className={`text-xs font-medium px-2 py-1 rounded-sm shrink-0 ${
            commented
              ? 'bg-secondary text-secondary-foreground'
              : 'bg-warning text-warning-foreground'
          }`}
        >
          {commented ? 'Commenté' : 'En attente de retour'}
        </div>
      )}
      <a
        href={doc.fileUrl}
        target="_blank"
        rel="noreferrer"
        className="text-muted-foreground"
        aria-label="Télécharger"
      >
        <Icon i="download" size={14} />
      </a>
    </div>
  );
}

export function StudentDocumentRowSkeleton() {
  return (
    <div className="flex items-center gap-4 px-5 py-3.5 border-b border-border last:border-0">
      <Skeleton className="h-8 w-8 shrink-0 rounded-sm" />
      <div className="flex-1 min-w-0 flex flex-col gap-1.5">
        <Skeleton className="h-3.5 w-32" />
        <Skeleton className="h-3 w-24" />
      </div>
      <Skeleton className="h-5 w-20 shrink-0" />
      <Skeleton className="h-3.5 w-3.5" />
    </div>
  );
}
