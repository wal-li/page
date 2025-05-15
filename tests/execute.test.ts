import { execute } from '../src/execute';
import * as navigateModule from '../src/navigate';

jest.mock('../src/navigate', () => ({
  navigate: jest.fn(),
}));

describe('execute', () => {
  it('should parse ROUTE and TEMPLATE nodes and call navigate', async () => {
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
    const navigateMock = navigateModule.navigate as jest.Mock;
    navigateMock.mockResolvedValue(mockResponse);

    const result = await execute(html, { path: '/home' });

    expect(navigateMock).toHaveBeenCalledTimes(1);
    const [routes, context, lookupTemplate] = navigateMock.mock.calls[0];

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
