// Shared "Se déconnecter" action for every authenticated shell (Encadrant
// Sidebar, StudentNav, AdminSidebar + their mobile drawers). Hard-navigates
// to /login after the session is invalidated (same window.location.href
// pattern already used for the Google OAuth handoff in /settings) rather
// than a client-side router.push — this fully discards in-memory React
// state so a browser back-button press after logout can't render a
// protected page from stale client state; the cleared auth cookies also
// mean any residual cached page's data fetches would 401 regardless.
'use client';

import { useState } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { Icon } from '@/components/ui/Icon';
import { ConfirmModal } from '@/components/ui/ConfirmModal';

interface LogoutButtonProps {
  className?: string;
  iconClassName?: string;
  iconOnly?: boolean;
  label?: string;
}

export function LogoutButton({
  className = '',
  iconClassName = '',
  iconOnly = false,
  label = 'Se déconnecter',
}: LogoutButtonProps) {
  const { logout } = useAuth();
  const [busy, setBusy] = useState(false);
  const [confirmOpen, setConfirmOpen] = useState(false);

  async function handleConfirm() {
    if (busy) return;
    setBusy(true);
    await logout();
    window.location.href = '/login';
  }

  return (
    <>
      <button
        type="button"
        onClick={() => setConfirmOpen(true)}
        disabled={busy}
        aria-label={label}
        title={iconOnly ? label : undefined}
        className={className}
      >
        <Icon i="log-out" size={14} className={iconClassName} />
        {!iconOnly && (busy ? 'Déconnexion…' : label)}
      </button>
      {confirmOpen && (
        <ConfirmModal
          title="Se déconnecter ?"
          description="Vous devrez vous reconnecter avec votre email et votre mot de passe (ou Google) pour retrouver votre espace."
          confirmLabel="Se déconnecter"
          confirmBusyLabel="Déconnexion…"
          tone="danger"
          busy={busy}
          onConfirm={() => void handleConfirm()}
          onCancel={() => setConfirmOpen(false)}
        />
      )}
    </>
  );
}
