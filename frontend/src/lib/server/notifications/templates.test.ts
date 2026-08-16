import { describe, it, expect } from 'vitest';
import { documentSubmitted, documentReceived } from './templates';

describe('documentSubmitted', () => {
  it('builds a DOCUMENT_SUBMITTED notification for the encadrant with a chapter', () => {
    const input = documentSubmitted('enc-1', 'thesis-1', 'doc-1', 'Chapitre 3');
    expect(input.userId).toBe('enc-1');
    expect(input.type).toBe('DOCUMENT_SUBMITTED');
    expect(input.title).toBe('Nouveau document déposé');
    expect(input.body).toBe('Nouveau dépôt : Chapitre 3');
    expect(input.data).toEqual({ thesisId: 'thesis-1', documentId: 'doc-1' });
    expect(input.dedupeKey).toBe('document-submitted:doc-1');
  });

  it('falls back to a generic body when chapter is null', () => {
    const input = documentSubmitted('enc-1', 'thesis-1', 'doc-1', null);
    expect(input.body).toBe('Nouveau document déposé');
  });
});

describe('documentReceived', () => {
  it('builds a DOCUMENT_RECEIVED notification for the student with a chapter', () => {
    const input = documentReceived('stu-1', 'thesis-1', 'doc-2', 'Chapitre 3');
    expect(input.userId).toBe('stu-1');
    expect(input.type).toBe('DOCUMENT_RECEIVED');
    expect(input.title).toBe('Nouveau fichier de votre encadrant');
    expect(input.body).toBe('Correction reçue : Chapitre 3');
    expect(input.data).toEqual({ thesisId: 'thesis-1', documentId: 'doc-2' });
    expect(input.dedupeKey).toBe('document-received:doc-2');
  });

  it('falls back to a generic body when chapter is null', () => {
    const input = documentReceived('stu-1', 'thesis-1', 'doc-2', null);
    expect(input.body).toBe('Votre encadrant vous a envoyé un fichier');
  });
});
