import { Logger, pathToRegexp, runScript } from '@wal-li/core';
import { cpSync, existsSync, mkdirSync, readFileSync, rmSync, writeFileSync } from 'fs';
import { dirname, extname, join } from 'path';
import { deepScan } from './utils';
import { parse, render } from './render';

async function build(projectDir: string, outputDir: string) {
  const logger = new Logger('build');

  // prepare output
  if (!existsSync(projectDir)) {
    logger.error(`Invalid project directory.`);
    return;
  }

  if (existsSync(outputDir)) {
    rmSync(outputDir, { recursive: true, force: true });
  }

  mkdirSync(outputDir);

  // scan
  const entries = deepScan('', projectDir);
  for (const entry of entries) {
    const ext = extname(entry).toLowerCase();
    const type = ext.substring(1);

    if (!['wlp'].includes(type)) {
      cpSync(join(projectDir, entry), join(outputDir, entry), { recursive: true });
      logger.success(`Copy: ${entry}`);
      continue;
    }

    const path = entry.replace(/\.(wlp)$/gi, '').replace(/(^index|\/index)$/gi, '/');

    const content = readFileSync(join(projectDir, entry)).toString();
    const routes = parse(content);

    for (const routePath in routes) {
      const route = routes[routePath];
      const nextRoutePath = join(path, routePath);

      if (!route.script) continue;

      const initData: any[] = (await runScript(route.script, 'init')) as any[];

      if (!initData || initData.length === 0) continue;

      for (const data of initData) {
        const inputPath = data.path || '/';
        const result = await render(content, {
          path: inputPath,
          params: pathToRegexp(nextRoutePath).exec(inputPath)?.groups,
          ...data,
        });

        if (result) {
          const outputPath = join(outputDir, data.outputPath || inputPath);
          mkdirSync(dirname(outputPath), { recursive: true });
          writeFileSync(outputPath, result);
          logger.success(`Build: ${outputPath.substring(join(outputDir).length + 1)}`);
        }
      }
    }
  }
}

export { build };
