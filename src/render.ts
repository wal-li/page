import { isObject, merge, pathToRegexp, runScript } from '@wal-li/core';
import { parse as parseHTML } from 'node-html-parser';
import { Liquid } from 'liquidjs';

// template engine
const engine = new Liquid({
  root: [],
  partials: [],
  templates: {},
});

engine.registerFilter('route', (path) => {
  return path;
});

function parse(content: string) {
  const root = parseHTML(content);
  const routes: Record<string, any> = {};

  // parse content
  for (const node of root.childNodes as any) {
    if (!['SCRIPT', 'TEMPLATE'].includes(node.tagName)) continue;

    const path = (node.getAttribute('path') || '/').replace(/(^index|\/index)$/gi, '/');
    routes[path] ??= {};
    routes[path][node.tagName.toLowerCase()] = node.innerHTML.trim();

    if (node.tagName === 'TEMPLATE') routes[path].format = (node.getAttribute('format') || 'text').toLowerCase();
  }

  return routes;
}

function matchRoute(routes: Record<string, any>, path: string) {
  const routePaths = Object.keys(routes);

  for (const routePath of routePaths) {
    const nextParams = pathToRegexp(routePath).exec(path);
    if (nextParams) {
      return [routes[routePath], nextParams.groups || {}];
    }
  }

  return [];
}

async function routeRender(route: any, context: any) {
  // run result first
  let result: any;

  if (route.script) {
    result = await runScript(route.script, 'handler', context);
  }

  return await engine.parseAndRender(route.template, {
    ...(isObject(context) && Object.keys(context).length ? context : {}),
    ...(isObject(result) && Object.keys(result).length ? result : {}),
    context,
    result,
  });
}

async function render(content: string, context: any = {}) {
  const routes: Record<string, any> = parse(content);

  // handle route when meet many routes
  const path = context.path || '/';
  const [mainRoute, mainParams] = matchRoute(routes, path);
  context.params = merge({}, context.params || {}, mainParams || {});

  if (!mainRoute || !mainRoute.template) return;

  if (['base64', 'hex'].includes(mainRoute.format)) {
    return Buffer.from(mainRoute.template, mainRoute.format);
  }

  // do render
  if (mainRoute.script) {
    // then load other parts
    const loader: any = await runScript(mainRoute.script, 'load', context);
    if (loader)
      for (const name in loader) {
        const loadPath = loader[name];
        const [loadRoute, loadParams] = matchRoute(routes, loadPath);
        if (!loadRoute) continue;

        const loadContext = structuredClone(context);

        loadContext.path = loadPath;
        loadContext.params = merge({}, context.params || {}, loadParams || {});

        const loadContent = await routeRender(loadRoute, loadContext);

        context.templates ??= {};
        context.templates[name] = loadContent;
      }
  }

  return await routeRender(mainRoute, context);
}

export { parse, render };
