import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import {
  buildBasicAuthHeader,
  CursorApiClient,
  formatApiError,
} from './api-client.js';

describe('buildBasicAuthHeader', () => {
  it('encodes API key as Basic auth with empty password', () => {
    const header = buildBasicAuthHeader('key_test');
    assert.equal(header, `Basic ${Buffer.from('key_test:').toString('base64')}`);
  });
});

describe('formatApiError', () => {
  it('extracts v1 error message and code', () => {
    const message = formatApiError(404, {
      error: { code: 'agent_not_found', message: 'Agent not found' },
    }, 'fallback');
    assert.match(message, /Agent not found/);
    assert.match(message, /agent_not_found/);
  });

  it('falls back to legacy message shape', () => {
    const message = formatApiError(400, { message: 'Bad request' }, 'fallback');
    assert.equal(message, 'Bad request');
  });

  it('uses fallback when body is empty', () => {
    assert.equal(formatApiError(500, null, 'fallback'), 'fallback');
  });
});

describe('CursorApiClient', () => {
  it('requires a non-empty API key', () => {
    assert.throws(() => new CursorApiClient(''), /API key is required/);
  });

  it('exposes the same auth header as buildBasicAuthHeader', () => {
    const client = new CursorApiClient('key_abc');
    assert.equal(client.getAuthHeader(), buildBasicAuthHeader('key_abc'));
  });
});
