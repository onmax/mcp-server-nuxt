import { describe, expect, it } from 'vitest';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { setupServer } from '../src/server.js';
import { findUsages } from '../src/utils/find-usages.js';

const fixture = path.join(path.dirname(fileURLToPath(import.meta.url)), 'fixtures', 'nuxt3-minimal');

type Tool = {
  handler: (args: Record<string, unknown>, extra?: unknown) => Promise<{ content: Array<{ text: string }> }>;
};

async function callTool(server: McpServer, name: string, args: Record<string, unknown> = {}) {
  const tool = (server as unknown as { _registeredTools: Record<string, Tool> })._registeredTools[name]!;
  const result = await tool.handler(args, {});
  return JSON.parse(result.content[0]!.text) as Record<string, unknown>;
}

describe('find_usages (fixture)', () => {
  it('resolves a component name and covers auto-import, Lazy and kebab-case', async () => {
    const result = await findUsages(fixture, 'UserCard');
    expect(result.target).toEqual({ kind: 'component', name: 'UserCard', file: 'components/UserCard.vue' });
    expect(result.usages.map((u) => u.file)).toEqual(['pages/index.vue', 'pages/index.vue', 'pages/index.vue']);
    expect(result.usages.map((u) => u.name)).toEqual(
      expect.arrayContaining(['UserCard', 'LazyUserCard', 'user-card']),
    );
    expect(result.usages.every((u) => u.via === 'template')).toBe(true);
    expect(result.summary).toMatch(/Found 3 usage\(s\)/);
  });

  it('resolves a nested component by its auto-import name', async () => {
    const result = await findUsages(fixture, 'BaseButton');
    expect(result.target).toEqual({ kind: 'component', name: 'BaseButton', file: 'components/base/Button.vue' });
    expect(result.usages).toHaveLength(1);
    expect(result.usages[0]).toMatchObject({ file: 'pages/index.vue', name: 'BaseButton', via: 'template' });
  });

  it('resolves a component file path', async () => {
    const result = await findUsages(fixture, 'components/UserCard.vue');
    expect(result.target).toEqual({ kind: 'component', name: 'UserCard', file: 'components/UserCard.vue' });
    expect(result.usages).toHaveLength(3);
  });

  it('resolves a composable name', async () => {
    const result = await findUsages(fixture, 'useAuth');
    expect(result.target).toEqual({ kind: 'composable', name: 'useAuth', file: 'composables/useAuth.ts' });
    expect(result.usages).toHaveLength(1);
    expect(result.usages[0]).toMatchObject({ file: 'pages/index.vue', name: 'useAuth', via: 'auto-import' });
  });

  it('resolves a kebab-case component target', async () => {
    const result = await findUsages(fixture, 'user-card');
    expect(result.target).toEqual({ kind: 'component', name: 'UserCard', file: 'components/UserCard.vue' });
    expect(result.usages).toHaveLength(3);
  });

  it('reports no usages for an unused component', async () => {
    const result = await findUsages(fixture, 'UnusedWidget');
    expect(result.target?.name).toBe('UnusedWidget');
    expect(result.usages).toHaveLength(0);
    expect(result.summary).toMatch(/Found 0 usage\(s\)/);
  });

  it('lists unused components and composables when target is omitted', async () => {
    const result = await findUsages(fixture);
    const names = result.unused.map((u) => u.name);
    expect(names).toContain('UnusedWidget');
    expect(names).not.toContain('UserCard');
    expect(names).not.toContain('BaseButton');
    expect(names).not.toContain('useAuth');
    const unusedWidget = result.unused.find((u) => u.name === 'UnusedWidget');
    expect(unusedWidget).toMatchObject({ kind: 'component', file: 'components/UnusedWidget.vue' });
  });

  it('MCP tool find_usages returns JSON', async () => {
    const server = new McpServer({ name: 't', version: '0.0.0' });
    const { watcher } = await setupServer(server, fixture);
    try {
      const result = await callTool(server, 'find_usages', { target: 'UserCard' });
      expect(result.error).toBeUndefined();
      expect((result.target as { name: string }).name).toBe('UserCard');
      expect((result.usages as Array<{ file: string }>).length).toBe(3);
    } finally {
      watcher.stop();
    }
  });
});
