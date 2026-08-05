// Dépôt de fichier étudiant — Banani `StudentFileUpload.jsx`.
//
// See .planning/banani/phase-8-student-file-upload.md for every field-scope
// decision (dropped version field, "notes" reused as a linked Comment,
// dropped chapter-position/timeline boxes, "Programmer le dépôt" inert).
'use client';

import { useState, type ChangeEvent, type DragEvent, type FormEvent } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { api, ApiError } from '@/lib/api';
import { uploadFile } from '@/lib/uploadFile';
import { useToast } from '@/contexts/ToastContext';
import { Icon } from '@/components/ui/Icon';
import { StudentShell } from './StudentShell';
import type { ThesisDocument } from '@/lib/theses';

const ACCEPTED_EXTENSIONS = ['.pdf', '.docx', '.odt'];
const ACCEPTED_ATTR =
  '.pdf,.docx,.odt,application/pdf,application/vnd.openxmlformats-officedocument.wordprocessingml.document,application/vnd.oasis.opendocument.text';
// Client-side pre-check only, for UX (fast feedback before a round trip) —
// the server remains the real trust boundary via UPLOAD_ALLOWED_MIME +
// magic-byte sniffing, same invariant as every other upload in this starter.
const MAX_SIZE_BYTES = 10 * 1024 * 1024;

const CHAPTER_SUGGESTIONS = [
  'Introduction',
  'Chapitre 1',
  'Chapitre 2',
  'Chapitre 3',
  'Chapitre 4',
  'Chapitre 5',
  'Conclusion',
];

const ERROR_MESSAGES: Record<string, string> = {
  STORAGE_NOT_CONFIGURED:
    "Le stockage de fichiers n'est pas encore configuré par votre établissement.",
  UPLOAD_MISSING_FILE: 'Aucun fichier reçu — réessayez.',
  FILE_TOO_LARGE: 'Le fichier dépasse la taille maximale autorisée (10 Mo).',
  INVALID_MIME: "Ce type de fichier n'est pas accepté (formats acceptés : PDF, DOCX, ODT).",
  MAGIC_BYTE_MISMATCH: 'Le contenu du fichier ne correspond pas au format déclaré.',
  UPLOAD_FAILED: 'Le téléversement a échoué — réessayez.',
  STUDENT_ONLY: "Seul l'étudiant peut déposer un document.",
  VALIDATION_FAILED: 'Vérifiez les champs du formulaire.',
};

interface StudentFileUploadFormProps {
  thesisId: string;
  name: string;
}

export function StudentFileUploadForm({ thesisId, name }: StudentFileUploadFormProps) {
  const router = useRouter();
  const { toast } = useToast();
  const [file, setFile] = useState<File | null>(null);
  const [dragActive, setDragActive] = useState(false);
  const [chapter, setChapter] = useState('');
  const [notes, setNotes] = useState('');
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
      setError('Sélectionnez un fichier à déposer.');
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
          ...(chapter.trim() ? { chapter: chapter.trim() } : {}),
        },
      });

      if (notes.trim()) {
        // Best-effort — the document deposit already succeeded and is what
        // matters. See plan doc: notes become a Comment linked to the
        // document rather than a new schema field.
        await api(`/api/theses/${thesisId}/comments`, {
          method: 'POST',
          body: { body: notes.trim(), documentId: document.id },
        }).catch(() => {});
      }

      toast('Document déposé avec succès', 'success');
      router.push('/dashboard');
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
    <StudentShell name={name} active="documents">
      <div className="max-w-5xl mx-auto px-4 py-6 sm:px-8">
        <h1 className="text-lg font-semibold font-headings text-foreground mb-6">
          Déposer un document
        </h1>

        <form onSubmit={onSubmit} className="flex flex-col lg:flex-row gap-6">
          <div className="flex-1 flex flex-col gap-5 min-w-0">
            <div
              onDragOver={(e) => {
                e.preventDefault();
                setDragActive(true);
              }}
              onDragLeave={() => setDragActive(false)}
              onDrop={onDrop}
              className={`border-2 border-dashed rounded-md p-8 text-center transition-colors ${
                dragActive ? 'border-primary bg-secondary' : 'border-border'
              }`}
            >
              <Icon i="file-up" size={28} className="mx-auto mb-3 text-muted-foreground" />
              {file ? (
                <div className="text-sm font-medium text-foreground mb-3">{file.name}</div>
              ) : (
                <>
                  <p className="text-sm text-foreground mb-1">Glissez-déposez votre fichier ici</p>
                  <p className="text-xs text-muted-foreground mb-3">ou</p>
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
              <p className="text-xs text-muted-foreground mt-3">
                Max 10 Mo — Formats : .docx, .pdf, .odt
              </p>
            </div>

            <label className="flex flex-col gap-1.5">
              <span className="text-xs font-medium uppercase tracking-widest text-muted-foreground">
                Chapitre
              </span>
              <input
                type="text"
                list="chapter-suggestions"
                value={chapter}
                onChange={(e) => setChapter(e.target.value)}
                placeholder="Ex. Chapitre 4 — Résultats"
                className="border border-border rounded-sm px-3 py-2.5 text-sm text-foreground bg-input outline-none"
              />
              <datalist id="chapter-suggestions">
                {CHAPTER_SUGGESTIONS.map((c) => (
                  <option key={c} value={c} />
                ))}
              </datalist>
            </label>

            <label className="flex flex-col gap-1.5">
              <span className="text-xs font-medium uppercase tracking-widest text-muted-foreground">
                Notes (optionnel)
              </span>
              <textarea
                rows={4}
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                placeholder="Ajoutez un contexte pour votre encadrant…"
                className="border border-border rounded-sm px-3 py-2.5 text-sm text-foreground bg-input outline-none resize-none"
              />
            </label>

            {error && (
              <p role="alert" className="text-sm text-danger">
                {error}
              </p>
            )}
          </div>

          <div className="w-full lg:w-64 shrink-0 flex flex-col gap-3">
            <div className="border border-border rounded-md p-4 bg-surface flex flex-col gap-2">
              <div className="text-xs font-medium uppercase tracking-widest text-muted-foreground mb-1">
                Actions
              </div>
              <button
                type="submit"
                disabled={submitting}
                className="w-full flex items-center justify-center gap-1.5 text-sm font-medium bg-primary text-primary-foreground py-2.5 rounded-sm disabled:opacity-50"
              >
                <Icon i="upload" size={14} />
                {submitting ? 'Dépôt en cours…' : 'Déposer le document'}
              </button>
              <button
                type="button"
                disabled
                title="Bientôt disponible"
                className="w-full flex items-center justify-center gap-1.5 text-sm font-medium border border-border text-muted-foreground py-2.5 rounded-sm cursor-not-allowed opacity-60"
              >
                <Icon i="clock" size={14} />
                Programmer le dépôt
              </button>
            </div>
            <Link href="/dashboard" className="text-xs text-center text-muted-foreground py-2">
              Annuler et revenir au tableau de bord
            </Link>
          </div>
        </form>
      </div>
    </StudentShell>
  );
}
