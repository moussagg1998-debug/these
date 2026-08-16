// "Profil" tab — folded in from Banani's `new_screen1.jsx` (previously
// mislabeled "Paramètres Utilisateur" / re-scoped out of the student side in
// Phase 7, resolved 2026-08-04). See
// .planning/banani/phase-10-encadrant-profile-tab.md for every field-scope
// decision (dropped phone/plan-tier/max-students, single "Nom complet"
// field, free-text grade with suggestions instead of a fixed taxonomy).
'use client';

import { useEffect, useState, type FormEvent, type KeyboardEvent } from 'react';
import { api, ApiError } from '@/lib/api';
import { useToast } from '@/contexts/ToastContext';
import { Icon } from '@/components/ui/Icon';

const GRADE_SUGGESTIONS = [
  'Assistant',
  'Maître-Assistant',
  'Maître de Conférences',
  'Professeur Titulaire',
  "Chargé d'Enseignement",
];

interface ProfileTabProfile {
  name: string | null;
  email: string;
  department: string | null;
  academicGrade: string | null;
  specialties: string[];
  bio: string | null;
  institution: { id: string; name: string } | null;
}

interface ProfileTabProps {
  profile: ProfileTabProfile;
  onSaved: () => void;
}

export function ProfileTab({ profile, onSaved }: ProfileTabProps) {
  const { toast } = useToast();
  const [name, setName] = useState(profile.name ?? '');
  const [department, setDepartment] = useState(profile.department ?? '');
  const [academicGrade, setAcademicGrade] = useState(profile.academicGrade ?? '');
  const [specialties, setSpecialties] = useState<string[]>(profile.specialties);
  const [specialtyInput, setSpecialtyInput] = useState('');
  const [bio, setBio] = useState(profile.bio ?? '');
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    setName(profile.name ?? '');
    setDepartment(profile.department ?? '');
    setAcademicGrade(profile.academicGrade ?? '');
    setSpecialties(profile.specialties);
    setBio(profile.bio ?? '');
  }, [profile]);

  function addSpecialty() {
    const value = specialtyInput.trim();
    if (!value || specialties.includes(value)) {
      setSpecialtyInput('');
      return;
    }
    setSpecialties((prev) => [...prev, value]);
    setSpecialtyInput('');
  }

  function onSpecialtyKeyDown(e: KeyboardEvent<HTMLInputElement>) {
    if (e.key === 'Enter' || e.key === ',') {
      e.preventDefault();
      addSpecialty();
    }
  }

  function removeSpecialty(value: string) {
    setSpecialties((prev) => prev.filter((s) => s !== value));
  }

  function onCancel() {
    setName(profile.name ?? '');
    setDepartment(profile.department ?? '');
    setAcademicGrade(profile.academicGrade ?? '');
    setSpecialties(profile.specialties);
    setSpecialtyInput('');
    setBio(profile.bio ?? '');
  }

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    setSaving(true);
    try {
      await api('/api/profile', {
        method: 'PATCH',
        body: {
          ...(name.trim() ? { name: name.trim() } : {}),
          department: department.trim(),
          academicGrade: academicGrade.trim(),
          specialties,
          bio: bio.trim(),
        },
      });
      onSaved();
      toast('Profil mis à jour.', 'success');
    } catch (err) {
      toast(err instanceof ApiError ? err.message : 'Une erreur est survenue.', 'error');
    } finally {
      setSaving(false);
    }
  }

  return (
    <form onSubmit={onSubmit} className="flex flex-col gap-8">
      <div>
        <h3 className="text-sm font-semibold font-headings text-foreground mb-5">
          Informations personnelles
        </h3>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <label className="flex flex-col gap-1.5">
            <span className="text-xs font-medium uppercase tracking-widest text-muted-foreground">
              Nom complet
            </span>
            <input
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              className="border border-border rounded-sm px-3 py-2.5 text-sm text-foreground bg-input outline-none"
            />
          </label>
          <label className="flex flex-col gap-1.5">
            <span className="text-xs font-medium uppercase tracking-widest text-muted-foreground">
              Email
            </span>
            <div className="border border-border rounded-sm px-3 py-2.5 text-sm text-muted-foreground bg-input flex items-center justify-between">
              <span className="truncate">{profile.email}</span>
              <Icon i="check-circle" size={14} className="text-success shrink-0" />
            </div>
          </label>
        </div>
      </div>

      <div>
        <h3 className="text-sm font-semibold font-headings text-foreground mb-5">
          Informations académiques
        </h3>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <label className="flex flex-col gap-1.5">
            <span className="text-xs font-medium uppercase tracking-widest text-muted-foreground">
              Université / Institution
            </span>
            <div className="border border-border rounded-sm px-3 py-2.5 text-sm text-muted-foreground bg-input">
              {profile.institution?.name ?? '—'}
            </div>
          </label>
          <label className="flex flex-col gap-1.5">
            <span className="text-xs font-medium uppercase tracking-widest text-muted-foreground">
              Département
            </span>
            <input
              type="text"
              value={department}
              onChange={(e) => setDepartment(e.target.value)}
              placeholder="Ex. Sciences Économiques et Gestion"
              className="border border-border rounded-sm px-3 py-2.5 text-sm text-foreground bg-input outline-none"
            />
          </label>
          <label className="flex flex-col gap-1.5 sm:col-span-2">
            <span className="text-xs font-medium uppercase tracking-widest text-muted-foreground">
              Grade
            </span>
            <input
              type="text"
              list="grade-suggestions"
              value={academicGrade}
              onChange={(e) => setAcademicGrade(e.target.value)}
              placeholder="Ex. Maître de Conférences"
              className="border border-border rounded-sm px-3 py-2.5 text-sm text-foreground bg-input outline-none"
            />
            <datalist id="grade-suggestions">
              {GRADE_SUGGESTIONS.map((g) => (
                <option key={g} value={g} />
              ))}
            </datalist>
          </label>
          <div className="flex flex-col gap-1.5 sm:col-span-2">
            <span className="text-xs font-medium uppercase tracking-widest text-muted-foreground">
              Domaines de spécialité
            </span>
            <div className="border border-border rounded-sm px-3 py-2.5 min-h-16 flex flex-wrap gap-2 items-start bg-input">
              {specialties.map((s) => (
                <span
                  key={s}
                  className="text-xs px-2 py-1 bg-secondary text-secondary-foreground rounded-sm flex items-center gap-1.5"
                >
                  {s}
                  <button
                    type="button"
                    onClick={() => removeSpecialty(s)}
                    aria-label={`Retirer ${s}`}
                    className="text-secondary-foreground/70 transition duration-150 hover:text-secondary-foreground motion-safe:active:scale-90"
                  >
                    <Icon i="x" size={10} />
                  </button>
                </span>
              ))}
              <input
                type="text"
                value={specialtyInput}
                onChange={(e) => setSpecialtyInput(e.target.value)}
                onKeyDown={onSpecialtyKeyDown}
                onBlur={addSpecialty}
                placeholder={specialties.length === 0 ? 'Ajouter une spécialité…' : 'Ajouter…'}
                className="text-xs bg-transparent outline-none flex-1 min-w-24 text-foreground"
              />
            </div>
          </div>
        </div>
      </div>

      <div>
        <h3 className="text-sm font-semibold font-headings text-foreground mb-5">Présentation</h3>
        <label className="flex flex-col gap-1.5">
          <span className="text-xs font-medium uppercase tracking-widest text-muted-foreground">
            Bio courte (visible par vos étudiants)
          </span>
          <textarea
            rows={4}
            value={bio}
            onChange={(e) => setBio(e.target.value)}
            className="border border-border rounded-sm px-3 py-2.5 text-sm text-foreground bg-input outline-none resize-none leading-relaxed"
          />
        </label>
      </div>

      <div className="flex items-center justify-end gap-2 pt-6 border-t border-border">
        <button
          type="button"
          onClick={onCancel}
          className="px-4 py-2 text-sm font-medium text-muted-foreground border border-border rounded-sm transition-colors duration-150 hover:bg-input"
        >
          Annuler
        </button>
        <button
          type="submit"
          disabled={saving}
          className="px-5 py-2 text-sm font-medium bg-primary text-primary-foreground rounded-sm disabled:opacity-50 transition duration-150 motion-safe:active:scale-[0.98]"
        >
          {saving ? 'Enregistrement…' : 'Enregistrer les modifications'}
        </button>
      </div>
    </form>
  );
}
