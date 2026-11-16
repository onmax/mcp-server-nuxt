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
  inline: Array<{ file: string; line: number }>;
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

async function routeMiddleware(root: string): Promise<RouteMiddleware[]> {
  const routes = await listPageRoutes(root);
  const out: RouteMiddleware[] = [];
  for (const route of routes) {
    const content = await fs.readFile(route.absolutePath, 'utf8').catch(() => '');
    const meta = extractPageMeta(content);
    const defMatch = content.match(/definePageMeta\s*\(\s*\{([\s\S]*?)\}\s*\)/);
    const defLine = defMatch ? content.slice(0, defMatch.index).split('\n').length : 1;
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

function callsNavigate(file: string | null, content: string): boolean {
  return /\bnavigateTo\s*\(/.test(content);
}

function callsAbort(file: string | null, content: string): boolean {
  return /\babortNavigation\s*\(/.test(content);
}

export async function explainMiddleware(root: string, name?: string): Promise<ExplainMiddlewareResult> {
  const notes: string[] = [];
  const mwFiles = await listAppMiddleware(root);
  const globalOrder = mwFiles
    .filter((m) => m.global)
    .map((m) => m.name)
    .sort((a, b) => a.localeCompare(b));

  const routes = await routeMiddleware(root);
  const allRoutePaths = routes.map((r) => r.path);

  const middleware: MiddlewareItem[] = [];
  for (const mw of mwFiles) {
    const content = await fs.readFile(path.join(root, mw.file), 'utf8').catch(() => '');
    const applicableRoutes = mw.global
      ? allRoutePaths
      : routes.filter((r) => r.middleware.includes(mw.name)).map((r) => r.path);
    middleware.push({
      name: mw.name,
      file: mw.file,
      type: mw.global ? 'global' : 'named',
      routes: applicableRoutes,
      navigateTo: callsNavigate(mw.file, content),
      abortNavigation: callsAbort(mw.file, content),
    });
  }
  middleware.sort((a, b) => a.name.localeCompare(b.name));

  const inline: ExplainMiddlewareResult['inline'] = routes
    .filter((r) => r.hasInline)
    .map((r) => ({ file: r.file, line: r.inlineLine ?? 1 }));

  const missingReferences: ExplainMiddlewareResult['missingReferences'] = [];
  const knownNames = new Set(mwFiles.map((m) => m.name));
  for (const route of routes) {
    for (const mwName of route.middleware) {
      if (!knownNames.has(mwName)) {
        missingReferences.push({ page: route.file, middleware: mwName });
      }
    }
  }

  if (name && name.trim() !== '') {
    const trimmed = name.trim();
    const byName = mwFiles.find((m) => m.name === trimmed);
    const byFile = mwFiles.find(
      (m) => m.file === trimmed || m.file.endsWith(trimmed) || trimmed.endsWith(m.file),
    );
    const match = byName ?? byFile;
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
      : routes.filter((r) => r.middleware.includes(match.name)).map((r) => r.path);
    const globalIndex = match.global ? globalOrder.indexOf(match.name) + 1 : null;
    return {
      target: {
        name: match.name,
        file: match.file,
        type: match.global ? 'global' : 'named',
        globalOrder: globalIndex,
        globalMiddleware: globalOrder,
        routes: applicableRoutes,
        navigateTo: callsNavigate(match.file, content),
        abortNavigation: callsAbort(match.file, content),
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
