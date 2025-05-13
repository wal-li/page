import { joinPath, Logger } from '@wal-li/core';
import { existsSync, readFileSync } from 'fs';
import { extname, join } from 'path';
import { deepScan, isBinaryFile } from './utils';

function formatContent(routePath: string, content: string, minify: boolean): string {
  return `${minify ? '' : `<!-- file "${routePath}" -->\n`}${content}${minify ? '' : '\n\n'}`;
}

function formatTemplate(routePath: string, name: string, content: string, minify: boolean): string {
  return `${minify ? '' : `<!-- file "${routePath}" -->\n`}<template name="${name}">${minify ? '' : '\n'}${content}${
    minify ? '' : '\n'
  }</template>${minify ? '' : '\n\n'}`;
}

function formatRoute(routePath: string, path: string, content: string, minify: boolean): string {
  return `${minify ? '' : `<!-- file "${routePath}" -->\n`}<route path="${path}">${minify ? '' : '\n'}${content}${
    minify ? '' : '\n'
  }</route>${minify ? '' : '\n\n'}`;
}

function formatRaw(routePath: string, path: string, content: string, isBinary: boolean, minify: boolean): string {
  return `${minify ? '' : `<!-- file "${routePath}" -->\n`}<route path="${path}">${minify ? '' : '\n'}<view${
    isBinary ? ' format="base64"' : ''
  }>${minify ? '' : '\n'}${content}${minify ? '' : '\n'}</view>${minify ? '' : '\n'}</route>${minify ? '' : '\n\n'}`;
}

export async function bundle(projectDir: string, minify: boolean = false): Promise<string> {
  const logger = new Logger('bundle');

  if (!existsSync(projectDir)) {
    logger.error(`Invalid project directory.`);
    return '';
  }

  let masterContent = '';
  const entries = deepScan('', projectDir);

  for (const entry of entries) {
    const ext = extname(entry).toLowerCase();
    const type = ext.substring(1);
    const routePath = joinPath('/', entry);
    const filePath = join(projectDir, entry);

    const content = readFileSync(filePath);
    const path = routePath.replace(/\.(wlp)$/gi, '').replace(/(^index|\/index)$/gi, '/');

    if (type === 'wlp') {
      const textContent = content.toString().trim();

      if (path.startsWith('/(templates)/')) {
        // template
        const name = path.replace('/(templates)/', '');
        masterContent += formatTemplate(routePath, name, textContent, minify);
        logger.success(`Copy: ${routePath} -> ${name}`);
        continue;
      } else if (
        textContent.includes('<route') ||
        textContent.includes('<alias') ||
        textContent.includes('<template')
      ) {
        // fully
        masterContent += formatContent(routePath, textContent, minify);
        logger.success(`Copy: ${routePath}`);
        continue;
      } else if (textContent.includes('<script') || textContent.includes('<view')) {
        // partially
        masterContent += formatRoute(routePath, path, textContent, minify);
        logger.success(`Copy: ${routePath} -> ${path}`);
        continue;
      }
    }

    const isBinary = isBinaryFile(content);
    const formattedContent = isBinary ? content.toString('base64') : content.toString().trim();

    masterContent += formatRaw(routePath, path, formattedContent, isBinary, minify);
    logger.success(`Copy: ${routePath} -> ${path}`);
  }

  return masterContent;
}
