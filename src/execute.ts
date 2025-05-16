import { parse as parseHTML } from 'node-html-parser';
import { Block, Route, navigate } from './navigate';

export async function execute(content: string = '', context: Record<string, any> = {}) {
  const root = parseHTML(content);

  const routes: Route[] = [];
  const templateMap: Map<string, Route> = new Map();

  // Extract script and view sources
  let mainRoute: Route | undefined;

  for (const node of root.childNodes as any) {
    let item: Route = {};

    switch (node.tagName) {
      case 'ROUTE':
        item = {
          path: node.getAttribute('path'),
          layout: node.getAttribute('layout'),
          template: node.getAttribute('template'),
        };
        routes.push(item);
        break;

      case 'ALIAS':
        item = {
          path: node.getAttribute('path'),
          to: node.getAttribute('to'),
        };
        routes.push(item);
        break;

      case 'TEMPLATE':
        item = {
          name: node.getAttribute('name'),
        };

        if (!item.name) continue;

        templateMap.set(item.name, item);
        break;

      case 'VIEW':
        mainRoute ??= { path: '/' };
        mainRoute.view = { content: node.innerHTML.trim(), format: node.getAttribute('format') };
        break;

      case 'SCRIPT':
        mainRoute ??= { path: '/' };
        mainRoute.script = { content: node.innerHTML.trim() };
        break;
    }

    if (['ROUTE', 'TEMPLATE'].includes(node.tagName)) {
      // Extract script and view sources
      for (const child of node.childNodes as any) {
        if (['SCRIPT', 'VIEW'].includes(child.tagName)) {
          const blockName = child.tagName === 'SCRIPT' ? 'script' : 'view';

          item[blockName] = {
            content: child.innerHTML.trim(),
          };

          // add view format
          if (blockName === 'view') (item.view as Block).format = child.getAttribute('format');
        }
      }
    }
  }

  if (mainRoute) routes.push(mainRoute);

  return await navigate(routes, context, (name: string) => {
    return templateMap.get(name);
  });
}
