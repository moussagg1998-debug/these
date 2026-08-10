import { ImageResponse } from 'next/og';

// Favicon, generated natively (no image asset to ship/maintain). Mirrors the
// brand mark already used in MarketingNav/MarketingFooter (primary-green
// square + wordmark initial) rather than introducing a new logo.
export const size = { width: 32, height: 32 };
export const contentType = 'image/png';

export default function Icon() {
  return new ImageResponse(
    <div
      style={{
        width: '100%',
        height: '100%',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        background: '#4ade80',
        borderRadius: 6,
        color: '#0f1f17',
        fontSize: 20,
        fontWeight: 700,
        fontFamily: 'sans-serif',
      }}
    >
      T
    </div>,
    { ...size },
  );
}
