// "Envoyer une correction" modal — the encadrant replies to a specific
// student deposit with a file. Same upload plumbing as
// StudentFileUploadForm (/api/upload → /api/theses/[id]/documents),
// condensed into a modal (like UpgradeModal) since the action always
// starts from one specific DocumentRow rather than a dedicated page.
'use client';

import { useState, type ChangeEvent, type DragEvent, type FormEvent } from 'react';
import { api, ApiError } from '@/lib/api';
import { uploadFile } from '@/lib/uploadFile';
import { Icon } from '@/components/ui/Icon';
import { formatFileSize, type ThesisDocument } from '@/lib/theses';

const ACCEPTED_EXTENSIONS = ['.pdf', '.docx', '.odt'];
const ACCEPTED_ATTR =
  '.pdf,.docx,.odt,application/pdf,application/vnd.openxmlformats-officedocument.wordprocessingml.document,application/vnd.oasis.opendocument.text';
// Client-side pre-check only, for UX — the server remains the real trust
// boundary via UPLOAD_ALLOWED_MIME + magic-byte sniffing.
const MAX_SIZE_BYTES = 10 * 1024 * 1024;

const ERROR_MESSAGES: Record<string, string> = {
  STORAGE_NOT_CONFIGURED:
    "Le stockage de fichiers n'est pas encore configuré par votre établissement.",
  UPLOAD_MISSING_FILE: 'Aucun fichier reçu — réessayez.',
  FILE_TOO_LARGE: 'Le fichier dépasse la taille maximale autorisée (10 Mo).',
  INVALID_MIME: "Ce type de fichier n'est pas accepté (formats acceptés : PDF, DOCX, ODT).",
  MAGIC_BYTE_MISMATCH: 'Le contenu du fichier ne correspond pas au format déclaré.',
  UPLOAD_FAILED: 'Le téléversement a échoué — réessayez.',
  VALIDATION_FAILED: 'Vérifiez les champs du formulaire.',
  INVALID_REPLY_TARGET: 'Ce document ne peut plus recevoir de correction.',
};

interface SendCorrectionModalProps {
  thesisId: string;
  replyToDocumentId: string;
  chapterHint?: string | null;
  onClose: () => void;
  onSent: () => void;
}

export function SendCorrectionModal({
  thesisId,
  replyToDocumentId,
  chapterHint,
  onClose,
  onSent,
}: SendCorrectionModalProps) {
  const [file, setFile] = useState<File | null>(null);
  const [dragActive, setDragActive] = useState(false);
  const [chapter, setChapter] = useState(chapterHint ?? '');
  const [note, setNote] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  function validateAndSetFile(f: File) {
    if (f.size > MAX_SIZE_BYTES) {
      setError('Le fichier dépasse la taille maximale autorisée (10 Mo).');
      return;
    }
    const ext = f.name.slice(f.name.lastIndexOf('.')).toLowerCase();
    if (!ACCEPTED_EXTENSIONS.includes(ext)) {
      setError("Ce type de fichier n'est pas accepté (formats acceptés : PDF, DOCX, ODT).");
      return;
    }
    setError(null);
    setFile(f);
  }

  function onFileChange(e: ChangeEvent<HTMLInputElement>) {
    const f = e.target.files?.[0];
    if (f) validateAndSetFile(f);
  }

  function onDrop(e: DragEvent<HTMLDivElement>) {
    e.preventDefault();
    setDragActive(false);
    const f = e.dataTransfer.files?.[0];
    if (f) validateAndSetFile(f);
  }

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    if (!file) {
      setError('Sélectionnez un fichier à envoyer.');
      return;
    }
    setError(null);
    setSubmitting(true);
    try {
      const uploaded = await uploadFile(file);
      const document = await api<ThesisDocument>(`/api/theses/${thesisId}/documents`, {
        method: 'POST',
        body: {
          fileUrl: uploaded.url,
          fileName: uploaded.filename,
          sizeBytes: uploaded.sizeBytes,
          replyToDocumentId,
          ...(chapter.trim() ? { chapter: chapter.trim() } : {}),
        },
      });

      if (note.trim()) {
        // Best-effort — the document send already succeeded and is what
        // matters, same pattern as StudentFileUploadForm's notes.
        await api(`/api/theses/${thesisId}/comments`, {
          method: 'POST',
          body: { body: note.trim(), documentId: document.id },
        }).catch(() => {});
      }

      onSent();
    } catch (err) {
      if (err instanceof ApiError) {
        setError(ERROR_MESSAGES[err.code] ?? err.message);
      } else {
        setError('Une erreur est survenue.');
      }
      setSubmitting(false);
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 px-4">
      <div className="w-full max-w-md rounded-md border border-border bg-surface p-6">
        <div className="mb-4 flex items-center justify-between">
          <h3 className="font-headings text-base font-semibold text-foreground">
            Envoyer une correction
          </h3>
          <button
            type="button"
            onClick={onClose}
            aria-label="Fermer"
            className="text-muted-foreground"
          >
            <Icon i="x" size={18} />
          </button>
        </div>
        <form onSubmit={onSubmit} className="flex flex-col gap-3">
          <div
            onDragOver={(e) => {
              e.preventDefault();
              setDragActive(true);
            }}
            onDragLeave={() => setDragActive(false)}
            onDrop={onDrop}
            className={`border-2 border-dashed rounded-md p-6 text-center transition-colors ${
              dragActive ? 'border-primary bg-secondary' : 'border-border'
            }`}
          >
            {file ? (
              <div className="flex items-center gap-3 rounded-md border border-border bg-surface px-3 py-2.5 text-left">
                <div className="w-9 h-9 rounded-sm bg-secondary text-secondary-foreground flex items-center justify-center shrink-0">
                  <Icon i="file-text" size={16} />
                </div>
                <div className="flex-1 min-w-0">
                  <div className="text-sm font-medium text-foreground truncate">{file.name}</div>
                  <div className="text-xs text-muted-foreground mt-0.5">
                    {file.name.slice(file.name.lastIndexOf('.') + 1).toUpperCase()} ·{' '}
                    {formatFileSize(file.size)}
                  </div>
                </div>
                <button
                  type="button"
                  onClick={() => setFile(null)}
                  aria-label="Retirer le fichier"
                  className="shrink-0 text-muted-foreground hover:text-foreground"
                >
                  <Icon i="x" size={14} />
                </button>
              </div>
            ) : (
              <>
                <Icon i="file-up" size={24} className="mx-auto mb-2 text-muted-foreground" />
                <p className="text-sm text-foreground mb-1">Glissez-déposez votre fichier ici</p>
                <p className="text-xs text-muted-foreground mb-2">ou</p>
              </>
            )}
            <label className="inline-flex items-center gap-1.5 text-xs font-medium text-primary border border-primary rounded-sm px-3 py-1.5 cursor-pointer">
              <Icon i="upload" size={12} />
              {file ? 'Changer de fichier' : 'Parcourir'}
              <input
                type="file"
                accept={ACCEPTED_ATTR}
                className="hidden"
                onChange={onFileChange}
              />
            </label>
            <p className="text-xs text-muted-foreground mt-2">
              Max 10 Mo — Formats : .docx, .pdf, .odt
            </p>
          </div>

          <label className="flex flex-col gap-1.5">
            <span className="text-xs font-medium uppercase tracking-widest text-muted-foreground">
              Chapitre
            </span>
            <input
              type="text"
              value={chapter}
              onChange={(e) => setChapter(e.target.value)}
              placeholder="Ex. Chapitre 3"
              className="rounded-sm border border-border bg-input px-3 py-2 text-sm text-foreground outline-none focus:border-primary"
            />
          </label>

          <label className="flex flex-col gap-1.5">
            <span className="text-xs font-medium uppercase tracking-widest text-muted-foreground">
              Note (optionnel)
            </span>
            <textarea
              rows={3}
              value={note}
              onChange={(e) => setNote(e.target.value)}
              placeholder="Ajoutez un commentaire pour l'étudiant…"
              className="rounded-sm border border-border bg-input px-3 py-2 text-sm text-foreground outline-none resize-none focus:border-primary"
            />
          </label>

          {error && (
            <p role="alert" className="text-sm text-danger">
              {error}
            </p>
          )}

          <button
            type="submit"
            disabled={submitting}
            className="mt-1 flex items-center justify-center gap-1.5 rounded-sm bg-primary py-2.5 text-sm font-medium text-primary-foreground disabled:opacity-50"
          >
            <Icon i="send" size={14} />
            {submitting ? 'Envoi en cours…' : 'Envoyer'}
          </button>
        </form>
      </div>
    </div>
  );
}
