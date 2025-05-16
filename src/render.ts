import { parse as parseHTML } from 'node-html-parser';
import { Context, ExternalCopy, Isolate, Reference } from 'isolated-vm';
import { renderAST, tokenize, tokensToAST } from './template';
import { request } from './utils';

type RenderOptions = {
  timeout: number;
  lookup?: Function;
};

const BUILTIN_SYNC_FUNCTIONS = {
  dump(data: any, formatted = false) {
    return formatted ? JSON.stringify(data, null, 2) : JSON.stringify(data);
  },
};

const BUILTIN_ASYNC_FUNCTIONS = {
  request,
};

// @todo: try promise in TransferOptions
async function runAsync(context: Context, code: string, timeout: number): Promise<any> {
  const jail = context.global;

  // Generate unique response handler IDs
  const id = jail.getSync('_async_id') ?? 0;
  jail.setSync('_async_id', id + 1);

  const resolveMethod = `_resolve_${id}`;
  const rejectMethod = `_reject_${id}`;
  const wrappedCode = `(async () => { ${code} })().then(${resolveMethod}).catch(${rejectMethod});`;

  return new Promise((resolve, reject) => {
    jail.setSync(resolveMethod, resolve);
    jail.setSync(rejectMethod, reject);

    try {
      context.evalSync(wrappedCode, { timeout });
    } catch (err) {
      reject(err);
    }
  });
}

function parseLocationFromMessage(msg: string): { line: number; column: number } | null {
  const match = msg.match(/\[(?:<isolated-vm>)?:(\d+):(\d+)\]/);
  if (match) {
    return {
      line: parseInt(match[1], 10),
      column: parseInt(match[2], 10),
    };
  }
  return null;
}

function highlightCodeAtLocation(code: string, line: number, column: number): string {
  const lines = code.split('\n');
  const targetLine = lines[line - 1] ?? '';
  const pointer = ' '.repeat(column - 1) + '^';
  return `Error at line ${line}, column ${column}:\n${targetLine}\n${pointer}`;
}

function throwWithCustomStack(message: string, filename: string, line: number, column: number, code?: string): never {
  const err = new Error(message);
  err.stack = `${err.name}: ${err.message}\n    at ${filename}:${line}:${column}`;
  if (code) {
    err.stack += `\n\n` + highlightCodeAtLocation(code, line, column);
  }
  throw err;
}

export async function render(
  script: string = '',
  view: string = '',
  context: Record<string, any> = {},
  options: RenderOptions = { timeout: 10000 },
) {
  const vm = new Isolate({ memoryLimit: 8 });
  const vmContext = vm.createContextSync();
  const jail = vmContext.global;

  try {
    // Initialize VM context
    jail.setSync('exports', new ExternalCopy({}).copyInto());
    let initScript = '';

    // sync fn
    Object.entries(BUILTIN_SYNC_FUNCTIONS).forEach(([name, func]) => {
      jail.setSync(name, func);
    });

    // async fn
    Object.entries(BUILTIN_ASYNC_FUNCTIONS).forEach(([name, func]) => {
      jail.setSync(`_builtin_${name}`, new Reference(func));
      initScript += `const ${name} = (...args) => _builtin_${name}.apply(undefined, args, { arguments: { copy: true }, result: { promise: true, copy: true } });`;
    });
    jail.setSync('context', new ExternalCopy(context).copyInto());

    // init script
    vmContext.evalSync(initScript);

    // Execute script if present
    if (script) {
      try {
        vmContext.evalSync(script);
      } catch (e: any) {
        const loc = parseLocationFromMessage(e.message);
        if (loc) {
          throwWithCustomStack(e.message, '<script>', loc.line, loc.column, script);
        } else {
          throw e; // fallback
        }
      }
    }

    // Execute handler function
    const result = await runAsync(
      vmContext,
      `return exports.handler ? await exports.handler(${JSON.stringify(context)}) : undefined;`,
      options.timeout,
    );

    if (!view) {
      return { script: result };
    }

    // Render view content
    jail.setSync('result', new ExternalCopy(result).copyInto());
    const tokens = tokenize(view);
    const tree = tokensToAST(tokens);
    const renderedContent = renderAST(tree, (expr: string, ctx: any) => {
      const localCtx = Object.entries(ctx)
        .map(([key, value]) => `const ${key} = ${JSON.stringify(value)};`)
        .join('\n');
      return vmContext.evalSync(`(() => { ${localCtx} return ${expr}; })()`, { copy: true });
    });

    // exports
    const transferableExports = vmContext.evalSync(`(() => ({ layout: exports.layout }))()`, { copy: true });

    return { ...transferableExports, script: result, view: renderedContent };
  } catch (err) {
    throw err;
  } finally {
    vm.dispose();
  }
}

export async function renderContent(
  content: string = '',
  context: Record<string, any> = {},
  options: RenderOptions = { timeout: 10000 },
) {
  const root = parseHTML(content);
  const sources: Record<string, string> = {};

  // Extract script and view sources
  for (const node of root.childNodes as any) {
    if (['SCRIPT', 'VIEW'].includes(node.tagName)) {
      sources[node.tagName.toLowerCase()] = node.innerHTML.trim();
    }
  }

  return render(sources.script, sources.view, context, options);
}
