import { router } from '../src/router';
import { render } from '../src/render';
import { Response } from '@wal-li/core';

jest.mock('../src/render');

// Mock implementation
const mockRender = render as jest.Mock;

function shuffle<T>(array: T[]): T[] {
  return array
    .map((a) => ({ sort: Math.random(), value: a }))
    .sort((a, b) => a.sort - b.sort)
    .map((a) => a.value);
}

describe('router', () => {
  afterEach(() => {
    jest.clearAllMocks();
  });

  it('should return undefined if no route matches', async () => {
    const routes = [{ path: '/test' }];
    const context = { path: '/no-match' };

    const result = await router(routes, context);
    expect(result).toBeUndefined();
  });

  it('should match a basic route and render view + script', async () => {
    const routes = [
      {
        path: '/home',
        script: { content: 'console.log("script")' },
        view: { content: '<html>Home</html>' },
      },
    ];
    const context = { path: '/home' };

    mockRender.mockResolvedValue({
      script: { status: 200, headers: { 'Content-Type': 'text/html' } },
      view: '<html>Rendered</html>',
    });

    const result = await router(routes, context);
    expect(result).toBeInstanceOf(Response);
  });

  it('should return a raw buffer if view is base64 encoded', async () => {
    const encoded = Buffer.from('Hello, world!').toString('base64');
    const routes = [
      {
        path: '/raw',
        view: { content: encoded, format: 'base64' },
      },
    ];
    const context = { path: '/raw' };

    const result = await router(routes, context);
    expect(result).toBeInstanceOf(Buffer);
    expect(result?.toString()).toBe('Hello, world!');
  });

  it('should match a route alias and resolve to actual target route', async () => {
    const routes = [
      { path: '/alias', to: '/real' },
      {
        path: '/real',
        view: { content: '<html>Real</html>' },
        script: { content: 'script' },
      },
    ];

    mockRender.mockResolvedValue({
      script: { status: 200, headers: {} },
      view: '<html>Real</html>',
    });

    const context = { path: '/alias' };
    const result = await router(routes, context);

    expect(result).toBeInstanceOf(Response);
  });

  it('should return undefined if render returns nothing', async () => {
    const routes = [
      {
        path: '/empty',
        script: { content: 'noop' },
        view: { content: '<div></div>' },
      },
    ];
    const context = { path: '/empty' };

    mockRender.mockResolvedValue({}); // simulate empty render
    const result = await router(routes, context);

    expect(result).toBeUndefined();
  });

  it('should return script-only render result when view is missing', async () => {
    const routes = [
      {
        path: '/script-only',
        script: { content: 'only script' },
      },
    ];
    const context = { path: '/script-only' };

    const expectedOutput = { script: { status: 200, headers: {} } };
    mockRender.mockResolvedValue(expectedOutput);

    const result = await router(routes, context);
    expect(result).toEqual(expectedOutput);
  });

  it('should extract dynamic param from route like /[name]', async () => {
    const routes = [
      {
        path: '/[name]',
        script: { content: 'script content' },
        view: { content: '<html>Hello</html>' },
      },
    ];
    const context = { path: '/john' };

    mockRender.mockResolvedValue({
      script: { status: 200, headers: {} },
      view: '<html>Hello John</html>',
    });

    const result = await router(routes, context);

    expect(result).toBeInstanceOf(Response);
    expect(mockRender).toHaveBeenCalledWith(
      'script content',
      '<html>Hello</html>',
      expect.objectContaining({
        params: expect.objectContaining({ name: 'john' }),
      }),
    );
  });

  it('should resolve alias and merge dynamic params', async () => {
    const routes = [
      { path: '/user/[name]', to: '/profile' },
      {
        path: '/profile',
        script: { content: 'script' },
        view: { content: '<html>Profile</html>' },
      },
    ];
    const context = { path: '/user/alice' };

    mockRender.mockResolvedValue({
      script: { status: 200, headers: {} },
      view: '<html>Alice Profile</html>',
    });

    const result = await router(routes, context);

    expect(result).toBeInstanceOf(Response);
    expect(mockRender).toHaveBeenCalledWith(
      'script',
      '<html>Profile</html>',
      expect.objectContaining({
        params: expect.objectContaining({ name: 'alice' }),
      }),
    );
  });

  it('should match the correct route regardless of route array order (priority test)', async () => {
    const routeDefs = [
      { path: '/', view: { content: 'Root Page' }, script: { content: 'root-script' } },
      { path: '/home', view: { content: 'Home Page' }, script: { content: 'home-script' } },
      { path: '/index', view: { content: 'Index Page' }, script: { content: 'index-script' } },
      { path: '/[lang]', view: { content: 'Language Page' }, script: { content: 'lang-script' } },
      { path: '/[lang]/contact', view: { content: 'Contact Page' }, script: { content: 'contact-script' } },
      { path: '/[lang]/index', view: { content: 'Lang Index Page' }, script: { content: 'lang-index-script' } },
      {
        path: '/[category]-[lang]/[post]/',
        view: { content: 'Post Page' },
        script: { content: 'post-script' },
      },
    ];

    const tests = [
      { path: '/', expectedContent: 'Root Page' },
      { path: '/home', expectedContent: 'Home Page' },
      { path: '/index', expectedContent: 'Index Page' },
      { path: '/fr', expectedContent: 'Language Page', params: { lang: 'fr' } },
      { path: '/vi/contact', expectedContent: 'Contact Page', params: { lang: 'vi' } },
      { path: '/vi/index', expectedContent: 'Lang Index Page', params: { lang: 'vi' } },
      {
        path: '/blog-vi/hello-world/',
        expectedContent: 'Post Page',
        params: { category: 'blog', lang: 'vi', post: 'hello-world' },
      },
    ];

    for (const { path, expectedContent, params } of tests) {
      const shuffledRoutes = shuffle(routeDefs);
      const context = { path };

      mockRender.mockResolvedValue({
        script: { status: 200, headers: {} },
        view: expectedContent,
      });

      const result = await router(shuffledRoutes, context);

      expect(result).toBeInstanceOf(Response);
      expect(mockRender).toHaveBeenCalledWith(
        expect.any(String),
        expectedContent,
        expect.objectContaining({ params: params || {} }),
      );
    }
  });

  it('should render main route inside layout', async () => {
    const routes = [
      {
        path: '/home',
        layout: 'main-layout',
        script: { content: 'main-script' },
        view: { content: 'main-view' },
      },
    ];

    const context = { path: '/home' };

    const lookupTemplate = jest.fn(async (name: string) => {
      if (name === 'main-layout') {
        return {
          script: { content: 'layout-script' },
          view: { content: 'layout-view' },
          context: { layoutKey: 'layoutValue' },
        };
      }
      return undefined;
    });

    // mock render behavior
    mockRender.mockImplementation(async (script: string, view: string, ctx: any) => {
      if (script === 'main-script' && view === 'main-view') {
        return { view: '<main>content</main>', script: { status: 200, headers: {} } };
      } else if (script === 'layout-script' && view === 'layout-view') {
        return { view: `<html>${ctx.child.view}</html>`, script: { status: 200, headers: {} } };
      }
    });

    const result = await router(routes, context, lookupTemplate);

    expect(mockRender).toHaveBeenCalledTimes(2);

    // Final render should include main view inside layout
    expect(result).toBeInstanceOf(Response);

    const resBody = (result as Response).body;
    expect(resBody).toBe('<html><main>content</main></html>');
  });
});
