/**
 * Nuxt 4 migration tool: check_nuxt4_migration.
 */
import path from 'node:path';
import type { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { z } from 'zod';
import type { NuxtProjectContext } from '../context.js';
import { jsonResult, safe } from '../utils/helpers.js';
import { checkNuxt4Migration } from '../utils/nuxt4-migration.js';

export function registerNuxt4MigrationTools(server: McpServer, ctx: NuxtProjectContext): void {
  server.tool(
    'check_nuxt4_migration',
    'Check a Nuxt project against the official Nuxt 4 upgrade guide: current package.json version, app/ directory or future.compatibilityVersion 4, legacy root directories, singleton data-fetching conflicts, data/error/pending/shallow-reactivity changes, and removed APIs/options (route.meta, Unhead v2, window.__NUXT__, generate, experimental, pages:extend meta). Static analysis only — no DevServer or nuxi prepare.',
    {
      root: z
        .string()
        .optional()
        .describe('Optional project root override (defaults to the server project path)'),
    },
    safe(async ({ root }) => {
      const projectRoot = root ? path.resolve(root) : ctx.root;
      const result = await checkNuxt4Migration(projectRoot);
      return jsonResult(result);
    }),
  );
}
