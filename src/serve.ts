import { existsSync } from 'fs';
import { Container, httpLogger, joinPath, Logger, Method, Server, Start } from '@wal-li/core';
import process from 'process';
import WebSocket from 'ws';

import { Watcher } from './watcher';
import { bundle } from './bundle';
import { execute } from './execute';

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
  let masterContent: string = '';

  const loadProject = async () => {
    logger.info(`Loading...`);

    const lastBundle = Date.now();
    masterContent = await bundle(projectDir);

    logger.success(`Project was loaded - ${Date.now() - lastBundle}ms.`);

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
    const path = joinPath('/', input.params.path);

    return execute(masterContent, {
      path: path,
      method: input.method,
      params: {},
      query: input.query,
      fields: input.fields,
      headers: input.headers,
    });
  });

  // start
  loadProject();
  await container.execute(Start);

  logger.success(`Server is running at: ${server.address} - ${isDev ? 'Development' : 'Production'}.`);

  return { container, watcher, wss };
}

export { serve };
