// Banani `DocumentsLibraryScreen` inlined this row markup rather than
// shipping it as a shared component — extracted here since the project
// already has a "one row = one component" convention (StudentRow). A row
// where `replyToDocumentId` is set is an encadrant correction, not a
// student deposit — it shows a badge instead of the "send correction"
// action (you can't reply to a reply).
import {
  STAGE_COLORS,
  displayName,
  documentDisplayName,
  documentFormat,
  formatDate,
  formatFileSize,
  type DocumentListItem,
} from '@/lib/theses';
import { Icon } from '@/components/ui/Icon';
import { Skeleton } from '@/components/ui/Skeleton';

interface DocumentRowProps {
  doc: DocumentListItem;
  onSendCorrection: (doc: DocumentListItem) => void;
  /** Display name of the document this one replies to, when known. */
  replyToLabel?: string | null;
}

export function DocumentRow({ doc, onSendCorrection, replyToLabel }: DocumentRowProps) {
  const stageClass = STAGE_COLORS[doc.thesis.stage] || 'bg-muted text-muted-foreground';
  const isCorrection = doc.replyToDocumentId != null;

  return (
    <div className="flex flex-col gap-2 px-5 py-3 border-b border-border last:border-0 transition-colors duration-150 hover:bg-surface lg:flex-row lg:items-center lg:gap-4">
      <div className="flex items-center gap-2 text-sm text-foreground lg:w-40 lg:shrink-0">
        <Icon i="file-text" size={16} className="text-muted-foreground shrink-0" />
        <div className="min-w-0">
          <span className="truncate font-medium block">{documentDisplayName(doc)}</span>
          {isCorrection && (
            <span className="truncate block text-xs text-muted-foreground">
              {replyToLabel ? `↳ réponse à ${replyToLabel}` : "Correction de l'encadrant"}
            </span>
          )}
        </div>
      </div>
      <div className="flex flex-wrap items-center gap-3 text-xs text-muted-foreground lg:contents lg:text-sm">
        <div className="lg:w-48 lg:shrink-0 lg:text-foreground">
          {displayName(doc.thesis.student)}
        </div>
        <div
          className={`lg:w-28 lg:shrink-0 font-medium px-2 py-1 rounded-sm text-center ${stageClass}`}
        >
          {doc.thesis.stage}
        </div>
        <div className="lg:w-32 lg:shrink-0">{formatDate(doc.uploadedAt)}</div>
        <div className="lg:w-20 lg:shrink-0">{formatFileSize(doc.sizeBytes)}</div>
        <div className="lg:flex-1 uppercase font-medium">{documentFormat(doc)}</div>
      </div>
      <div className="flex items-center justify-end gap-2 lg:shrink-0 lg:w-28">
        {isCorrection ? (
          <span className="text-xs font-medium px-2 py-1 rounded-sm bg-accent/10 text-accent">
            Correction
          </span>
        ) : (
          <button
            type="button"
            onClick={() => onSendCorrection(doc)}
            aria-label="Envoyer une correction"
            className="text-muted-foreground transition-colors duration-150 hover:text-foreground"
          >
            <Icon i="send" size={14} />
          </button>
        )}
        <a
          href={doc.fileUrl}
          target="_blank"
          rel="noreferrer"
          className="text-muted-foreground transition-colors duration-150 hover:text-foreground"
          aria-label="Télécharger"
        >
          <Icon i="download" size={14} />
        </a>
      </div>
    </div>
  );
}

export function DocumentRowSkeleton() {
  return (
    <div className="flex flex-col gap-2 px-5 py-3 border-b border-border last:border-0 lg:flex-row lg:items-center lg:gap-4">
      <div className="flex items-center gap-2 lg:w-40 lg:shrink-0">
        <Skeleton className="h-4 w-4" />
        <Skeleton className="h-3.5 w-24" />
      </div>
      <div className="flex flex-wrap items-center gap-3 lg:contents">
        <Skeleton className="h-3.5 w-28 lg:w-48" />
        <Skeleton className="h-5 w-16 lg:w-28" />
        <Skeleton className="h-3.5 w-20 lg:w-32" />
        <Skeleton className="h-3.5 w-10 lg:w-20" />
        <Skeleton className="h-3.5 w-10 lg:flex-1" />
      </div>
      <div className="flex items-center justify-end lg:shrink-0 lg:w-28">
        <Skeleton className="h-3.5 w-3.5" />
      </div>
    </div>
  );
}
