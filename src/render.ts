import { isObject, merge, pathToRegexp, runScript } from '@wal-li/core';
import { parse as parseHTML } from 'node-html-parser';
import { Liquid } from 'liquidjs';

const engine = new Liquid();

function parse(content: string) {
  const root = parseHTML(content);
  const routes: Record<string, any> = {};

  // parse content
  for (const node of root.childNodes as any) {
    if (!['SCRIPT', 'TEMPLATE'].includes(node.tagName)) continue;

    const path = (node.getAttribute('path') || '/').replace(/(^index|\/index)$/gi, '/');
    routes[path] ??= {};
    routes[path][node.tagName.toLowerCase()] = node.innerHTML.trim();
  }

  return routes;
}

async function render(content: string, context?: any) {
  const routes: Record<string, any> = parse(content);

  // handle route when meet many routes
  const routePaths = Object.keys(routes);
  let route;

  if (routePaths.length === 1) {
    route = routes[routePaths[0]];
  } else if (routePaths.length > 1) {
    const path = context.query?.path || '/';

    for (const routePath of routePaths) {
      const nextParams = pathToRegexp(routePath).exec(path);
      if (nextParams) {
        route = routes[routePath];
        context.params = merge(context.params, nextParams.groups || {});
        break;
      }
    }
  }

  if (!route || !route.template) return;

  // do render
  let result: any;
  if (route.script) result = await runScript(route.script, 'handler', context);

  return await engine.parseAndRender(route.template, {
    ...(isObject(context) && Object.keys(context).length ? context : {}),
    ...(isObject(result) && Object.keys(result).length ? result : {}),
    context,
    result,
  });
}

export { parse, render };
