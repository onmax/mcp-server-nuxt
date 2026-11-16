/**
 * SSR safety tool: check_ssr_safety.
 */
import path from 'node:path';
import type { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { z } from 'zod';
import type { NuxtProjectContext } from '../context.js';
import { jsonResult, safe } from '../utils/helpers.js';
import { checkSsrSafety } from '../utils/ssr-safety.js';

export function registerSsrSafetyTools(server: McpServer, ctx: NuxtProjectContext): void {
  server.tool(
    'check_ssr_safety',
    'Statically flag SSR hazards: browser-only globals at setup top level / module scope, non-deterministic values (Date.now / Math.random / crypto.randomUUID) rendered in templates or computed, and shared ref/reactive state in composables. Static analysis only — no DevServer or nuxi prepare.',
    {
      path: z
        .string()
        .optional()
        .describe('Optional file or directory to limit the scan (relative to the project root).'),
      root: z
        .string()
        .optional()
        .describe('Optional project root override (defaults to the server project path)'),
    },
    safe(async ({ path: targetPath, root }) => {
      const projectRoot = root ? path.resolve(root) : ctx.root;
      const result = await checkSsrSafety(projectRoot, targetPath);
      return jsonResult(result);
    }),
  );
}
