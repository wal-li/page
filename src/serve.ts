import { existsSync, readFileSync } from 'fs';
import { Container, httpLogger, Logger, Method, pathToRegexp, Server, Start } from '@wal-li/core';
import { extname, join } from 'path';
import process from 'process';
import WebSocket from 'ws';

import { Watcher } from './watcher';
import { render } from './render';
import { deepScan, injectHotReload } from './utils';

async function serve(projectDir: string) {
  const logger = new Logger('serve');
  const isDev = process.env.NODE_ENV === 'development';

  if (!existsSync(projectDir)) {
    logger.error(`Invalid project directory.`);
    return;
  }

  const container = new Container();
  const watcher = new Watcher(projectDir);
  const wss = new WebSocket.Server({ port: 3001 });

  // register
  container.register('@.host', '0.0.0.0');
  container.register('@.port', '3000');
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
      const path = entry.replace(/\.(wlp)$/gi, '').replace(/(^index|\/index)$/gi, '/');

      instances[entry] ??= {};
      instances[entry].type = ext.substring(1);
      instances[entry].path = path;
      instances[entry].content = readFileSync(join(projectDir, entry)).toString();

      logger.info(`Added paths: ${instances[entry].path}`);
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
  server.addRoute(Method.ALL, '/[[...path]]', async (input: any) => {
    let matchedEntry;
    let matchedParams;

    for (const entry in instances) {
      if (!instances[entry]) continue;

      const ret = pathToRegexp(instances[entry].path).exec(input.params.path);
      if (!ret) continue;

      matchedEntry = entry;
      matchedParams = ret.groups || {};
    }

    if (!matchedEntry) return;

    if (!['wlp'].includes(instances[matchedEntry].type))
      return injectHotReload(instances[matchedEntry].path, instances[matchedEntry].content);

    return injectHotReload(
      instances[matchedEntry].path,
      await render(instances[matchedEntry].content, {
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
  await container.execute(Start);

  logger.success(`Server is running at: ${server.address} - ${isDev ? 'Development' : 'Production'}.`);

  return { container, watcher, wss };
}

export { serve };
