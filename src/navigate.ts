import { merge, pathToRegexp, Response } from '@wal-li/core';
import { render } from './render';
import { injectHotReload } from './utils';
import layout from 'liquidjs/dist/tags/layout';

export type Block = {
  [key: string]: any;
  content: string;
};

export type Route = {
  name?: string; // TEMPLATE
  path?: string; // ALIAS, ROUTE
  to?: string; // ALIAS
  layout?: string; // ROUTE
  template?: string; // ROUTE
  script?: Block; // ROUTE, TEMPLATE
  view?: Block; // ROUTE, TEMPLATE
  context?: Record<string, any>; // ROUTE, TEMPLATE
};

function matchRoute(routes: Route[], path: string): [Route, any] | undefined {
  for (const route of routes) {
    const routePath = route.path || '/';
    const nextParams = pathToRegexp(routePath).exec(path);
    if (nextParams) {
      // <alias path="..." to="..." />
      if (route.to) {
        const res = matchRoute(routes, route.to);
        if (!res) return res;
        return [res[0], merge(nextParams.groups || {}, res[1])];
      } // <route path="..."></route>
      else {
        return [route, nextParams.groups || {}];
      }
    }
  }
}

function getRouteScore(path: string = '/'): number {
  // Higher score = higher priority
  // More static segments → higher score
  const segments = path.split('/').filter(Boolean);
  let score = 0;

  for (const segment of segments) {
    if (!segment.includes('[')) {
      score += 10; // static
    } else {
      score += 1; // dynamic
    }
  }

  return score;
}

export async function navigate(routes: Route[], context: Record<string, any>, lookupTemplate?: Function) {
  const isDev = process.env.NODE_ENV === 'development';
  const path = context.path || '/';

  // Sort routes by descending specificity
  const sortedRoutes = routes
    .slice() // avoid mutating original
    .sort((a, b) => getRouteScore(b.path) - getRouteScore(a.path));

  const routeRes = matchRoute(sortedRoutes, path);
  if (!routeRes) return;

  const [mainRoute, mainParams] = routeRes;

  if (!mainRoute) return;

  context.params = merge({}, context.params || {}, mainParams || {});
  context = merge({}, mainRoute.context || {}, context);

  // lookup template
  let scriptBlock = mainRoute.script;
  let viewBlock = mainRoute.view;
  if (mainRoute.template && lookupTemplate) {
    const templateRes: Route = await lookupTemplate(mainRoute.template);
    if (!templateRes) return;

    scriptBlock = templateRes.script;
    viewBlock = templateRes.view;
  }

  // raw response in <route path="..."><view format="base64"></view></route>
  if (viewBlock?.format && ['base64', 'hex'].includes(viewBlock?.format)) {
    return Buffer.from(viewBlock?.content || '', viewBlock.format);
  }

  // render page
  let renderRes = await render(scriptBlock?.content, viewBlock?.content, context);

  const layoutName = renderRes.layout ? renderRes.layout : mainRoute.layout;

  // layout
  if (layoutName && lookupTemplate) {
    const layoutRoute: Route | undefined = await lookupTemplate(layoutName);
    if (!layoutRoute) return;

    context = merge({}, layoutRoute.context || {}, context, { child: renderRes });
    renderRes = await render(layoutRoute.script?.content, layoutRoute.view?.content, context);
  }

  if (!renderRes.script && !renderRes.view) return;

  // have view
  if (renderRes.view)
    return new Response(
      renderRes.script?.status || 200,
      isDev ? injectHotReload(context.path, renderRes.view) : renderRes.view,
      renderRes.script?.headers || {},
    );

  // have script only
  return renderRes;
}
