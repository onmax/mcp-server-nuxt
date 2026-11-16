/**
 * Usage tool: find_usages.
 */
import path from 'node:path';
import type { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { z } from 'zod';
import type { NuxtProjectContext } from '../context.js';
import { jsonResult, safe } from '../utils/helpers.js';
import { findUsages } from '../utils/find-usages.js';
import { listComponents } from '../utils/component-scan.js';
import { listComposables } from '../utils/nuxt-parser.js';

export function registerUsageTools(server: McpServer, ctx: NuxtProjectContext): void {
  server.tool(
    'find_usages',
    'Find every file that uses a component or composable (explicit imports, Nuxt auto-imports, Lazy prefix, kebab-case templates). Omit target to list unused components and composables. Static analysis only — no DevServer or nuxi prepare.',
    {
      target: z
        .string()
        .optional()
        .describe('Component name (UserCard), component file path, or composable name (useAuth). Omit to list unused components/composables.'),
      root: z
        .string()
        .optional()
        .describe('Optional project root override (defaults to the server project path)'),
    },
    safe(async ({ target, root }) => {
      const projectRoot = root ? path.resolve(root) : ctx.root;
      let components;
      let composables;
      if (projectRoot === ctx.root) {
        const snap = await ctx.snapshot();
        components = snap.components;
        composables = snap.composables;
      } else {
        components = await listComponents(projectRoot);
        composables = await listComposables(projectRoot);
      }
      const result = await findUsages(projectRoot, target, { components, composables });
      return jsonResult(result);
    }),
  );
}
