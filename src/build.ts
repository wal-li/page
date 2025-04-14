import { joinPath, Logger, pathToRegexp, runScript } from '@wal-li/core';
import { cpSync, existsSync, mkdirSync, readFileSync, rmSync, writeFileSync } from 'fs';
import { dirname, extname, join } from 'path';
import { deepScan } from './utils';
import { parse, render } from './render';
import { bundle } from './bundle';

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
  logger.info(`Building...`);
  const lastBuild = Date.now();

  const masterContent = await bundle(projectDir);

  const routes = parse(masterContent);

  for (const routePath in routes) {
    const route = routes[routePath];

    if (!route.script) continue;

    const initData: any[] = (await runScript(route.script, 'init')) as any[];

    if (!initData || initData.length === 0) continue;

    for (const data of initData) {
      const inputPath = data.path || '/';
      const result = await render(masterContent, {
        path: inputPath,
        ...data,
      });

      if (result) {
        const outputPath = join(outputDir, data.outputPath || inputPath);
        mkdirSync(dirname(outputPath), { recursive: true });
        writeFileSync(outputPath, result);
        logger.success(`Build: ${outputPath.substring(join(outputDir).length)}`);
      }
    }
  }

  const entries = deepScan('', projectDir);
  for (const entry of entries) {
    const ext = extname(entry).toLowerCase();
    const type = ext.substring(1);

    // copy static file
    if (!['wlp'].includes(type)) {
      cpSync(join(projectDir, entry), join(outputDir, entry), { recursive: true });
      logger.success(`Copy: /${entry}`);
      continue;
    }
  }

  logger.success(`Project was built - ${Date.now() - lastBuild}ms.`);
}

export { build };
