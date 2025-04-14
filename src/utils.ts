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

function isHtml(path: string, content: string) {
  return (
    path.endsWith('.html') ||
    path.endsWith('.htm') ||
    content?.includes('<html>') ||
    content?.includes('<head>') ||
    content?.includes('<body>')
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
