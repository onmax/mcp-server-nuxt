/**
 * Plugin injection tracing tool: explain_injections.
 */
import path from 'node:path';
import type { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { z } from 'zod';
import type { NuxtProjectContext } from '../context.js';
import { jsonResult, safe } from '../utils/helpers.js';
import { explainInjections } from '../utils/injections.js';

export function registerInjectionTools(server: McpServer, ctx: NuxtProjectContext): void {
  server.tool(
    'explain_injections',
    'Trace Nuxt plugin injections: find where useNuxtApp().$name values are provided (returned provide objects or nuxtApp.provide calls, including .client/.server plugins), list every file that references them, and report resolution status, multiple providers, unresolved third-party names, limitations and skipped/unreadable files. Static analysis only — no DevServer or nuxi prepare, and no automatic fixes.',
    {
      injection: z
        .string()
        .optional()
        .describe('Optional injection name filter, e.g. api or $api (normalized internally).'),
      root: z
        .string()
        .optional()
        .describe('Optional project root override (defaults to the server project path)'),
    },
    safe(async ({ injection, root }) => {
      const projectRoot = root ? path.resolve(root) : ctx.root;
      const result = await explainInjections(projectRoot, injection);
      return jsonResult(result);
    }),
  );
}
