import { isObject, runScript } from '@wal-li/core';
import { Liquid } from 'liquidjs';

const engine = new Liquid();

async function render(type: 'wlp' | 'js', content: string, context?: any, cssHandler?: Function): Promise<any> {
  let script: string = '';
  let html: string = '';
  let css: string = '';
  let result: any = undefined;

  if (type === 'wlp') {
    // Regular expression to match <script setup> tags and their content
    const scriptSetupRegex = /<script[^>]*\bsetup\b[^>]*>[\s\S]*?<\/script>/gi;

    // Extract script setup content
    script = (content.match(scriptSetupRegex) || [])
      .map((tag) => tag.replace(/<script[^>]*>|<\/script>/g, '').trim())
      .join('\n\n');

    // Remove script setup tag from HTML
    html = content.replace(scriptSetupRegex, '').trim();

    // Regular expression to match <style tailwindcss> tags and their content
    const cssSetupRegex = /<style[^>]*\btailwindcss\b[^>]*>[\s\S]*?<\/style>/gi;

    // Extract style setup content
    css = (content.match(cssSetupRegex) || [])
      .map((tag) => tag.replace(/<style[^>]*>|<\/style>/g, '').trim())
      .join('\n\n');

    // Remove style setup tag from HTML
    html = content.replace(scriptSetupRegex, '').trim();
  }
  // type === 'js'
  else {
    script = content;
    content = '';
  }

  if (script) {
    result = await runScript(script, context);
  }

  if (css && cssHandler) {
    css = cssHandler(css);
  }

  if (html) {
    result = await engine.parseAndRender(html, {
      ...(isObject(context) && Object.keys(context).length ? context : { context }),
      ...(isObject(result) && Object.keys(result).length ? result : { result }),
    });
  }

  return result || html || content;
}

export { render };
