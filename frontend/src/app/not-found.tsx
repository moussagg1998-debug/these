// Branded 404. Next.js sets the response status to 404 automatically for
// this file — no explicit status handling needed here.
import Link from 'next/link';

export default function NotFound() {
  return (
    <main className="flex min-h-screen flex-col items-center justify-center gap-4 bg-background px-4 text-center">
      <img src="/logo.jpg" alt="ThèseFacile" className="h-12 w-auto" />
      <h1 className="font-headings text-2xl font-semibold text-foreground">Page introuvable</h1>
      <p className="max-w-sm text-sm text-muted-foreground">
        La page que vous cherchez n&apos;existe pas ou a été déplacée.
      </p>
      <Link
        href="/"
        className="mt-2 rounded-sm bg-primary px-6 py-3 text-sm font-medium text-primary-foreground transition duration-150 motion-safe:hover:-translate-y-0.5 motion-safe:active:scale-[0.98]"
      >
        Retour à l&apos;accueil
      </Link>
    </main>
  );
}
