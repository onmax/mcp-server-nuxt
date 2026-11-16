import { describe, expect, it } from 'vitest';
import { promises as fs } from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { setupServer } from '../src/server.js';
import { checkSsrSafety } from '../src/utils/ssr-safety.js';

type Tool = {
  handler: (args: Record<string, unknown>, extra?: unknown) => Promise<{ content: Array<{ text: string }> }>;
};

async function callTool(server: McpServer, name: string, args: Record<string, unknown> = {}) {
  const tool = (server as unknown as { _registeredTools: Record<string, Tool> })._registeredTools[name]!;
  const result = await tool.handler(args, {});
  return JSON.parse(result.content[0]!.text) as Record<string, unknown>;
}

async function tempProject(files: Record<string, string>): Promise<string> {
  const dir = await fs.mkdtemp(path.join(os.tmpdir(), 'ssr-safety-'));
  for (const [rel, content] of Object.entries(files)) {
    const abs = path.join(dir, rel);
    await fs.mkdir(path.dirname(abs), { recursive: true });
    await fs.writeFile(abs, content, 'utf8');
  }
  return dir;
}

const baseFiles = {
  'nuxt.config.ts': 'export default defineNuxtConfig({})',
  'pages/index.vue': `<script setup>
const title = document.title
</script>
<template><div /></template>`,
  'pages/mounted.vue': `<script setup>
onMounted(() => {
  window.scrollTo(0, 0)
})
</script>
<template><div /></template>`,
  'pages/guard-client.vue': `<script setup>
if (import.meta.client) {
  window.foo()
}
</script>
<template><div /></template>`,
  'pages/guard-process.vue': `<script setup>
if (process.client) {
  window.foo()
}
</script>
<template><div /></template>`,
  'pages/guard-typeof.vue': `<script setup>
if (typeof window !== 'undefined') {
  window.foo()
}
</script>
<template><div /></template>`,
  'pages/client-only.vue': `<template>
  <ClientOnly>
    <div>{{ window.innerWidth }}</div>
  </ClientOnly>
</template>`,
  'pages/template-global.vue': `<template>
  <div>{{ window.innerWidth }}</div>
</template>`,
  'pages/date-template.vue': `<template>
  <div>{{ Date.now() }}</div>
</template>`,
  'pages/computed-random.vue': `<script setup>
const value = computed(() => Math.random())
</script>
<template><div>{{ value }}</div></template>`,
  'components/OnlyClient.client.vue': `<script setup>
const width = window.innerWidth
</script>
<template><div /></template>`,
  'plugins/analytics.client.ts': 'export default defineNuxtPlugin(() => { window.foo() })',
  'composables/useShared.ts': `const shared = ref(0)
export function useShared() { return shared }`,
  'composables/useLocal.ts': `export function useLocal() {
  const local = ref(0)
  return { local }
}`,
};

describe('check_ssr_safety', () => {
  it('flags browser globals at setup top level and in templates, but honors exclusions', async () => {
    const dir = await tempProject(baseFiles);
    try {
      const result = await checkSsrSafety(dir);
      const browser = result.findings.filter((f) => f.ruleId === 'browser-global-ssr');
      const files = browser.map((f) => f.file);
      expect(files).toContain('pages/index.vue');
      expect(files).toContain('pages/template-global.vue');
      expect(files).not.toContain('pages/mounted.vue');
      expect(files).not.toContain('pages/guard-client.vue');
      expect(files).not.toContain('pages/guard-process.vue');
      expect(files).not.toContain('pages/guard-typeof.vue');
      expect(files).not.toContain('pages/client-only.vue');
      expect(files).not.toContain('components/OnlyClient.client.vue');
      expect(files).not.toContain('plugins/analytics.client.ts');
      expect(browser.find((f) => f.file === 'pages/index.vue')?.severity).toBe('error');
    } finally {
      await fs.rm(dir, { recursive: true, force: true });
    }
  });

  it('flags non-deterministic values in templates and computed', async () => {
    const dir = await tempProject(baseFiles);
    try {
      const result = await checkSsrSafety(dir);
      const nondet = result.findings.filter((f) => f.ruleId === 'nondeterministic-ssr');
      expect(nondet.map((f) => f.file)).toEqual(
        expect.arrayContaining(['pages/date-template.vue', 'pages/computed-random.vue']),
      );
      expect(nondet.every((f) => f.severity === 'warning')).toBe(true);
    } finally {
      await fs.rm(dir, { recursive: true, force: true });
    }
  });

  it('flags module-scope ref/reactive in composables but not function-local state', async () => {
    const dir = await tempProject(baseFiles);
    try {
      const result = await checkSsrSafety(dir);
      const shared = result.findings.filter((f) => f.ruleId === 'shared-state');
      expect(shared.map((f) => f.file)).toContain('composables/useShared.ts');
      expect(shared.map((f) => f.file)).not.toContain('composables/useLocal.ts');
    } finally {
      await fs.rm(dir, { recursive: true, force: true });
    }
  });

  it('limits the scan to a given path', async () => {
    const dir = await tempProject(baseFiles);
    try {
      const result = await checkSsrSafety(dir, 'pages/index.vue');
      expect(result.findings.every((f) => f.file === 'pages/index.vue')).toBe(true);
      expect(result.summary.filesScanned).toBe(1);
    } finally {
      await fs.rm(dir, { recursive: true, force: true });
    }
  });

  it('MCP tool check_ssr_safety returns JSON', async () => {
    const dir = await tempProject(baseFiles);
    const server = new McpServer({ name: 't', version: '0.0.0' });
    const { watcher } = await setupServer(server, dir);
    try {
      const result = await callTool(server, 'check_ssr_safety', {});
      expect(result.error).toBeUndefined();
      expect((result.findings as Array<{ ruleId: string }>).some((f) => f.ruleId === 'browser-global-ssr')).toBe(true);
    } finally {
      watcher.stop();
      await fs.rm(dir, { recursive: true, force: true });
    }
  });
});
