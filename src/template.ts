type Token =
  | { type: 'text'; value: string }
  | { type: 'output'; value: string; raw: boolean }
  | { type: 'if'; condition: string }
  | { type: 'else' }
  | { type: 'endif' }
  | { type: 'for'; key?: string; value?: string; iterable: string }
  | { type: 'endfor' };

interface ASTNode {
  type: string;
  value?: string;
  key?: string;
  iterable?: string;
  condition?: string;
  body?: ASTNode[];
  alternate?: ASTNode[];
  raw?: boolean;
}

export function tokenize(template: string): Token[] {
  const regex = /<%[\-=]?[\s\S]*?%>/g;
  const tokens: Token[] = [];
  let lastIndex = 0;

  for (const match of template.matchAll(regex)) {
    const index = match.index!;
    const raw = match[0];

    if (index > lastIndex) {
      tokens.push({ type: 'text', value: template.slice(lastIndex, index) });
    }

    const tagContent = raw.slice(2, -2).trim();

    try {
      if (raw.startsWith('<%=')) {
        tokens.push({ type: 'output', value: tagContent.slice(1).trim(), raw: false });
      } else if (raw.startsWith('<%-')) {
        tokens.push({ type: 'output', value: tagContent.slice(1).trim(), raw: true });
      } else if (tagContent.startsWith('if ')) {
        tokens.push({ type: 'if', condition: tagContent.slice(3).trim() });
      } else if (tagContent === 'else') {
        tokens.push({ type: 'else' });
      } else if (tagContent === 'endif') {
        tokens.push({ type: 'endif' });
      } else if (tagContent === 'endfor') {
        tokens.push({ type: 'endfor' });
      } else if (tagContent.startsWith('for ')) {
        const content = tagContent.slice(4).trim();
        let match = content.match(/^\s*([^\s]+)\s*,\s*([^\s]+)\s+in\s+(.+)$/); // Matches key, value
        let key: string | undefined, value: string | undefined, iterable: string;

        if (match) {
          [, key, value, iterable] = match;
          tokens.push({ type: 'for', key, value, iterable });
        } else {
          match = content.match(/^\s*([^\s]+)\s+in\s+(.+)$/); // Matches value only
          if (match) {
            [, value, iterable] = match;
            tokens.push({ type: 'for', key: undefined, value, iterable });
          } else {
            throw new Error(`Invalid for loop syntax: <% ${tagContent} %>`);
          }
        }
      } else {
        throw new Error(`Unknown tag: <% ${tagContent} %>`);
      }
    } catch (err) {
      throw new Error(`Tokenization Error: ${(err as Error).message} at <% ${tagContent} %>`);
    }

    lastIndex = index + raw.length;
  }

  if (lastIndex < template.length) {
    tokens.push({ type: 'text', value: template.slice(lastIndex) });
  }

  return tokens;
}

export function tokensToString(tokens: Token[]): string {
  let result = '';

  tokens.forEach((token) => {
    switch (token.type) {
      case 'text':
        result += token.value;
        break;

      case 'output':
        if (token.raw) {
          result += `<%- ${token.value} %>`;
        } else {
          result += `<%= ${token.value} %>`;
        }
        break;

      case 'if':
        result += `<% if ${token.condition} %>`;
        break;

      case 'else':
        result += `<% else %>`;
        break;

      case 'endif':
        result += `<% endif %>`;
        break;

      case 'for':
        if (token.key && token.value) {
          result += `<% for ${token.key}, ${token.value} in ${token.iterable} %>`;
        } else if (token.value) {
          result += `<% for ${token.value} in ${token.iterable} %>`;
        }
        break;

      case 'endfor':
        result += `<% endfor %>`;
        break;

      default:
        throw new Error(`Unknown token type: ${(token as Token).type}`);
    }
  });

  return result;
}

export function tokensToAST(tokens: Token[]): ASTNode[] {
  const stack: ASTNode[] = [];
  const root: ASTNode[] = [];

  const pushToParent = (node: ASTNode) => {
    const parentBody = stack[stack.length - 1]?.body || root; // Get the current parent (top of stack or root)
    parentBody.push(node);
  };

  tokens.forEach((token) => {
    switch (token.type) {
      case 'text':
        pushToParent({ type: 'TextNode', value: token.value });
        break;

      case 'output':
        pushToParent({ type: 'OutputNode', value: token.value, raw: token.raw });
        break;

      case 'if':
        // Create an IfNode and push to stack
        const ifNode: ASTNode = {
          type: 'IfNode',
          condition: token.condition,
          body: [],
        };
        stack.push(ifNode);
        break;

      case 'else':
        // Handle 'else' by adding to the body of the previous 'if' node
        const elseNode: ASTNode = {
          type: 'ElseNode',
          body: [],
        };
        if (stack[stack.length - 1]?.type === 'IfNode') {
          const parentIfNode = stack[stack.length - 1];
          parentIfNode.alternate = elseNode.body; // Link the 'else' to the 'if'
          stack.push(elseNode);
        } else {
          throw new Error("Else block without matching 'if' block");
        }
        break;

      case 'endif':
        // End the 'if' block
        let ifNodeToClose = stack.pop();

        // Skip else node
        if (ifNodeToClose?.type === 'ElseNode') ifNodeToClose = stack.pop();

        if (ifNodeToClose?.type === 'IfNode') {
          pushToParent(ifNodeToClose); // Add to the parent (root or previous block)
        } else {
          throw new Error("Mismatched 'endif' without matching 'if'");
        }
        break;

      case 'for':
        // Start a 'for' loop
        const forNode: ASTNode = {
          type: 'ForNode',
          key: token.key,
          value: token.value,
          iterable: token.iterable,
          body: [],
        };
        stack.push(forNode);
        break;

      case 'endfor':
        // End the 'for' loop
        const forNodeToClose = stack.pop();
        if (forNodeToClose?.type === 'ForNode') {
          pushToParent(forNodeToClose); // Add to the parent (root or previous block)
        } else {
          throw new Error("Mismatched 'endfor' without matching 'for'");
        }
        break;

      default:
        throw new Error(`Unknown token type: ${(token as Token).type}`);
    }
  });

  // After parsing, check if the stack is empty
  if (stack.length > 0) {
    throw new Error('Parsing error: there are unclosed blocks');
  }

  return root;
}

export function evalInContext(expr: string, context: any): any {
  return Function(...Object.keys(context), `return ${expr}`)(...Object.values(context));
}

function escapeHtml(str: string): string {
  return str
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

export function renderAST(ast: ASTNode[], evalInContext: Function, context: Record<string, any> = {}): string {
  let output = '';

  const renderNode = (node: ASTNode): string => {
    switch (node.type) {
      case 'TextNode':
        return node.value as string;

      case 'OutputNode':
        const result = evalInContext(node.value || '', context);
        return node.raw ? String(result) : escapeHtml(String(result));

      case 'IfNode': {
        const conditionValue = evalInContext(node.condition || 'false', context);
        const branch = conditionValue ? node.body : node.alternate;
        return renderAST(branch || [], evalInContext, context);
      }

      case 'ForNode': {
        const iterable = evalInContext(node.iterable || '', context);
        if (!iterable || typeof iterable !== 'object') return '';

        const parts: string[] = [];

        if (Array.isArray(iterable)) {
          iterable.forEach((item, index) => {
            const loopContext = {
              ...context,
              [String(node.key)]: index,
              ...(node.value ? { [node.value]: item } : { [String(node.key)]: item }),
            };
            parts.push(renderAST(node.body || [], evalInContext, loopContext));
          });
        } else {
          Object.entries(iterable).forEach(([key, val]) => {
            const loopContext = {
              ...context,
              [String(node.key)]: key,
              ...(node.value ? { [node.value]: val } : { [String(node.key)]: val }),
            };
            parts.push(renderAST(node.body || [], evalInContext, loopContext));
          });
        }

        return parts.join('');
      }

      default:
        throw new Error(`Unknown node type: ${(node as any).type}`);
    }
  };

  for (const node of ast) {
    output += renderNode(node);
  }

  return output;
}
