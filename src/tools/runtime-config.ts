/**
 * Runtime config tool: check_runtime_config.
 */
import path from 'node:path';
import type { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { z } from 'zod';
import type { NuxtProjectContext } from '../context.js';
import { jsonResult, safe } from '../utils/helpers.js';
import { checkRuntimeConfig } from '../utils/runtime-config.js';

export function registerRuntimeConfigTools(server: McpServer, ctx: NuxtProjectContext): void {
  server.tool(
    'check_runtime_config',
    'Parse runtimeConfig from nuxt.config, list flattened keys with types and env vars, scan useRuntimeConfig() accesses, and report undefined/unused keys plus private keys read in client code. Never prints values. Static analysis only — no DevServer or nuxi prepare.',
    {
      root: z
        .string()
        .optional()
        .describe('Optional project root override (defaults to the server project path)'),
    },
    safe(async ({ root }) => {
      const projectRoot = root ? path.resolve(root) : ctx.root;
      const result = await checkRuntimeConfig(projectRoot);
      return jsonResult(result);
    }),
  );
}
