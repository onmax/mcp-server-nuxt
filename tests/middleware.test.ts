import { describe, expect, it } from 'vitest';
import { promises as fs } from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { setupServer } from '../src/server.js';
import { explainMiddleware } from '../src/utils/middleware.js';

const fixture = path.join(path.dirname(fileURLToPath(import.meta.url)), 'fixtures', 'nuxt3-minimal');

type Tool = {
  handler: (args: Record<string, unknown>, extra?: unknown) => Promise<{ content: Array<{ text: string }> }>;
};

async function callTool(server: McpServer, name: string, args: Record<string, unknown> = {}) {
  const tool = (server as unknown as { _registeredTools: Record<string, Tool> })._registeredTools[name]!;
  const result = await tool.handler(args, {});
  return JSON.parse(result.content[0]!.text) as Record<string, unknown>;
}

async function tempProject(files: Record<string, string>): Promise<string> {
  const dir = await fs.mkdtemp(path.join(os.tmpdir(), 'middleware-'));
  for (const [rel, content] of Object.entries(files)) {
    const abs = path.join(dir, rel);
    await fs.mkdir(path.dirname(abs), { recursive: true });
    await fs.writeFile(abs, content, 'utf8');
  }
  return dir;
}

describe('explain_middleware (fixture)', () => {
  it('explains a global middleware with alphabetical run order', async () => {
    const result = await explainMiddleware(fixture, 'logger');
    expect(result.target).toMatchObject({
      name: 'logger',
      type: 'global',
      globalOrder: 1,
      globalMiddleware: ['logger'],
    });
    expect(result.target?.file).toMatch(/middleware\/logger\.global\.ts$/);
    expect(result.target?.routes).toContain('/');
    expect(result.target?.routes).toContain('/users/:id');
    expect(result.target?.navigateTo).toBe(false);
    expect(result.target?.abortNavigation).toBe(false);
  });

  it('explains a named middleware and the routes it applies to', async () => {
    const result = await explainMiddleware(fixture, 'auth');
    expect(result.target).toMatchObject({ name: 'auth', type: 'named', globalOrder: null });
    expect(result.target?.routes).toContain('/users/:id');
    expect(result.target?.routes).not.toContain('/dashboard');
  });

  it('resolves a middleware by file path', async () => {
    const result = await explainMiddleware(fixture, 'middleware/admin.ts');
    expect(result.target).toMatchObject({ name: 'admin', type: 'named' });
    expect(result.target?.routes).toContain('/dashboard');
  });

  it('lists all middleware including inline and global order', async () => {
    const result = await explainMiddleware(fixture);
    const names = result.middleware.map((m) => m.name);
    expect(names).toEqual(expect.arrayContaining(['logger', 'auth', 'admin']));
    expect(result.globalOrder).toEqual(['logger']);
    expect(result.inline.map((i) => i.file)).toContain('pages/bare.vue');
    expect(result.missingReferences).toHaveLength(0);
  });

  it('MCP tool explain_middleware returns JSON', async () => {
    const server = new McpServer({ name: 't', version: '0.0.0' });
    const { watcher } = await setupServer(server, fixture);
    try {
      const result = await callTool(server, 'explain_middleware', { name: 'auth' });
      expect(result.error).toBeUndefined();
      expect((result.target as { name: string }).name).toBe('auth');
    } finally {
      watcher.stop();
    }
  });
});

describe('explain_middleware (navigateTo, abortNavigation and missing refs)', () => {
  it('reports navigateTo and abortNavigation usage', async () => {
    const dir = await tempProject({
      'nuxt.config.ts': 'export default defineNuxtConfig({})',
      'middleware/auth.ts': `export default defineNuxtRouteMiddleware(() => {
  if (!useState('user').value) return navigateTo('/login')
})`,
      'middleware/guard.global.ts': `export default defineNuxtRouteMiddleware(() => {
  if (!check()) return abortNavigation()
})`,
      'pages/index.vue': '<template><div>Home</div></template>',
    });
    try {
      const auth = await explainMiddleware(dir, 'auth');
      expect(auth.target?.navigateTo).toBe(true);
      expect(auth.target?.abortNavigation).toBe(false);

      const guard = await explainMiddleware(dir, 'guard');
      expect(guard.target?.type).toBe('global');
      expect(guard.target?.abortNavigation).toBe(true);
      expect(guard.target?.navigateTo).toBe(false);
    } finally {
      await fs.rm(dir, { recursive: true, force: true });
    }
  });

  it('flags pages that reference a middleware with no matching file', async () => {
    const dir = await tempProject({
      'nuxt.config.ts': 'export default defineNuxtConfig({})',
      'pages/index.vue': `<script setup>
definePageMeta({ middleware: ['missing'] })
</script>
<template><div>Home</div></template>`,
    });
    try {
      const result = await explainMiddleware(dir);
      expect(result.missingReferences).toContainEqual({ page: 'pages/index.vue', middleware: 'missing' });
    } finally {
      await fs.rm(dir, { recursive: true, force: true });
    }
  });
});
