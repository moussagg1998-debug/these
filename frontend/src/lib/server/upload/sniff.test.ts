// First direct unit tests for sniff.ts (previously only exercised indirectly
// via upload/route.test.ts). Added alongside the Phase 8 DOCX/ODT sniffers —
// see .planning/banani/phase-8-student-file-upload.md.
import { describe, expect, it } from 'vitest';
import { verifyMagicBytes, hasMagicSniffer } from './sniff';

const DOCX_MIME = 'application/vnd.openxmlformats-officedocument.wordprocessingml.document';
const ODT_MIME = 'application/vnd.oasis.opendocument.text';

const ZIP_HEADER = Buffer.from([0x50, 0x4b, 0x03, 0x04]);

function fakeDocx(): Buffer {
  return Buffer.concat([
    ZIP_HEADER,
    Buffer.from([0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0]),
    Buffer.from('word/document.xml [Content_Types].xml some more bytes'),
  ]);
}

function fakeOdt(): Buffer {
  return Buffer.concat([
    ZIP_HEADER,
    Buffer.from([0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0]),
    Buffer.from('mimetypeapplication/vnd.oasis.opendocument.text'),
  ]);
}

describe('sniff.ts — DOCX/ODT', () => {
  it('hasMagicSniffer is true for both new MIME types', () => {
    expect(hasMagicSniffer(DOCX_MIME)).toBe(true);
    expect(hasMagicSniffer(ODT_MIME)).toBe(true);
  });

  it('verifies a real-shaped DOCX buffer', () => {
    expect(verifyMagicBytes(fakeDocx(), DOCX_MIME)).toEqual({ match: true, sniffed: true });
  });

  it('verifies a real-shaped ODT buffer', () => {
    expect(verifyMagicBytes(fakeOdt(), ODT_MIME)).toEqual({ match: true, sniffed: true });
  });

  it('rejects a plain ZIP (no fingerprint) declared as DOCX', () => {
    const plainZip = Buffer.concat([ZIP_HEADER, Buffer.from('not_an_office_file.txt')]);
    expect(verifyMagicBytes(plainZip, DOCX_MIME)).toEqual({ match: false, sniffed: true });
  });

  it('rejects a plain ZIP (no fingerprint) declared as ODT', () => {
    const plainZip = Buffer.concat([ZIP_HEADER, Buffer.from('not_an_office_file.txt')]);
    expect(verifyMagicBytes(plainZip, ODT_MIME)).toEqual({ match: false, sniffed: true });
  });

  it('rejects non-ZIP bytes declared as DOCX or ODT', () => {
    const notZip = Buffer.from('%PDF-1.4 pretending to be an office doc');
    expect(verifyMagicBytes(notZip, DOCX_MIME)).toEqual({ match: false, sniffed: true });
    expect(verifyMagicBytes(notZip, ODT_MIME)).toEqual({ match: false, sniffed: true });
  });

  it('an ODT buffer is not accepted as DOCX and vice versa', () => {
    expect(verifyMagicBytes(fakeOdt(), DOCX_MIME)).toEqual({ match: false, sniffed: true });
    expect(verifyMagicBytes(fakeDocx(), ODT_MIME)).toEqual({ match: false, sniffed: true });
  });
});
