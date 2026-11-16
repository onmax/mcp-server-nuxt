import { describe, expect, it } from 'vitest';
import { promises as fs } from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { setupServer } from '../src/server.js';
import { checkNuxt4Migration, parseNuxtMajor } from '../src/utils/nuxt4-migration.js';

const base = path.join(path.dirname(fileURLToPath(import.meta.url)), 'fixtures', 'nuxt4-migration');
const nuxt3 = path.join(base, 'nuxt3-project');
const nuxt4 = path.join(base, 'nuxt4-project');

const IMPLEMENTED_RULES = [
  'legacy-root-dir',
  'legacy-root-file',
  'shared-key-conflict',
  'getcacheddata-old-signature',
  'default-data-error-null',
  'shallow-data-mutation',
  'shared-prerender-data',
  'dedupe-boolean',
  'pending-idle',
  'route-meta-dedup',
  'unhead-removed-prop',
  'unhead-direct-import',
  'error-data-parsed',
  'window-nuxt-global',
  'removed-experimental-option',
  'removed-generate-config',
  'pages-extend-meta',
];

type Tool = {
  handler: (args: Record<string, unknown>, extra?: unknown) => Promise<{ content: Array<{ text: string }> }>;
};

async function callTool(server: McpServer, name: string, args: Record<string, unknown> = {}) {
  const tool = (server as unknown as { _registeredTools: Record<string, Tool> })._registeredTools[name]!;
  const result = await tool.handler(args, {});
  return JSON.parse(result.content[0]!.text) as Record<string, unknown>;
}

async function tempProject(files: Record<string, string>): Promise<string> {
  const dir = await fs.mkdtemp(path.join(os.tmpdir(), 'nuxt4-migration-'));
  for (const [rel, content] of Object.entries(files)) {
    const abs = path.join(dir, rel);
    await fs.mkdir(path.dirname(abs), { recursive: true });
    await fs.writeFile(abs, content, 'utf8');
  }
  return dir;
}

describe('parseNuxtMajor', () => {
  it('parses common semver ranges', () => {
    expect(parseNuxtMajor('^4.0.0')).toBe(4);
    expect(parseNuxtMajor('~3.12.1')).toBe(3);
    expect(parseNuxtMajor('>=3.13.0')).toBe(3);
    expect(parseNuxtMajor('latest')).toBeNull();
    expect(parseNuxtMajor(null)).toBeNull();
  });
});

describe('check_nuxt4_migration (Nuxt 3 project)', () => {
  it('detects the Nuxt 3 version and the legacy structure', async () => {
    const result = await checkNuxt4Migration(nuxt3);
    expect(result.project).toMatchObject({
      nuxtVersion: '^3.13.0',
      nuxtMajor: 3,
      usesAppDir: false,
      compatibilityVersion: null,
      migrated: false,
      configFile: 'nuxt.config.ts',
    });
    expect(result.readiness).toBe('blocked');

    const dirs = result.findings.filter((finding) => finding.ruleId === 'legacy-root-dir');
    expect(dirs.map((finding) => finding.file).sort()).toEqual([
      'assets/',
      'components/',
      'composables/',
      'layouts/',
      'middleware/',
      'pages/',
      'plugins/',
      'utils/',
    ]);
    const files = result.findings.filter((finding) => finding.ruleId === 'legacy-root-file');
    expect(files.map((finding) => finding.file).sort()).toEqual(['app.config.ts', 'app.vue', 'error.vue']);
  });

  it('implements every documented rule at least once', async () => {
    const result = await checkNuxt4Migration(nuxt3);
    expect(new Set(result.findings.map((finding) => finding.ruleId))).toEqual(new Set(IMPLEMENTED_RULES));
    expect(result.findings.every((finding) => finding.guideSection.length > 0)).toBe(true);
  });

  it('flags singleton data-fetching key conflicts', async () => {
    const result = await checkNuxt4Migration(nuxt3);
    const conflicts = result.findings.filter((finding) => finding.ruleId === 'shared-key-conflict');
    expect(conflicts.map((finding) => finding.file).sort()).toEqual([
      'pages/shared-key-a.vue',
      'pages/shared-key-b.vue',
    ]);
    expect(conflicts[0]!.reason).toContain('users');
    expect(conflicts[0]!.guideSection).toBe('Singleton Data Fetching Layer');
  });

  it('flags the old getCachedData signature', async () => {
    const result = await checkNuxt4Migration(nuxt3);
    const finding = result.findings.find((item) => item.ruleId === 'getcacheddata-old-signature')!;
    expect(finding).toMatchObject({ file: 'pages/cache.vue', line: 2, severity: 'warning' });
    expect(finding.fix).toContain('ctx');
  });

  it('flags null data/error checks and shallow data mutations', async () => {
    const result = await checkNuxt4Migration(nuxt3);
    const nulls = result.findings.filter((finding) => finding.ruleId === 'default-data-error-null');
    expect(nulls.map((finding) => finding.line)).toEqual([3, 6]);

    const mutations = result.findings.filter((finding) => finding.ruleId === 'shallow-data-mutation');
    expect(mutations.map((finding) => finding.line)).toEqual([9, 10]);
    expect(mutations.every((finding) => finding.fix.includes('deep: true'))).toBe(true);
  });

  it('flags a dynamic useAsyncData page without a key', async () => {
    const result = await checkNuxt4Migration(nuxt3);
    const finding = result.findings.find((item) => item.ruleId === 'shared-prerender-data')!;
    expect(finding).toMatchObject({ file: 'pages/blog/[slug].vue', line: 3 });
    expect(finding.guideSection).toBe('Shared Prerender Data');
  });

  it('flags dedupe booleans and pending with immediate: false', async () => {
    const result = await checkNuxt4Migration(nuxt3);
    expect(result.findings.find((item) => item.ruleId === 'dedupe-boolean')).toMatchObject({
      file: 'composables/useRefresh.ts',
      line: 3,
    });
    expect(result.findings.find((item) => item.ruleId === 'pending-idle')).toMatchObject({
      file: 'pages/pending-idle.vue',
      line: 2,
    });
  });

  it('flags removed route metadata, Unhead props/imports and window.__NUXT__', async () => {
    const result = await checkNuxt4Migration(nuxt3);
    expect(result.findings.find((item) => item.ruleId === 'route-meta-dedup')).toMatchObject({
      file: 'pages/index.vue',
      line: 8,
    });
    const unheadProps = result.findings.filter((finding) => finding.ruleId === 'unhead-removed-prop');
    expect(unheadProps).toHaveLength(2);
    expect(unheadProps.every((finding) => finding.line === 6)).toBe(true);
    expect(result.findings.find((item) => item.ruleId === 'unhead-direct-import')).toMatchObject({
      file: 'pages/index.vue',
      line: 2,
    });
    expect(result.findings.find((item) => item.ruleId === 'window-nuxt-global')).toMatchObject({
      file: 'pages/index.vue',
      line: 9,
      severity: 'error',
    });
  });

  it('flags error.data parsing and removed config options', async () => {
    const result = await checkNuxt4Migration(nuxt3);
    expect(result.findings.find((item) => item.ruleId === 'error-data-parsed')).toMatchObject({
      file: 'error.vue',
      line: 3,
    });

    const removed = result.findings.filter((finding) => finding.ruleId === 'removed-experimental-option');
    expect(removed).toHaveLength(3);
    expect(removed.map((finding) => finding.line)).toEqual([4, 5, 8]);

    expect(result.findings.find((item) => item.ruleId === 'removed-generate-config')).toMatchObject({
      file: 'nuxt.config.ts',
      line: 2,
    });
    expect(result.findings.find((item) => item.ruleId === 'pages-extend-meta')).toMatchObject({
      file: 'nuxt.config.ts',
      line: 11,
    });
  });

  it('reports consistent summary counts', async () => {
    const result = await checkNuxt4Migration(nuxt3);
    expect(result.summary.total).toBe(result.findings.length);
    expect(result.summary.error).toBe(result.findings.filter((f) => f.severity === 'error').length);
    expect(result.summary.warning).toBe(result.findings.filter((f) => f.severity === 'warning').length);
    expect(result.summary.error + result.summary.warning).toBe(result.summary.total);
    expect(Object.values(result.summary.byRule).reduce((sum, count) => sum + count, 0)).toBe(
      result.summary.total,
    );
  });
});

describe('check_nuxt4_migration (already migrated project)', () => {
  it('returns zero findings for an app/ based Nuxt 4 project', async () => {
    const result = await checkNuxt4Migration(nuxt4);
    expect(result.project).toMatchObject({
      nuxtVersion: '^4.0.0',
      nuxtMajor: 4,
      usesAppDir: true,
      compatibilityVersion: 4,
      migrated: true,
    });
    expect(result.findings).toEqual([]);
    expect(result.readiness).toBe('ready');
    expect(result.summary).toEqual({ total: 0, error: 0, warning: 0, byRule: {} });
  });
});

describe('check_nuxt4_migration (edge cases)', () => {
  it('detects future.compatibilityVersion 4 without app/', async () => {
    const dir = await tempProject({
      'package.json': JSON.stringify({ dependencies: { nuxt: '^3.12.0' } }),
      'nuxt.config.ts': 'export default defineNuxtConfig({ future: { compatibilityVersion: 4 } })',
      'pages/index.vue': '<template><div /></template>',
    });
    try {
      const result = await checkNuxt4Migration(dir);
      expect(result.project.compatibilityVersion).toBe(4);
      expect(result.project.migrated).toBe(true);
      expect(result.project.usesAppDir).toBe(false);
      expect(result.findings.some((finding) => finding.ruleId === 'legacy-root-dir')).toBe(true);
      expect(result.notes.join('\n')).toContain('future.compatibilityVersion is 4');
    } finally {
      await fs.rm(dir, { recursive: true, force: true });
    }
  });

  it('handles a project without package.json or nuxt.config', async () => {
    const dir = await tempProject({ 'README.md': '# empty' });
    try {
      const result = await checkNuxt4Migration(dir);
      expect(result.project.nuxtVersion).toBeNull();
      expect(result.project.nuxtMajor).toBeNull();
      expect(result.project.configFile).toBeNull();
      expect(result.findings).toEqual([]);
      expect(result.notes.join('\n')).toContain('Could not read package.json');
      expect(result.notes.join('\n')).toContain('No nuxt.config file found');
    } finally {
      await fs.rm(dir, { recursive: true, force: true });
    }
  });

  it('MCP tool check_nuxt4_migration returns JSON', async () => {
    const server = new McpServer({ name: 't', version: '0.0.0' });
    const { watcher } = await setupServer(server, nuxt4);
    try {
      const result = await callTool(server, 'check_nuxt4_migration', {});
      expect(result.error).toBeUndefined();
      expect((result.project as { nuxtMajor: number }).nuxtMajor).toBe(4);
      expect(result.readiness).toBe('ready');
    } finally {
      watcher.stop();
    }
  });
});
