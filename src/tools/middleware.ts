/**
 * Middleware tool: explain_middleware.
 */
import path from 'node:path';
import type { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { z } from 'zod';
import type { NuxtProjectContext } from '../context.js';
import { jsonResult, safe } from '../utils/helpers.js';
import { explainMiddleware } from '../utils/middleware.js';

export function registerMiddlewareTools(server: McpServer, ctx: NuxtProjectContext): void {
  server.tool(
    'explain_middleware',
    'Explain a Nuxt middleware (global / named / inline): its type, global run order, the routes it applies to, and whether it calls navigateTo or abortNavigation. Omit name to list all middleware and flag pages referencing missing middleware. Static analysis only — no DevServer or nuxi prepare.',
    {
      name: z
        .string()
        .optional()
        .describe('Middleware name or a file under middleware/, e.g. auth or middleware/auth.ts. Omit to list all middleware.'),
      root: z
        .string()
        .optional()
        .describe('Optional project root override (defaults to the server project path)'),
    },
    safe(async ({ name, root }) => {
      const projectRoot = root ? path.resolve(root) : ctx.root;
      const result = await explainMiddleware(projectRoot, name);
      return jsonResult(result);
    }),
  );
}
