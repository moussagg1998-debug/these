import { ImageResponse } from 'next/og';
import { join } from 'node:path';
import { readFile } from 'node:fs/promises';

// Favicon, generated from the real logo asset (public/logo.jpg) via the
// Node.js runtime + local-asset pattern documented for next/og (base64 data
// URI embedded in an <img>). The logo is a wide wordmark with no separate
// cropped icon mark available, so it's letterboxed (object-fit: contain).
// Canvas is the brand green rather than the source JPEG's own white
// background — deliberate, not a blend-in match — so the letterbox bands
// read as branded, not blank.
export const runtime = 'nodejs';
export const size = { width: 32, height: 32 };
export const contentType = 'image/png';

const logoData = await readFile(join(process.cwd(), 'public', 'logo.jpg'), 'base64');
const logoSrc = `data:image/jpeg;base64,${logoData}`;

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
      }}
    >
      <img src={logoSrc} width={32} height={32} style={{ objectFit: 'contain' }} />
    </div>,
    { ...size },
  );
}
