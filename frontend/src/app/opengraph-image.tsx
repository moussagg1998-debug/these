import { ImageResponse } from 'next/og';

// Default OG/Twitter share image for every route (root-level convention —
// individual routes can override with their own opengraph-image.tsx).
// Generated natively at request time, no image asset to ship/maintain.
export const size = { width: 1200, height: 630 };
export const contentType = 'image/png';
export const alt = 'ThèseFacile — Le suivi de thèses, enfin clair';

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
      <div style={{ display: 'flex', alignItems: 'center', gap: 16, marginBottom: 40 }}>
        <div
          style={{
            width: 56,
            height: 56,
            borderRadius: 10,
            background: '#4ade80',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            color: '#0f1f17',
            fontSize: 28,
            fontWeight: 700,
          }}
        >
          T
        </div>
        <div style={{ display: 'flex', fontSize: 32, fontWeight: 600 }}>ThèseFacile</div>
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
