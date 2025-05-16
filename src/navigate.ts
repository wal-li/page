import { merge, pathToRegexp, Response, StatusCode } from '@wal-li/core';
import { render } from './render';
import { injectHotReload, isBinaryFile, isCSS, isHtml, isJS } from './utils';
import { fromBuffer } from 'file-type';
import { getType } from 'mime';

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

const NOTFOUND_RESPONSE = new Response(StatusCode.NOT_FOUND, 'Not Found', {
  'Content-Type': 'text/plain',
});

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

async function makeResponse(
  status: number = StatusCode.NOT_FOUND,
  path: string = '/',
  body: any,
  headers: Record<string, string> = {},
) {
  if (status === StatusCode.NOT_FOUND && !body) return NOTFOUND_RESPONSE;
  if (!body) return new Response(status, '', headers);

  const res = new Response(status || StatusCode.OK, body, headers);

  if (!res.headers['content-type']) {
    // check filename
    let fileType: any = getType(path);

    // check file content
    if (!fileType && (!(body instanceof Buffer) || (body instanceof Buffer && !isBinaryFile(body)))) {
      body = body.toString();
      res.body = body;

      if (isHtml(path, body)) fileType = 'text/html';
      else if (isJS(path, body)) fileType = 'application/javascript';
      else if (isCSS(path, body)) fileType = 'text/css';
      else fileType = 'text/plain';
    }

    // lookup from binary
    if (!fileType && (body instanceof Uint8Array || body instanceof Buffer || body instanceof ArrayBuffer))
      fileType = (await fromBuffer(body))?.mime;

    if (fileType) res.headers['content-type'] = fileType;
  }

  return res;
}

export async function navigate(routes: Route[], context: Record<string, any>, lookupTemplate?: Function) {
  const isDev = process.env.NODE_ENV === 'development';
  const path = context.path || '/';

  // Sort routes by descending specificity
  const sortedRoutes = routes
    .slice() // avoid mutating original
    .sort((a, b) => getRouteScore(b.path) - getRouteScore(a.path));

  const routeRes = matchRoute(sortedRoutes, path);
  if (!routeRes) return NOTFOUND_RESPONSE;

  const [mainRoute, mainParams] = routeRes;

  if (!mainRoute) return NOTFOUND_RESPONSE;

  context.params = merge({}, context.params || {}, mainParams || {});
  context = merge({}, mainRoute.context || {}, context);

  // lookup template
  let scriptBlock = mainRoute.script;
  let viewBlock = mainRoute.view;
  if (mainRoute.template && lookupTemplate) {
    const templateRes: Route = await lookupTemplate(mainRoute.template);
    if (!templateRes) return NOTFOUND_RESPONSE;

    scriptBlock = templateRes.script;
    viewBlock = templateRes.view;
  }

  // raw response in <route path="..."><view format="base64"></view></route>
  if (viewBlock?.format && ['base64', 'hex'].includes(viewBlock?.format)) {
    let scriptRes: any;

    if (scriptBlock) scriptRes = (await render(scriptBlock?.content, '', context)).script;

    return await makeResponse(
      scriptRes?.status || 200,
      path,
      Buffer.from(viewBlock?.content || '', viewBlock.format),
      scriptRes?.headers || {},
    );
  }

  // render page
  let renderRes = await render(scriptBlock?.content, viewBlock?.content, context);

  const layoutName = renderRes.layout ? renderRes.layout : mainRoute.layout;

  // layout
  if (layoutName && lookupTemplate) {
    const layoutRoute: Route | undefined = await lookupTemplate(layoutName);
    if (!layoutRoute) return NOTFOUND_RESPONSE;

    context = merge({}, layoutRoute.context || {}, context, { child: renderRes });
    renderRes = await render(layoutRoute.script?.content, layoutRoute.view?.content, context);
  }

  if (!renderRes.script && !renderRes.view) return NOTFOUND_RESPONSE;

  const content = renderRes.view
    ? isDev
      ? injectHotReload(context.path, renderRes.view)
      : renderRes.view
    : renderRes.script?.body;

  return await makeResponse(
    renderRes.script?.status || (content ? StatusCode.OK : StatusCode.NOT_FOUND),
    path,
    content,
    renderRes.script?.headers || {},
  );
}
