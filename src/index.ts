import { Dirent, existsSync, readdirSync, readFileSync } from 'fs';
import { Container, httpLogger, Logger, Method, pathToRegexp, Server, Start } from '@wal-li/core';
import { extname, join } from 'path';
import process from 'process';
import WebSocket from 'ws';

import { Watcher } from './watcher';
import { render } from './render';

function deepScan(dir: string, root = '.'): string[] {
  return readdirSync(join(root, dir), { withFileTypes: true })
    .sort((a: Dirent, b: Dirent) => {
      if (a.name[0] === '_' && b.name[0] !== '_') return 1;
      if (a.name[0] !== '_' && b.name[0] === '_') return -1;

      return 0;
    })
    .map((file: Dirent): string | string[] => {
      if (file.isDirectory()) return deepScan(join(dir, file.name), root);
      return join(dir, file.name);
    })
    .flat();
}

function isHtml(path: string, content: string) {
  return (
    path.endsWith('.html') ||
    path.endsWith('.htm') ||
    content.includes('<html>') ||
    content.includes('<head>') ||
    content.includes('<body>')
  );
}

function injectHotReload(path: string, content: string) {
  if (!isHtml(path, content)) return content;
  return content.replace(
    /<\/body>/i,
    `<script>
      const socket = new WebSocket(\`ws://\${window.location.hostname}:3001\`);
      socket.addEventListener('message', (event) => {
        if (event.data === 'reload') {
          location.reload();
        }
      });
    </script></body>`,
  );
}

async function start(projectDir: string) {
  const logger = new Logger('system');
  const isDev = process.env.NODE_ENV === 'development';

  if (!existsSync(projectDir)) {
    logger.error(`Invalid project directory.`);
    return;
  }

  const container = new Container();
  const watcher = new Watcher(projectDir);
  const wss = new WebSocket.Server({ port: 3001 });

  // register
  container.register('env.host', '0.0.0.0');
  container.register('env.port', '3000');
  const server: Server = await container.resolve<Server>(Server);

  server.use(httpLogger);

  // project
  let instances: Record<string, any> = {};

  const loadProject = () => {
    logger.info(`Loading...`);

    const entries = deepScan('', projectDir);

    instances = {};

    for (const entry of entries) {
      const ext = extname(entry).toLowerCase();
      const path = entry.replace(/\.(js|wlp)$/gi, '');

      instances[entry] ??= {};
      instances[entry].type = ext.substring(1);
      instances[entry].path = path;
      instances[entry].paths = [...new Set([path, path.replace(/(^index\.html|\/index\.html)$/gi, '/')])].map((p) =>
        p.replace(/(^|\/)(_)(\w+)/g, (match, before, underscore, word) => {
          return before + ':' + word;
        }),
      );
      instances[entry].content = readFileSync(join(projectDir, entry)).toString();

      logger.info(`Added paths: ${instances[entry].paths.join(' ')}`);
    }

    logger.success('Project was loaded!');

    // hot reload
    wss.clients.forEach((client: any) => {
      if (client.readyState === WebSocket.OPEN) {
        client.send('reload');
      }
    });
  };

  // watcher
  watcher.on('change', loadProject);

  // routing
  server.addRoute(Method.ALL, '.*', async (input: any) => {
    let matchedEntry;
    let matchedParams;

    for (const entry in instances) {
      if (!instances[entry]) continue;

      for (const path of instances[entry].paths) {
        const ret = pathToRegexp(path).exec(input.path);
        if (!ret) continue;

        matchedEntry = entry;
        matchedParams = ret.groups || {};
        break;
      }
    }

    if (!matchedEntry) return;

    if (!['js', 'wlp'].includes(instances[matchedEntry].type))
      return injectHotReload(instances[matchedEntry].path, instances[matchedEntry].content);

    return injectHotReload(
      instances[matchedEntry].path,
      await render(instances[matchedEntry].type, instances[matchedEntry].content, {
        path: input.path,
        method: input.method,
        params: matchedParams,
        query: input.query,
        fields: input.fields,
        headers: input.headers,
      }),
    );
  });

  // start
  loadProject();
  container.execute(Start);

  logger.success(`Server is running at: ${server.address} - ${isDev ? 'Development' : 'Production'}.`);

  return { container, watcher, wss };
}

export { start };
