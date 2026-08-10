import type { Metadata } from 'next';
import { Inter } from 'next/font/google';
import './globals.css';
import { ToastProvider } from '@/contexts/ToastContext';
import { AuthProvider } from '@/contexts/AuthContext';
import { DatePreferencesSync } from '@/contexts/DatePreferencesSync';
import { PageTransition } from '@/components/PageTransition';

const inter = Inter({
  subsets: ['latin'],
  variable: '--font-inter',
  display: 'swap',
});

const siteName = 'ThèseFacile';
const description =
  "Le suivi de thèses pensé pour les encadrants d'Afrique francophone : dépôt et versioning des documents, commentaires contextuels, échéances et tableau de bord en temps réel.";

export const metadata: Metadata = {
  metadataBase: new URL(process.env.APP_URL ?? 'http://localhost:3000'),
  title: {
    default: `${siteName} — Le suivi de thèses, enfin clair`,
    template: `%s · ${siteName}`,
  },
  description,
  openGraph: {
    type: 'website',
    locale: 'fr_FR',
    siteName,
    title: `${siteName} — Le suivi de thèses, enfin clair`,
    description,
  },
  twitter: {
    card: 'summary_large_image',
    title: `${siteName} — Le suivi de thèses, enfin clair`,
    description,
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="fr" className={inter.variable}>
      <body className={inter.className}>
        <ToastProvider>
          <AuthProvider>
            <DatePreferencesSync />
            <PageTransition>{children}</PageTransition>
          </AuthProvider>
        </ToastProvider>
      </body>
    </html>
  );
}
