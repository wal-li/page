import { render } from '../src/render';

describe('render function', () => {
  it('should return the original content if type is neither wlp nor js', async () => {
    const result = await render('js', 'exports.handler = () => { return { foo: "bar" } }');
    expect(result).toEqual({ foo: 'bar' });
  });

  it('should process WLP type and extract script setup', async () => {
    const content = `<script setup>const a = 1;</script><p>Hello, {{ foo }}!</p>`;
    const context = { foo: 'bar' };
    const result = await render('wlp', content, context);

    expect(result).toBe('<p>Hello, bar!</p>');
  });

  it('should process WLP without context', async () => {
    const content = `<script setup>exports.handler = () => { return { foo: "bar" }; }</script><p>Hello, {{ foo }}!</p>`;
    const result = await render('wlp', content);

    expect(result).toBe('<p>Hello, bar!</p>');
  });

  it('should process WLP type and handle multiple script setup tags', async () => {
    const content = `<script setup>const a = 1;</script><script setup>const b = 2;exports.handler = () => { return a + b; }</script><p>Hello, {{ result }}!</p>`;
    const result = await render('wlp', content, {});

    expect(result).toBe('<p>Hello, 3!</p>');
  });

  it('should remove script setup and return template even if script execution is empty', async () => {
    const content = `<script setup></script><p>Hello</p>`;
    const result = await render('wlp', content, {});

    expect(result).toBe('<p>Hello</p>');
  });

  it('should return template if script is absent', async () => {
    const content = `<p>Hello</p>`;
    const result = await render('wlp', content, {});

    expect(result).toBe('<p>Hello</p>');
  });
});
