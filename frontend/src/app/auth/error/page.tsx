// /auth/error — landing page for OAuth callback failures.
//
// The callback (frontend/src/app/api/auth/oauth/google/callback/route.ts)
// builds redirects via `redirectToAuthError(code)` in
// frontend/src/lib/server/oauth/error-redirect.ts. That helper hard-codes
// `/auth/error?code=<CODE>` with five UPPERCASE codes (D-06 contract):
//   GOOGLE_EMAIL_NOT_VERIFIED
//   OAUTH_STATE_MISMATCH
//   OAUTH_CODE_EXCHANGE_FAILED
//   OAUTH_PROVIDER_DISABLED
//   OAUTH_GENERIC
//
// Unknown / missing codes fall back to a generic message.
'use client';

import { Suspense } from 'react';
import Link from 'next/link';
import { useSearchParams } from 'next/navigation';
import { Icon } from '@/components/ui/Icon';

const ERROR_MESSAGES: Record<string, string> = {
  GOOGLE_EMAIL_NOT_VERIFIED:
    "Votre adresse Google n'est pas vérifiée. Vérifiez-la sur votre compte Google, puis réessayez.",
  OAUTH_STATE_MISMATCH:
    'La connexion a été interrompue (vérification de sécurité). Cela peut arriver si la page Google est restée ouverte trop longtemps — réessayez.',
  OAUTH_CODE_EXCHANGE_FAILED: 'Google a refusé la connexion. Réessayez dans un instant.',
  OAUTH_PROVIDER_DISABLED:
    'La connexion via Google n’est pas activée sur ce serveur. Contactez le support.',
  OAUTH_GENERIC: 'Une erreur inattendue est survenue pendant la connexion. Réessayez.',
};

function AuthErrorBody() {
  const params = useSearchParams();
  const code = params.get('code') ?? params.get('error') ?? '';
  const normalized = code.toUpperCase();
  const message =
    ERROR_MESSAGES[normalized] ??
    'Une erreur inconnue est survenue pendant la connexion. Réessayez.';

  return (
    <div className="flex min-h-screen bg-background font-body">
      <main className="mx-auto flex w-full max-w-md flex-col justify-center gap-6 px-4">
        <div className="mb-2 flex items-center">
          <img src="/logo.jpg" alt="ThèseFacile" className="h-8 w-auto" />
        </div>

        <div className="flex items-start gap-3 rounded-sm border border-border bg-input p-4">
          <Icon i="alert-circle" size={18} className="mt-0.5 shrink-0 text-danger" />
          <div>
            <h1 className="mb-1 font-headings text-lg font-semibold text-foreground">
              Échec de connexion
            </h1>
            <p className="text-sm text-muted-foreground">{message}</p>
            {code && <p className="mt-2 font-mono text-xs text-muted-foreground">code : {code}</p>}
          </div>
        </div>

        <div className="flex flex-col gap-2">
          <Link
            href="/login"
            className="rounded-sm bg-primary px-5 py-3 text-center text-sm font-medium text-primary-foreground"
          >
            Retour à la connexion
          </Link>
          <Link href="/" className="text-center text-sm text-muted-foreground underline">
            Accueil
          </Link>
        </div>
      </main>
    </div>
  );
}

export default function AuthErrorPage() {
  return (
    <Suspense fallback={null}>
      <AuthErrorBody />
    </Suspense>
  );
}
