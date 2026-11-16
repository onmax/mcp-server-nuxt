/**
 * Data fetching tool: explain_data_fetching.
 */
import path from 'node:path';
import type { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { z } from 'zod';
import type { NuxtProjectContext } from '../context.js';
import { jsonResult, safe } from '../utils/helpers.js';
import { explainDataFetching } from '../utils/data-fetching.js';

export function registerDataFetchingTools(server: McpServer, ctx: NuxtProjectContext): void {
  server.tool(
    'explain_data_fetching',
    'List useFetch / useLazyFetch / useAsyncData / useLazyAsyncData / $fetch calls with URL or key, method and detected options, and flag duplicate keys, $fetch in onMounted, bare await $fetch at setup top level, server: false without lazy, and lazy results rendered without pending/status. Accepts a page/component file or a URL resolved like explain_route. Static analysis only — no DevServer or nuxi prepare.',
    {
      path: z
        .string()
        .optional()
        .describe('Optional page/component file (or directory) or a concrete URL like /users/42. Omit to scan all pages, components, layouts and composables.'),
      root: z
        .string()
        .optional()
        .describe('Optional project root override (defaults to the server project path)'),
    },
    safe(async ({ path: target, root }) => {
      const projectRoot = root ? path.resolve(root) : ctx.root;
      const result = await explainDataFetching(projectRoot, target);
      return jsonResult(result);
    }),
  );
}
