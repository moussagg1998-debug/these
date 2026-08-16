// Settings → "Général" (locale/timezone/dateFormat) is a ThèseFacile-specific
// concern that lives on /api/profile, not the generic starter's /api/auth/me
// — kept as its own tiny effect component (rather than folded into
// AuthContext) so the two stay decoupled. Runs once per session once a user
// is known, and syncs lib/datePreferences.ts so formatDate() (used by ~13
// call sites app-wide) honors the preference without threading it through
// every one of them.
'use client';

import { useEffect } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { api } from '@/lib/api';
import { setDatePreferences } from '@/lib/datePreferences';

interface ProfilePrefsResponse {
  timezone?: string;
  dateFormat?: string;
}

export function DatePreferencesSync() {
  const { user } = useAuth();

  useEffect(() => {
    if (!user) return;
    let cancelled = false;
    api<ProfilePrefsResponse>('/api/profile')
      .then((profile) => {
        if (!cancelled) {
          setDatePreferences({ timezone: profile.timezone, dateFormat: profile.dateFormat });
        }
      })
      .catch(() => {
        // Best-effort — keep the default ("long", matches the pre-existing
        // hardcoded format) if the profile isn't loadable yet (e.g. still
        // mid-onboarding).
      });
    return () => {
      cancelled = true;
    };
  }, [user]);

  return null;
}
