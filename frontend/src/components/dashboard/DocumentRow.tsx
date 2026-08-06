// Banani `DocumentsLibraryScreen` inlined this row markup rather than
// shipping it as a shared component — extracted here since the project
// already has a "one row = one component" convention (StudentRow).
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

export function DocumentRow({ doc }: { doc: DocumentListItem }) {
  const stageClass = STAGE_COLORS[doc.thesis.stage] || 'bg-muted text-muted-foreground';

  return (
    <div className="flex flex-col gap-2 px-5 py-3 border-b border-border last:border-0 transition-colors duration-150 hover:bg-surface lg:flex-row lg:items-center lg:gap-4">
      <div className="flex items-center gap-2 text-sm text-foreground lg:w-40 lg:shrink-0">
        <Icon i="file-text" size={16} className="text-muted-foreground shrink-0" />
        <span className="truncate font-medium">{documentDisplayName(doc)}</span>
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
      <div className="flex items-center justify-end gap-1.5 lg:shrink-0 lg:w-16">
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
