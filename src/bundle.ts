import { Logger, pathToRegexp, runScript } from '@wal-li/core';
import { cpSync, existsSync, mkdirSync, readFileSync, rmSync, writeFileSync } from 'fs';
import { dirname, extname, join } from 'path';
import { deepScan } from './utils';
import { parse, render } from './render';

async function bundle(projectDir: string, outputFile: string) {
  const logger = new Logger('bundle');

  // prepare output
  if (!existsSync(projectDir)) {
    logger.error(`Invalid project directory.`);
    return;
  }

  if (existsSync(outputFile)) {
    rmSync(outputFile, { recursive: true, force: true });
  }

  mkdirSync(dirname(outputFile), { recursive: true });

  // scan
  let masterContent: string = '';

  const entries = deepScan('', projectDir);
  for (const entry of entries) {
    const ext = extname(entry).toLowerCase();
    const type = ext.substring(1);
    const content = readFileSync(join(projectDir, entry)).toString().trim();

    if (!['wlp'].includes(type)) {
      masterContent += `<!-- file "${entry}" -->\n<template path="${entry}">\n${content}\n</template>\n<!-- endfile -->\n`;
      logger.success(`Copy: ${entry}`);
      continue;
    }

    const path = entry.replace(/\.(wlp)$/gi, '').replace(/(^index|\/index)$/gi, '/');
    const routes = parse(content);

    if (!Object.keys(routes).length) continue;

    masterContent += `<!-- file "${entry}" -->\n`;

    for (const routePath in routes) {
      const route = routes[routePath];
      const nextRoutePath = join(path, routePath);

      if (route.script) masterContent += `<script path="${nextRoutePath}">\n${route.script}\n</script>\n`;
      if (route.template) masterContent += `<template path="${nextRoutePath}">\n${route.template}\n</template>\n`;

      logger.success(`Bundle: ${nextRoutePath}`);
    }

    masterContent += `<!-- endfile -->\n`;
  }

  // write output
  writeFileSync(outputFile, masterContent);
}

export { bundle };
