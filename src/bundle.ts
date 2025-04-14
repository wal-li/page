import { joinPath, Logger, pathToRegexp, runScript } from '@wal-li/core';
import { cpSync, existsSync, mkdirSync, readFileSync, rmSync, writeFileSync } from 'fs';
import { dirname, extname, join } from 'path';
import { deepScan, isBinaryFile } from './utils';
import { parse, render } from './render';

async function bundle(projectDir: string) {
  const logger = new Logger('bundle');

  // prepare output
  if (!existsSync(projectDir)) {
    logger.error(`Invalid project directory.`);
    return '';
  }

  // scan
  let masterContent: string = '';

  const entries = deepScan('', projectDir);
  for (const entry of entries) {
    const ext = extname(entry).toLowerCase();
    const type = ext.substring(1);
    const routePath = joinPath('/', entry);

    let content: any = readFileSync(join(projectDir, entry));

    if (!['wlp'].includes(type)) {
      if (isBinaryFile(content)) {
        masterContent += `<!-- file "${routePath}" -->\n<template path="${routePath}" format="base64">\n${content.toString(
          'base64',
        )}\n</template>\n<!-- endfile -->\n`;
      } else {
        content = content.toString().trim();
        masterContent += `<!-- file "${routePath}" -->\n<template path="${routePath}">\n${content}\n</template>\n<!-- endfile -->\n`;
      }

      logger.success(`Copy: ${routePath}`);
      continue;
    }

    const path = routePath.replace(/\.(wlp)$/gi, '').replace(/(^index|\/index)$/gi, '/');
    const routes = parse(content);

    if (!Object.keys(routes).length) continue;

    masterContent += `<!-- file "${routePath}" -->\n`;

    for (const routePath in routes) {
      const route = routes[routePath];
      const nextRoutePath = joinPath(path, routePath);

      if (route.script) masterContent += `<script path="${nextRoutePath}">\n${route.script}\n</script>\n`;
      if (route.template) masterContent += `<template path="${nextRoutePath}">\n${route.template}\n</template>\n`;

      logger.success(`Bundle: ${nextRoutePath}`);
    }

    masterContent += `<!-- endfile -->\n`;
  }

  // write output
  return masterContent;
}

export { bundle };
