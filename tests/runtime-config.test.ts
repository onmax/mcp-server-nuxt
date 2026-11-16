import { describe, expect, it } from 'vitest';
import { promises as fs } from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { setupServer } from '../src/server.js';
import { camelToUpperSnake, checkRuntimeConfig, flattenRuntimeConfig } from '../src/utils/runtime-config.js';

const fixture = path.join(path.dirname(fileURLToPath(import.meta.url)), 'fixtures', 'runtime-config-app');

type Tool = {
  handler: (args: Record<string, unknown>, extra?: unknown) => Promise<{ content: Array<{ text: string }> }>;
};

async function callTool(server: McpServer, name: string, args: Record<string, unknown> = {}) {
  const tool = (server as unknown as { _registeredTools: Record<string, Tool> })._registeredTools[name]!;
  const result = await tool.handler(args, {});
  return JSON.parse(result.content[0]!.text) as Record<string, unknown>;
}

async function tempProject(files: Record<string, string>): Promise<string> {
  const dir = await fs.mkdtemp(path.join(os.tmpdir(), 'runtime-config-'));
  for (const [rel, content] of Object.entries(files)) {
    const abs = path.join(dir, rel);
    await fs.mkdir(path.dirname(abs), { recursive: true });
    await fs.writeFile(abs, content, 'utf8');
  }
  return dir;
}

describe('check_runtime_config (fixture)', () => {
  it('flattens nested keys with types and env vars, skipping built-in app', async () => {
    const result = await checkRuntimeConfig(fixture);
    const byKey = new Map(result.keys.map((k) => [k.key, k]));

    expect(byKey.get('apiSecret')).toMatchObject({ public: false, type: 'string', envVar: 'NUXT_API_SECRET' });
    expect(byKey.get('db.host')).toMatchObject({ public: false, type: 'string', envVar: 'NUXT_DB_HOST' });
    expect(byKey.get('db.port')).toMatchObject({ public: false, type: 'number', envVar: 'NUXT_DB_PORT' });
    expect(byKey.get('public.appName')).toMatchObject({
      public: true,
      type: 'string',
      envVar: 'NUXT_PUBLIC_APP_NAME',
    });
    expect(byKey.get('public.featureFlag')).toMatchObject({
      public: true,
      type: 'boolean',
      envVar: 'NUXT_PUBLIC_FEATURE_FLAG',
    });
    expect(byKey.get('public.analytics.id')).toMatchObject({
      public: true,
      type: 'string',
      envVar: 'NUXT_PUBLIC_ANALYTICS_ID',
    });
    expect(byKey.has('app.baseURL')).toBe(false);
    expect(byKey.has('db')).toBe(false);
  });

  it('scans direct, destructured and aliased useRuntimeConfig accesses', async () => {
    const result = await checkRuntimeConfig(fixture);
    expect(result.usedKeys).toEqual(
      expect.arrayContaining([
        'apiSecret',
        'db',
        'public.apiBase',
        'public.appName',
        'public.featureFlag',
        'public.missingKey',
        'sessionKey',
      ]),
    );
  });

  it('reports used-but-undefined and defined-but-unused keys', async () => {
    const result = await checkRuntimeConfig(fixture);
    expect(result.usedButUndefined).toEqual(['public.missingKey']);
    expect(result.definedButUnused).toEqual(['unusedKey']);
  });

  it('flags private keys read in client-side code but not server-only files', async () => {
    const result = await checkRuntimeConfig(fixture);
    expect(result.privateReadInClient).toEqual(
      expect.arrayContaining([
        { file: 'pages/index.vue', line: 2, key: 'apiSecret' },
        { file: 'plugins/track.client.ts', line: 2, key: 'sessionKey' },
      ]),
    );
    expect(result.privateReadInClient.some((f) => f.file === 'plugins/secret.server.ts')).toBe(false);
    expect(result.privateReadInClient.some((f) => f.file === 'composables/useApi.ts')).toBe(false);
  });

  it('checks .env and .env.example without printing values', async () => {
    const result = await checkRuntimeConfig(fixture);
    const byVar = new Map(result.env.map((e) => [e.envVar, e]));
    expect(byVar.get('NUXT_API_SECRET')).toEqual({
      envVar: 'NUXT_API_SECRET',
      inEnv: true,
      inEnvExample: false,
    });
    expect(byVar.get('NUXT_PUBLIC_APP_NAME')).toEqual({
      envVar: 'NUXT_PUBLIC_APP_NAME',
      inEnv: true,
      inEnvExample: false,
    });
    expect(byVar.get('NUXT_SESSION_KEY')).toEqual({
      envVar: 'NUXT_SESSION_KEY',
      inEnv: false,
      inEnvExample: true,
    });
    expect(byVar.get('NUXT_PUBLIC_ANALYTICS_ID')).toEqual({
      envVar: 'NUXT_PUBLIC_ANALYTICS_ID',
      inEnv: false,
      inEnvExample: true,
    });
    expect(byVar.get('NUXT_UNUSED_KEY')).toEqual({
      envVar: 'NUXT_UNUSED_KEY',
      inEnv: false,
      inEnvExample: false,
    });
    expect(JSON.stringify(result)).not.toContain('top-secret-value');
  });

  it('MCP tool check_runtime_config returns JSON', async () => {
    const server = new McpServer({ name: 't', version: '0.0.0' });
    const { watcher } = await setupServer(server, fixture);
    try {
      const result = await callTool(server, 'check_runtime_config', {});
      expect(result.error).toBeUndefined();
      expect((result.keys as Array<{ key: string }>).some((k) => k.key === 'public.appName')).toBe(true);
    } finally {
      watcher.stop();
    }
  });
});

describe('check_runtime_config edge cases', () => {
  it('reports a config with no runtimeConfig', async () => {
    const dir = await tempProject({
      'nuxt.config.ts': 'export default defineNuxtConfig({ ssr: true })',
      'pages/index.vue': '<template><div /></template>',
    });
    try {
      const result = await checkRuntimeConfig(dir);
      expect(result.keys).toEqual([]);
      expect(result.notes.join('\n')).toContain('No runtimeConfig');
    } finally {
      await fs.rm(dir, { recursive: true, force: true });
    }
  });

  it('handles a missing nuxt.config', async () => {
    const dir = await tempProject({ 'pages/index.vue': '<template><div /></template>' });
    try {
      const result = await checkRuntimeConfig(dir);
      expect(result.configFile).toBeNull();
      expect(result.notes.join('\n')).toContain('No nuxt.config');
    } finally {
      await fs.rm(dir, { recursive: true, force: true });
    }
  });

  it('keeps non-literal values as unknown keys', async () => {
    const dir = await tempProject({
      'nuxt.config.ts': `const shared = { a: 1 }
export default defineNuxtConfig({
  runtimeConfig: { imported: shared, public: { flag: true } },
})`,
      'pages/index.vue': '<template><div /></template>',
    });
    try {
      const result = await checkRuntimeConfig(dir);
      expect(result.keys.find((k) => k.key === 'imported')).toMatchObject({
        type: 'unknown',
        envVar: 'NUXT_IMPORTED',
      });
      expect(result.notes.join('\n')).toContain('Unresolved runtimeConfig expression');
    } finally {
      await fs.rm(dir, { recursive: true, force: true });
    }
  });

  it('converts camelCase keys to UPPER_SNAKE env vars', () => {
    expect(camelToUpperSnake('apiBase')).toBe('API_BASE');
    expect(camelToUpperSnake('db.host')).toBe('DB_HOST');
    expect(camelToUpperSnake('dbURL')).toBe('DB_URL');
    expect(camelToUpperSnake('public.analyticsId')).toBe('PUBLIC_ANALYTICS_ID');
  });

  it('flattens public nested keys and skips app', () => {
    const keys = flattenRuntimeConfig({
      app: { baseURL: '/' },
      apiSecret: 'x',
      public: { nested: { key: true }, plain: 1 },
    });
    expect(keys.map((k) => k.key)).toEqual(['apiSecret', 'public.nested.key', 'public.plain']);
    expect(keys.find((k) => k.key === 'public.nested.key')?.envVar).toBe('NUXT_PUBLIC_NESTED_KEY');
  });
});
