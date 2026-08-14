import { ImageResponse } from 'next/og';
import { join } from 'node:path';
import { readFile } from 'node:fs/promises';

// Default OG/Twitter share image for every route (root-level convention —
// individual routes can override with their own opengraph-image.tsx).
// Generated from the real logo asset (public/logo.jpg) via the Node.js
// runtime + local-asset pattern documented for next/og (base64 data URI
// embedded in an <img>). The logo sits in a white card since the source
// JPEG carries its own white background — placing it directly on the dark
// canvas would show a hard white rectangle with no visual framing.
export const runtime = 'nodejs';
export const size = { width: 1200, height: 630 };
export const contentType = 'image/png';
export const alt = 'ThèseFacile — Le suivi de thèses, enfin clair';

const logoData = await readFile(join(process.cwd(), 'public', 'logo.jpg'), 'base64');
const logoSrc = `data:image/jpeg;base64,${logoData}`;

export default function OpengraphImage() {
  return new ImageResponse(
    <div
      style={{
        width: '100%',
        height: '100%',
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'flex-start',
        justifyContent: 'center',
        background: '#0f1f17',
        color: '#f5f3ee',
        padding: '80px',
        fontFamily: 'sans-serif',
      }}
    >
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          background: '#ffffff',
          borderRadius: 16,
          padding: '20px 32px',
          marginBottom: 48,
        }}
      >
        <img src={logoSrc} height={64} style={{ objectFit: 'contain' }} />
      </div>
      <div
        style={{ display: 'flex', fontSize: 56, fontWeight: 600, lineHeight: 1.15, maxWidth: 900 }}
      >
        Le suivi de thèses, enfin clair.
      </div>
      <div
        style={{
          display: 'flex',
          fontSize: 26,
          marginTop: 24,
          color: '#8fa396',
          maxWidth: 800,
        }}
      >
        Pensé pour les encadrants d&apos;Afrique francophone.
      </div>
    </div>,
    { ...size },
  );
}
