import { Dirent, readdirSync } from 'fs';
import { join } from 'path';

export function deepScan(dir: string, root = '.'): string[] {
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

export function isHtml(path: string, content: string) {
  return (
    path.toLowerCase().endsWith('.html') ||
    path.toLowerCase().endsWith('.htm') ||
    content?.match(/\<html\>/i) ||
    content?.match(/\<head\>/i) ||
    content?.match(/\<body\>/i)
  );
}

export function isCSS(path: string, content: string) {
  return (
    path.toLowerCase().endsWith('.css') ||
    (content?.match(/\{/i) &&
      content?.match(/\}/i) &&
      (content?.match(/color\:/i) ||
        content?.match(/font\-size\:/i) ||
        content?.match(/margin\:/i) ||
        content?.match(/padding\:/i)))
  );
}

export function isJS(path: string, content: string) {
  return (
    path.toLowerCase().endsWith('.js') ||
    content?.match(/function/i) ||
    content?.match(/const/i) ||
    content?.match(/let/i) ||
    content?.match(/var/i) ||
    content?.match(/\=\>/i) ||
    content?.match(/import/i) ||
    content?.match(/export/i)
  );
}

export function injectHotReload(path: string, content: any) {
  if (content instanceof Buffer) return content;
  if (!isHtml(path, content)) return content;

  return content?.replace(
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

export function isBinaryFile(buffer: Buffer): boolean {
  const len = Math.min(buffer.length, 512);
  for (let i = 0; i < len; i++) {
    const charCode = buffer[i];

    if (charCode === 0) {
      return true;
    }

    // Allow common control characters: \t (9), \n (10), \r (13), etc.
    // Also allow all bytes >= 32 (printable ASCII and UTF-8 multibyte starts)
    if (charCode < 7 || (charCode > 14 && charCode < 32)) {
      return true;
    }
  }
  return false;
}

type RequestOptions = {
  method?: 'get' | 'post' | 'put' | 'patch' | 'delete';
  headers?: Record<string, string>;
  params?: Record<string, any>;
  responseType?: 'json' | 'text' | 'buffer';
  body?: any;
};

export async function request(url: string, options: RequestOptions = {}) {
  const u = new URL(url);

  if (options.params) {
    for (const [key, value] of Object.entries(options.params)) {
      if (value === null || value === undefined) {
        u.searchParams.delete(key); // Remove param if value is null/undefined
      } else {
        u.searchParams.set(key, value); // Set/update param
      }
    }
  }

  options.responseType ??= 'json';

  let reqBody, contentType;

  if (options.body && typeof options.body === 'object') {
    reqBody = JSON.stringify(options.body);
    contentType = 'application/json';
  } else if (options.body && typeof options.body === 'string') {
    reqBody = options.body;
    contentType = 'application/x-www-form-urlencoded';
  }

  const res = await fetch(u, {
    method: options.method || 'get',
    headers: {
      ...(options.responseType === 'json' ? { Accept: 'application/json' } : {}),
      ...(contentType ? { 'Content-Type': contentType } : {}),
      ...(options.headers || {}),
    },
    ...(reqBody ? { body: reqBody } : {}),
  });

  const headers = Object.fromEntries(res.headers.entries());

  return {
    status: res.status,
    statusText: res.statusText,
    headers,
    bodyUsed: false,
    body:
      options.responseType === 'json'
        ? await res.json()
        : options.responseType === 'text'
        ? await res.text()
        : await res.arrayBuffer(),
    ok: res.ok,
    redirected: res.redirected,
    type: res.type,
    url: res.url,
  };
}
