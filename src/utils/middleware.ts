/**
 * Static middleware analysis. Reuses route scanning and `definePageMeta`
 * parsing from `explain-route` / `nuxt-parser`.
 */
import { promises as fs } from 'node:fs';
import path from 'node:path';
import { listAppMiddleware } from './explain-route.js';
import { extractPageMeta, listPageRoutes } from './nuxt-parser.js';

export type MiddlewareType = 'global' | 'named' | 'inline';

export interface MiddlewareTarget {
  name: string;
  file: string | null;
  type: MiddlewareType;
  globalOrder: number | null;
  globalMiddleware: string[];
  routes: string[];
  navigateTo: boolean;
  abortNavigation: boolean;
}

export interface MiddlewareItem {
  name: string;
  file: string | null;
  type: MiddlewareType;
  routes: string[];
  navigateTo: boolean;
  abortNavigation: boolean;
}

export interface ExplainMiddlewareResult {
  target: MiddlewareTarget | null;
  middleware: MiddlewareItem[];
  globalOrder: string[];
  inline: Array<{ file: string; path: string; line: number }>;
  missingReferences: Array<{ page: string; middleware: string }>;
  summary: string;
  notes: string[];
}

interface RouteMiddleware {
  path: string;
  file: string;
  middleware: string[];
  hasInline: boolean;
  inlineLine: number | null;
}

/**
 * Normalize a middleware name, `middleware/...` path or Nuxt 3/4 app path:
 * `app/middleware/auth.global.ts` -> `auth`, `middleware/admin/index.ts` -> `admin`.
 */
function middlewareKey(value: string): string {
  return value
    .replace(/\\/g, '/')
    .replace(/^.*?\/middleware\//, '')
    .replace(/^middleware\//, '')
    .replace(/\.(ts|js|mts|mjs)$/, '')
    .replace(/\.global$/, '')
    .replace(/\/index$/, '');
}

async function routeMiddleware(root: string): Promise<RouteMiddleware[]> {
  const routes = await listPageRoutes(root);
  const out: RouteMiddleware[] = [];
  for (const route of routes) {
    const content = await fs.readFile(route.absolutePath, 'utf8').catch(() => '');
    const meta = extractPageMeta(content);
    const defIndex = content.indexOf('definePageMeta');
    const defLine = defIndex >= 0 ? content.slice(0, defIndex).split('\n').length : 1;
    out.push({
      path: route.path,
      file: route.file,
      middleware: meta.middleware,
      hasInline: meta.hasInlineMiddleware ?? false,
      inlineLine: meta.hasInlineMiddleware ? defLine : null,
    });
  }
  return out;
}

function callsNavigate(content: string): boolean {
  return /\bnavigateTo\s*\(/.test(content);
}

function callsAbort(content: string): boolean {
  return /\babortNavigation\s*\(/.test(content);
}

/** Pages whose `definePageMeta.middleware` references a named middleware. */
function routesForMiddleware(routes: RouteMiddleware[], name: string, file: string): string[] {
  const key = middlewareKey(file);
  return routes
    .filter((r) => r.middleware.some((ref) => ref === name || middlewareKey(ref) === key))
    .map((r) => r.path);
}

export async function explainMiddleware(root: string, name?: string): Promise<ExplainMiddlewareResult> {
  const notes: string[] = [];
  const mwFiles = await listAppMiddleware(root);
  // Nuxt runs global middleware in alphabetical order of their file path.
  const globals = mwFiles.filter((m) => m.global).sort((a, b) => a.file.localeCompare(b.file));
  const globalOrder = globals.map((m) => m.name);

  const routes = await routeMiddleware(root);
  const allRoutePaths = routes.map((r) => r.path);

  const middleware: MiddlewareItem[] = [];
  for (const mw of mwFiles) {
    const content = await fs.readFile(path.join(root, mw.file), 'utf8').catch(() => '');
    const applicableRoutes = mw.global
      ? allRoutePaths
      : routesForMiddleware(routes, mw.name, mw.file);
    middleware.push({
      name: mw.name,
      file: mw.file,
      type: mw.global ? 'global' : 'named',
      routes: applicableRoutes,
      navigateTo: callsNavigate(content),
      abortNavigation: callsAbort(content),
    });
  }
  middleware.sort((a, b) => a.name.localeCompare(b.name));

  const inline: ExplainMiddlewareResult['inline'] = routes
    .filter((r) => r.hasInline)
    .map((r) => ({ file: r.file, path: r.path, line: r.inlineLine ?? 1 }));

  const missingReferences: ExplainMiddlewareResult['missingReferences'] = [];
  const knownNames = new Set([
    ...mwFiles.map((m) => m.name),
    ...mwFiles.map((m) => middlewareKey(m.file)),
  ]);
  for (const route of routes) {
    for (const mwName of route.middleware) {
      if (!knownNames.has(mwName) && !knownNames.has(middlewareKey(mwName))) {
        missingReferences.push({ page: route.file, middleware: mwName });
      }
    }
  }

  if (name && name.trim() !== '') {
    const trimmed = name.trim();
    const key = middlewareKey(trimmed);
    const match =
      mwFiles.find((m) => m.name === trimmed) ??
      mwFiles.find((m) => m.name === key) ??
      mwFiles.find((m) => middlewareKey(m.file) === key) ??
      mwFiles.find((m) => m.file === trimmed || m.file.endsWith(`/${trimmed}`));
    if (!match) {
      return {
        target: null,
        middleware,
        globalOrder,
        inline,
        missingReferences,
        summary: `Could not resolve "${trimmed}" to a middleware.`,
        notes: [
          `Known middleware: ${mwFiles.map((m) => m.name).join(', ') || '(none)'}.`,
        ],
      };
    }

    const content = await fs.readFile(path.join(root, match.file), 'utf8').catch(() => '');
    const applicableRoutes = match.global
      ? allRoutePaths
      : routesForMiddleware(routes, match.name, match.file);
    const globalIndex = match.global ? globals.findIndex((g) => g.file === match.file) + 1 : null;
    return {
      target: {
        name: match.name,
        file: match.file,
        type: match.global ? 'global' : 'named',
        globalOrder: globalIndex,
        globalMiddleware: globalOrder,
        routes: applicableRoutes,
        navigateTo: callsNavigate(content),
        abortNavigation: callsAbort(content),
      },
      middleware,
      globalOrder,
      inline,
      missingReferences,
      summary: `${match.name} is a ${match.global ? 'global' : 'named'} middleware applied to ${applicableRoutes.length} route(s).`,
      notes,
    };
  }

  return {
    target: null,
    middleware,
    globalOrder,
    inline,
    missingReferences,
    summary: `${middleware.length} middleware file(s), ${inline.length} inline, ${missingReferences.length} missing reference(s).`,
    notes,
  };
}
