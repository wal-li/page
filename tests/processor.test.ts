import { processor } from '../src/processor';
import * as routerModule from '../src/router';

jest.mock('../src/router', () => ({
  router: jest.fn(),
}));

describe('processor', () => {
  it('should parse ROUTE and TEMPLATE nodes and call router', async () => {
    const html = `
      <template name="main-layout">
        <script>layout script</script>
        <view>layout view</view>
      </template>

      <route path="/home" layout="main-layout">
        <script>home script</script>
        <view>home view</view>
      </route>
    `;

    const mockResponse = { html: '<wrapped>page</wrapped>' };
    const routerMock = routerModule.router as jest.Mock;
    routerMock.mockResolvedValue(mockResponse);

    const result = await processor(html, { path: '/home' });

    expect(routerMock).toHaveBeenCalledTimes(1);
    const [routes, context, lookupTemplate] = routerMock.mock.calls[0];

    // Check routes
    expect(routes).toEqual([
      {
        path: '/home',
        layout: 'main-layout',
        script: { content: 'home script' },
        view: { content: 'home view' },
      },
    ]);

    // Check template lookup works
    const template = await lookupTemplate('main-layout');
    expect(template).toEqual({
      name: 'main-layout',
      script: { content: 'layout script' },
      view: { content: 'layout view' },
    });

    // Final result
    expect(result).toEqual(mockResponse);
  });
});
