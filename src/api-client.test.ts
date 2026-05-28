import assert from 'node:assert/strict';
import { afterEach, describe, it } from 'node:test';
import {
  buildBasicAuthHeader,
  CursorApiClient,
  formatApiError,
  releaseStreamReader,
} from './api-client.js';

const originalFetch = globalThis.fetch;

afterEach(() => {
  globalThis.fetch = originalFetch;
});

function mockFetch(
  handler: (
    input: RequestInfo | URL,
    init?: RequestInit
  ) => Promise<Response> | Response
) {
  globalThis.fetch = (async (input, init) =>
    handler(input, init)) as typeof fetch;
}

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

describe('releaseStreamReader', () => {
  it('cancels reader and body when cancel option is true', async () => {
    let bodyCancelCalled = false;
    const body = new ReadableStream<Uint8Array>({
      cancel() {
        bodyCancelCalled = true;
      },
    });
    const reader = body.getReader();
    await releaseStreamReader(reader, body, { cancel: true });
    assert.equal(bodyCancelCalled, true);
  });

  it('releases lock without cancel when cancel option is false', async () => {
    const body = new ReadableStream<Uint8Array>({
      start(controller) {
        controller.close();
      },
    });
    const reader = body.getReader();
    await reader.read();
    let bodyCancelled = false;
    const trackingBody = new ReadableStream<Uint8Array>({
      cancel() {
        bodyCancelled = true;
      },
    });
    const openReader = trackingBody.getReader();
    await releaseStreamReader(openReader, trackingBody, { cancel: false });
    assert.equal(bodyCancelled, false);
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

  it('POSTs create_agent to /v1/agents with JSON body', async () => {
    let capturedUrl = '';
    let capturedInit: RequestInit | undefined;
    mockFetch((input, init) => {
      capturedUrl = String(input);
      capturedInit = init;
      return new Response(
        JSON.stringify({
          agent: { id: 'bc-1', status: 'ACTIVE', env: { type: 'cloud' }, url: 'https://cursor.com/agents/bc-1', createdAt: '', updatedAt: '' },
          run: { id: 'run-1', agentId: 'bc-1', status: 'CREATING', createdAt: '', updatedAt: '' },
        }),
        { status: 201, headers: { 'Content-Type': 'application/json' } }
      );
    });

    const client = new CursorApiClient('key_test');
    await client.createAgent({
      prompt: { text: 'Add README' },
      repos: [{ url: 'https://github.com/org/repo', startingRef: 'main' }],
      autoCreatePR: true,
    });

    assert.equal(capturedUrl, 'https://api.cursor.com/v1/agents');
    assert.equal(capturedInit?.method, 'POST');
    const body = JSON.parse(String(capturedInit?.body));
    assert.equal(body.prompt.text, 'Add README');
    assert.deepEqual(body.repos, [{ url: 'https://github.com/org/repo', startingRef: 'main' }]);
    assert.equal(body.autoCreatePR, true);
    assert.equal(capturedInit?.headers?.Authorization, buildBasicAuthHeader('key_test'));
  });

  it('POSTs create_run to /v1/agents/{id}/runs with JSON body', async () => {
    let capturedUrl = '';
    let capturedInit: RequestInit | undefined;
    mockFetch((input, init) => {
      capturedUrl = String(input);
      capturedInit = init;
      return new Response(
        JSON.stringify({
          run: { id: 'run-2', agentId: 'bc-1', status: 'CREATING', createdAt: '', updatedAt: '' },
        }),
        { status: 201, headers: { 'Content-Type': 'application/json' } }
      );
    });

    const client = new CursorApiClient('key_test');
    await client.createRun('bc-00000000-0000-0000-0000-000000000001', {
      prompt: { text: 'Follow up' },
      mode: 'plan',
    });

    assert.equal(
      capturedUrl,
      'https://api.cursor.com/v1/agents/bc-00000000-0000-0000-0000-000000000001/runs'
    );
    assert.equal(capturedInit?.method, 'POST');
    const body = JSON.parse(String(capturedInit?.body));
    assert.equal(body.prompt.text, 'Follow up');
    assert.equal(body.mode, 'plan');
  });

  describe('streamRun', () => {
    it('cancels the stream when maxBytes is exceeded', async () => {
      let bodyCancelCalled = false;
      const stream = new ReadableStream<Uint8Array>({
        pull(controller) {
          controller.enqueue(new Uint8Array(200).fill(97));
        },
        cancel() {
          bodyCancelCalled = true;
        },
      });

      mockFetch(() => new Response(stream, {
        status: 200,
        headers: { 'Content-Type': 'text/event-stream' },
      }));

      const client = new CursorApiClient('key_test');
      const result = await client.streamRun('bc-1', 'run-1', { maxBytes: 50 });

      assert.equal(result.truncated, true);
      assert.equal(bodyCancelCalled, true);
    });

    it('cancels the stream when maxEvents is exceeded', async () => {
      let bodyCancelCalled = false;
      const sseChunk = new TextEncoder().encode(
        'id: 1\nevent: status\ndata: {"runId":"run-1","status":"RUNNING"}\n\n' +
          'id: 2\nevent: assistant\ndata: {"text":"hi"}\n\n' +
          'id: 3\nevent: done\ndata: {}\n\n'
      );
      const stream = new ReadableStream<Uint8Array>({
        start(controller) {
          controller.enqueue(sseChunk);
        },
        cancel() {
          bodyCancelCalled = true;
        },
      });

      mockFetch(() => new Response(stream, {
        status: 200,
        headers: { 'Content-Type': 'text/event-stream' },
      }));

      const client = new CursorApiClient('key_test');
      const result = await client.streamRun('bc-1', 'run-1', { maxEvents: 1 });

      assert.equal(result.truncated, true);
      assert.equal(result.events.length, 1);
      assert.equal(bodyCancelCalled, true);
    });

    it('does not cancel when the stream ends naturally', async () => {
      let bodyCancelCalled = false;
      const sseChunk = new TextEncoder().encode(
        'event: status\ndata: {"runId":"run-1","status":"FINISHED"}\n\n'
      );
      const stream = new ReadableStream<Uint8Array>({
        start(controller) {
          controller.enqueue(sseChunk);
          controller.close();
        },
        cancel() {
          bodyCancelCalled = true;
        },
      });

      mockFetch(() => new Response(stream, {
        status: 200,
        headers: { 'Content-Type': 'text/event-stream' },
      }));

      const client = new CursorApiClient('key_test');
      const result = await client.streamRun('bc-1', 'run-1');

      assert.equal(result.truncated, false);
      assert.equal(bodyCancelCalled, false);
    });
  });
});
