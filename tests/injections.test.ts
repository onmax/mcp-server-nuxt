import { describe, expect, it } from 'vitest';
import { promises as fs } from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { setupServer } from '../src/server.js';
import { explainInjections, normalizeInjectionName } from '../src/utils/injections.js';

const fixture = path.join(path.dirname(fileURLToPath(import.meta.url)), 'fixtures', 'injections-app');

type Tool = {
  handler: (args: Record<string, unknown>, extra?: unknown) => Promise<{ content: Array<{ text: string }> }>;
};

async function callTool(server: McpServer, name: string, args: Record<string, unknown> = {}) {
  const tool = (server as unknown as { _registeredTools: Record<string, Tool> })._registeredTools[name]!;
  const result = await tool.handler(args, {});
  return JSON.parse(result.content[0]!.text) as Record<string, unknown>;
}

async function tempProject(files: Record<string, string>, prefix = 'injections-'): Promise<string> {
  const dir = await fs.mkdtemp(path.join(os.tmpdir(), prefix));
  for (const [rel, content] of Object.entries(files)) {
    const abs = path.join(dir, rel);
    await fs.mkdir(path.dirname(abs), { recursive: true });
    await fs.writeFile(abs, content, 'utf8');
  }
  return dir;
}

describe('explain_injections (fixture)', () => {
  it('detects returned provide objects and provide calls with scopes', async () => {
    const result = await explainInjections(fixture);
    const byName = new Map(result.injections.map((entry) => [entry.name, entry]));

    const api = byName.get('$api')!;
    expect(api.providers).toHaveLength(2);
    expect(api.providers.map((p) => p.file).sort()).toEqual([
      'plugins/api.ts',
      'plugins/object-setup.ts',
    ]);
    expect(api.providers.map((p) => p.form).sort()).toEqual([
      'returned-provide-object',
      'returned-provide-object',
    ]);

    const format = byName.get('$formatPrice')!;
    expect(format.providers).toHaveLength(1);
    expect(format.providers[0]).toMatchObject({
      file: 'plugins/format.client.ts',
      form: 'provide-call',
      scope: 'client',
      key: 'formatPrice',
    });

    const analytics = byName.get('$analytics')!;
    expect(analytics.providers[0]).toMatchObject({
      file: 'plugins/analytics.server.ts',
      scope: 'server',
    });

    const device = byName.get('$device')!;
    expect(device.providers[0]).toMatchObject({ conditional: true, scope: 'client' });
  });

  it('detects destructured, member, computed-member and template references', async () => {
    const result = await explainInjections(fixture);
    const byName = new Map(result.injections.map((entry) => [entry.name, entry]));

    const api = byName.get('$api')!;
    expect(api.references).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ file: 'pages/index.vue', line: 2, kind: 'destructured' }),
        expect.objectContaining({ file: 'pages/index.vue', line: 4, kind: 'member' }),
        expect.objectContaining({ file: 'components/Widget.vue', line: 2, kind: 'destructured', alias: 'apiClient' }),
        expect.objectContaining({ file: 'composables/useAuth.ts', line: 2, kind: 'destructured' }),
        expect.objectContaining({ file: 'utils/fetch.ts', line: 3, kind: 'computed-member' }),
      ]),
    );

    const format = byName.get('$formatPrice')!;
    expect(format.references).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ file: 'pages/index.vue', line: 5, kind: 'member' }),
        expect.objectContaining({ file: 'pages/index.vue', line: 9, kind: 'template' }),
      ]),
    );

    const toast = byName.get('$toast')!;
    expect(toast.references).toEqual([
      expect.objectContaining({ file: 'pages/index.vue', line: 10, kind: 'template' }),
    ]);
  });

  it('does not report user.$api as the global injection and skips template-local v-for bindings', async () => {
    const result = await explainInjections(fixture);
    const api = result.injections.find((entry) => entry.name === '$api')!;
    expect(api.references.some((ref) => ref.expression?.includes('user.$api'))).toBe(false);

    const widgetRefs = api.references.filter((ref) => ref.file === 'components/Widget.vue');
    expect(widgetRefs).toHaveLength(1);
    expect(widgetRefs[0]?.kind).toBe('destructured');
  });

  it('only treats provide calls traced to the plugin context as providers', async () => {
    const result = await explainInjections(fixture);
    const names = new Set(result.injections.map((entry) => entry.name));
    expect(names.has('$fake')).toBe(false);
    expect(names.has('$real')).toBe(true);
  });

  it('records limitations for dynamic keys, spreads and unsupported arguments', async () => {
    const result = await explainInjections(fixture);
    const text = result.limitations.join('\n');
    expect(text).toContain('Dynamic/computed key');
    expect(text).toContain('Spread provider object');
    expect(text).toContain('Unsupported defineNuxtPlugin argument');
  });

  it('classifies unresolved third-party and framework-provided names', async () => {
    const result = await explainInjections(fixture);
    const byName = new Map(result.injections.map((entry) => [entry.name, entry]));

    expect(byName.get('$t')?.status).toBe('unresolved');
    expect(byName.get('$t')?.diagnostics[0]?.message).toContain('third-party module');

    expect(byName.get('$route')?.status).toBe('framework-provided');
    expect(byName.get('$route')?.providers).toHaveLength(0);
  });

  it('flags multiple providers and client/server scope overlap without claiming a conflict', async () => {
    const result = await explainInjections(fixture);
    const byName = new Map(result.injections.map((entry) => [entry.name, entry]));

    expect(byName.get('$api')?.status).toBe('multiple-providers');
    expect(byName.get('$db')?.status).toBe('multiple-providers');
    expect(byName.get('$db')?.diagnostics.some((d) => d.severity === 'warning')).toBe(true);
    expect(byName.get('$db')?.diagnostics.some((d) => d.message.includes('Potential'))).toBe(true);
    expect(byName.get('$db')?.diagnostics.map((d) => d.message).join('\n')).toContain(
      'not an unconditional conflict',
    );
  });

  it('reports providers with no static references', async () => {
    const result = await explainInjections(fixture);
    const byName = new Map(result.injections.map((entry) => [entry.name, entry]));
    expect(byName.get('$analytics')?.status).toBe('no-static-references');
    expect(byName.get('$analytics')?.references).toHaveLength(0);
  });

  it('normalizes the injection name filter and never silently ignores it', async () => {
    expect(normalizeInjectionName('api')).toBe('$api');
    expect(normalizeInjectionName('$api')).toBe('$api');

    const filtered = await explainInjections(fixture, 'api');
    expect(filtered.injections.map((entry) => entry.name)).toEqual(['$api']);

    const unknown = await explainInjections(fixture, 'doesNotExist');
    expect(unknown.injections).toHaveLength(1);
    expect(unknown.injections[0]?.status).toBe('unresolved');
  });

  it('MCP tool explain_injections returns JSON and honors the filter', async () => {
    const server = new McpServer({ name: 't', version: '0.0.0' });
    const { watcher } = await setupServer(server, fixture);
    try {
      const result = await callTool(server, 'explain_injections', { injection: '$formatPrice' });
      expect(result.error).toBeUndefined();
      expect((result.injections as Array<{ name: string }>).map((entry) => entry.name)).toEqual([
        '$formatPrice',
      ]);
    } finally {
      watcher.stop();
    }
  });
});

describe('explain_injections (temp projects)', () => {
  it('respects a configured srcDir', async () => {
    const dir = await tempProject({
      'nuxt.config.ts': "export default defineNuxtConfig({ srcDir: 'src' })",
      'src/plugins/foo.ts':
        'export default defineNuxtPlugin(() => ({ provide: { foo: () => {} } }))',
      'src/pages/index.vue':
        '<script setup>const { $foo } = useNuxtApp()</script>\n<template><div /></template>',
    });
    try {
      const result = await explainInjections(dir);
      const foo = result.injections.find((entry) => entry.name === '$foo')!;
      expect(foo.providers[0]?.file).toBe('src/plugins/foo.ts');
      expect(foo.references[0]?.file).toBe('src/pages/index.vue');
    } finally {
      await fs.rm(dir, { recursive: true, force: true });
    }
  });

  it('respects the Nuxt 4 app/ layout', async () => {
    const dir = await tempProject({
      'nuxt.config.ts': 'export default defineNuxtConfig({})',
      'app/plugins/foo.ts':
        'export default defineNuxtPlugin(() => ({ provide: { foo: () => {} } }))',
      'app/pages/index.vue':
        '<script setup>const { $foo } = useNuxtApp()</script>\n<template><div /></template>',
    });
    try {
      const result = await explainInjections(dir);
      const foo = result.injections.find((entry) => entry.name === '$foo')!;
      expect(foo.providers[0]?.file).toBe('app/plugins/foo.ts');
      expect(foo.references[0]?.file).toBe('app/pages/index.vue');
    } finally {
      await fs.rm(dir, { recursive: true, force: true });
    }
  });

  it('includes resolvable local-layer providers with layer origin', async () => {
    const base = await fs.mkdtemp(path.join(os.tmpdir(), 'injections-layers-'));
    const write = async (rel: string, content: string) => {
      const abs = path.join(base, rel);
      await fs.mkdir(path.dirname(abs), { recursive: true });
      await fs.writeFile(abs, content, 'utf8');
    };

    try {
      await write('root/package.json', JSON.stringify({ name: 'root-app' }));
      await write('root/nuxt.config.ts', "export default defineNuxtConfig({ extends: ['../layer-a'] })");
      await write(
        'root/pages/index.vue',
        '<script setup>const { $layerThing } = useNuxtApp()</script>\n<template><div /></template>',
      );
      await write('layer-a/package.json', JSON.stringify({ name: 'layer-a' }));
      await write('layer-a/nuxt.config.ts', 'export default defineNuxtConfig({})');
      await write(
        'layer-a/plugins/layer.ts',
        'export default defineNuxtPlugin(() => ({ provide: { layerThing: () => {} } }))',
      );

      const result = await explainInjections(path.join(base, 'root'));
      const entry = result.injections.find((item) => item.name === '$layerThing')!;
      expect(entry.providers[0]).toMatchObject({
        file: '../layer-a/plugins/layer.ts',
        layer: 'layer-a',
      });
      expect(entry.references[0]?.file).toBe('pages/index.vue');
    } finally {
      await fs.rm(base, { recursive: true, force: true });
    }
  });

  it('records unresolved configured plugin paths as limitations', async () => {
    const dir = await tempProject({
      'nuxt.config.ts':
        "export default defineNuxtConfig({ plugins: ['~/plugins/missing.ts'] })",
      'pages/index.vue': '<template><div /></template>',
    });
    try {
      const result = await explainInjections(dir);
      expect(result.limitations.join('\n')).toContain('could not be resolved');
    } finally {
      await fs.rm(dir, { recursive: true, force: true });
    }
  });

  it('continues past unsupported plugin files without aborting the scan', async () => {
    const dir = await tempProject({
      'nuxt.config.ts': 'export default defineNuxtConfig({})',
      'plugins/bad.ts': 'export default defineNuxtPlugin(42)',
      'plugins/good.ts': 'export default defineNuxtPlugin(() => ({ provide: { good: 1 } }))',
      'pages/index.vue': '<template><div>{{ $good }}</div></template>',
    });
    try {
      const result = await explainInjections(dir);
      const names = new Set(result.injections.map((entry) => entry.name));
      expect(names.has('$good')).toBe(true);
      expect(result.limitations.join('\n')).toContain('Unsupported defineNuxtPlugin argument');
    } finally {
      await fs.rm(dir, { recursive: true, force: true });
    }
  });
});
