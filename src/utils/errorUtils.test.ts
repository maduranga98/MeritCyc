import { describe, it, expect } from 'vitest';
import { getErrorMessage } from './errorUtils';

describe('getErrorMessage', () => {
  it('returns the message from an Error instance', () => {
    expect(getErrorMessage(new Error('boom'), 'fallback')).toBe('boom');
  });

  it('returns a plain string error as-is', () => {
    expect(getErrorMessage('plain failure', 'fallback')).toBe('plain failure');
  });

  it('extracts message from error-like objects (e.g. Firebase errors)', () => {
    expect(getErrorMessage({ code: 'permission-denied', message: 'denied' }, 'fallback')).toBe('denied');
  });

  it('falls back for null, undefined, and messageless values', () => {
    expect(getErrorMessage(null, 'fallback')).toBe('fallback');
    expect(getErrorMessage(undefined, 'fallback')).toBe('fallback');
    expect(getErrorMessage({}, 'fallback')).toBe('fallback');
    expect(getErrorMessage(new Error(''), 'fallback')).toBe('fallback');
    expect(getErrorMessage('', 'fallback')).toBe('fallback');
  });
});
