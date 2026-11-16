import { describe, expect, it } from 'vitest';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { setupServer } from '../src/server.js';
import {
  explainDataFetching,
  extractDataFetchCalls,
  parseFetchOptions,
} from '../src/utils/data-fetching.js';
import type { DataFetchFinding } from '../src/utils/data-fetching.js';

const fixture = path.join(path.dirname(fileURLToPath(import.meta.url)), 'fixtures', 'data-fetching-app');

type Tool = {
  handler: (args: Record<string, unknown>, extra?: unknown) => Promise<{ content: Array<{ text: string }> }>;
};

async function callTool(server: McpServer, name: string, args: Record<string, unknown> = {}) {
  const tool = (server as unknown as { _registeredTools: Record<string, Tool> })._registeredTools[name]!;
  const result = await tool.handler(args, {});
  return JSON.parse(result.content[0]!.text) as Record<string, unknown>;
}

function findings(result: Awaited<ReturnType<typeof explainDataFetching>>, ruleId: string): DataFetchFinding[] {
  return result.findings.filter((finding) => finding.ruleId === ruleId);
}

describe('extractDataFetchCalls', () => {
  it('extracts kinds, keys, URLs, methods and options', () => {
    const calls = extractDataFetchCalls(
      [
        "const a = await useFetch('/api/a', { method: 'POST', server: false, lazy: true, pick: ['id'], watch: [x], transform: (r) => r, default: () => [], immediate: false })",
        "const b = useAsyncData('key-b', () => $fetch('/api/b', { method: 'PATCH' }))",
        "const c = useLazyAsyncData(() => $fetch('/api/c'))",
        "const d = await $fetch('/api/d')",
      ].join('\n'),
    );
    expect(calls.map((call) => call.kind)).toEqual(['useFetch', 'useAsyncData', 'useLazyAsyncData', '$fetch']);
    expect(calls[0]).toMatchObject({
      url: '/api/a',
      method: 'POST',
      options: {
        server: false,
        lazy: true,
        immediate: false,
        watch: true,
        pick: ['id'],
        transform: true,
        default: true,
      },
    });
    expect(calls[1]).toMatchObject({ key: 'key-b', url: '/api/b', method: 'PATCH' });
    expect(calls[2]).toMatchObject({ url: '/api/c', options: { lazy: true } });
    expect(calls[3]).toMatchObject({ url: '/api/d' });
  });

  it('parses option values without treating false as present', () => {
    expect(parseFetchOptions('{ lazy: false, server: true }')).toEqual({ lazy: false, server: true });
  });
});

describe('explain_data_fetching (fixture)', () => {
  it('lists every call with URL or key, method and detected options', async () => {
    const result = await explainDataFetching(fixture);
    expect(result.target?.kind).toBe('all');

    const indexCalls = result.calls.filter((call) => call.file === 'pages/index.vue');
    const users = indexCalls.find((call) => call.kind === 'useFetch')!;
    expect(users).toMatchObject({
      url: '/api/users',
      method: 'GET',
      options: {
        lazy: true,
        server: false,
        immediate: true,
        watch: true,
        pick: ['id', 'name'],
        transform: true,
        default: true,
      },
    });

    const detail = indexCalls.find((call) => call.kind === 'useLazyFetch')!;
    expect(detail).toMatchObject({
      url: '/api/detail',
      key: 'detail-key',
      options: { lazy: true, server: false },
    });

    const widget = result.calls.find((call) => call.file === 'components/Widget.vue')!;
    expect(widget).toMatchObject({ kind: 'useFetch', key: 'widgets', options: { lazy: true } });
  });

  it('flags duplicate explicit keys with different fetchers across files', async () => {
    const result = await explainDataFetching(fixture);
    const duplicate = findings(result, 'duplicate-key');
    expect(duplicate.map((finding) => finding.file).sort()).toEqual([
      'pages/duplicate-a.vue',
      'pages/duplicate-b.vue',
    ]);
    expect(duplicate.every((finding) => finding.severity === 'error')).toBe(true);
    expect(duplicate[0]!.reason).toContain('profile');
    expect(duplicate[0]!.reason).toContain('/api/');
  });

  it('does not flag the same key with the same fetcher', async () => {
    const result = await explainDataFetching(fixture);
    const duplicate = findings(result, 'duplicate-key');
    expect(duplicate.some((finding) => finding.file === 'pages/same-key.vue')).toBe(false);
    expect(duplicate.some((finding) => finding.file === 'composables/useShared.ts')).toBe(false);
  });

  it('flags $fetch in onMounted only when the data is rendered', async () => {
    const result = await explainDataFetching(fixture);
    const onMounted = findings(result, 'fetch-in-onmounted');
    expect(onMounted).toHaveLength(1);
    expect(onMounted[0]).toMatchObject({ file: 'pages/onmounted.vue', line: 4, severity: 'warning' });
    expect(onMounted.some((finding) => finding.file === 'layouts/default.vue')).toBe(false);
  });

  it('flags bare await $fetch at setup top level', async () => {
    const result = await explainDataFetching(fixture);
    const setupAwait = findings(result, 'fetch-in-setup-top-level');
    expect(setupAwait).toHaveLength(1);
    expect(setupAwait[0]).toMatchObject({ file: 'pages/setup-await.vue', line: 2, severity: 'error' });
  });

  it('flags server: false without lazy and accepts server: false with lazy', async () => {
    const result = await explainDataFetching(fixture);
    const serverFalse = findings(result, 'server-false-without-lazy');
    expect(serverFalse.map((finding) => finding.file)).toEqual(['pages/server-false.vue']);
    expect(serverFalse[0]!.severity).toBe('warning');
    expect(serverFalse.some((finding) => finding.file === 'pages/index.vue')).toBe(false);
  });

  it('flags lazy results rendered without pending/status and accepts pending checks', async () => {
    const result = await explainDataFetching(fixture);
    const missingPending = findings(result, 'missing-await-pending');
    expect(missingPending.map((finding) => finding.file)).toEqual(['pages/missing-pending.vue']);
    expect(missingPending[0]).toMatchObject({ line: 2, severity: 'warning' });
    expect(missingPending.some((finding) => finding.file === 'pages/lazy-ok.vue')).toBe(false);
    expect(missingPending.some((finding) => finding.file === 'pages/index.vue')).toBe(false);
  });

  it('finds all five rules and no issues on correct usage', async () => {
    const result = await explainDataFetching(fixture);
    expect(new Set(result.findings.map((finding) => finding.ruleId))).toEqual(
      new Set([
        'duplicate-key',
        'fetch-in-onmounted',
        'fetch-in-setup-top-level',
        'server-false-without-lazy',
        'missing-await-pending',
      ]),
    );

    const cleanFiles = [
      'pages/index.vue',
      'pages/lazy-ok.vue',
      'pages/same-key.vue',
      'components/Widget.vue',
      'composables/useShared.ts',
      'layouts/default.vue',
    ];
    expect(result.findings.filter((finding) => cleanFiles.includes(finding.file))).toEqual([]);
  });

  it('limits the scan to a file or a directory', async () => {
    const fileResult = await explainDataFetching(fixture, 'pages/setup-await.vue');
    expect(fileResult.target).toMatchObject({ kind: 'file', files: ['pages/setup-await.vue'] });
    expect(fileResult.summary.filesScanned).toBe(1);
    expect(fileResult.calls).toHaveLength(1);
    expect(fileResult.findings.map((finding) => finding.ruleId)).toEqual(['fetch-in-setup-top-level']);

    const dirResult = await explainDataFetching(fixture, 'composables');
    expect(dirResult.target?.kind).toBe('directory');
    expect(dirResult.target?.files).toEqual(['composables/useShared.ts']);
    expect(dirResult.findings).toEqual([]);
  });

  it('resolves a URL like explain_route, including parent pages', async () => {
    const result = await explainDataFetching(fixture, '/users/42');
    expect(result.target?.kind).toBe('url');
    expect(result.target?.route).toMatchObject({
      file: 'pages/users/[id].vue',
      pattern: '/users/:id',
      params: { id: '42' },
    });
    expect(result.target?.files).toEqual(
      expect.arrayContaining(['pages/users.vue', 'pages/users/[id].vue']),
    );
    expect(result.calls.map((call) => call.file).sort()).toEqual([
      'pages/users.vue',
      'pages/users/[id].vue',
    ]);
  });

  it('reports an unmatched URL without guessing', async () => {
    const result = await explainDataFetching(fixture, '/does/not/exist');
    expect(result.target).toMatchObject({ kind: 'url', files: [] });
    expect(result.calls).toEqual([]);
    expect(result.notes.join('\n')).toContain('No page matched');
  });

  it('MCP tool explain_data_fetching returns JSON', async () => {
    const server = new McpServer({ name: 't', version: '0.0.0' });
    const { watcher } = await setupServer(server, fixture);
    try {
      const result = await callTool(server, 'explain_data_fetching', { path: 'pages/index.vue' });
      expect(result.error).toBeUndefined();
      expect((result.calls as unknown[]).length).toBeGreaterThan(0);
    } finally {
      watcher.stop();
    }
  });
});
