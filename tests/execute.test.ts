import { Response } from '@wal-li/core';
import { execute } from '../src/execute';
import * as navigateModule from '../src/navigate';

// jest.mock('../src/navigate', () => ({
//   navigate: jest.fn(),
// }));

describe('execute', () => {
  it('should process empty', async () => {
    const res = await execute();
    expect(res).toEqual(new Response(404, 'Not Found', { 'Content-Type': 'text/plain' }));
  });

  it('should basic process', async () => {
    const content = `
      <template name="main-layout">
        <script>exports.handler = () => 'layout-handler'; </script>
        <view>layout-view,<%= result %>,<%- context.child.view %></view>
      </template>

      <route path="/home" layout="main-layout">
        <script>exports.layout = 'main-layout';</script>
        <view>home-view</view>
      </route>
    `;

    expect(await execute(content, { path: '/home' })).toEqual(
      new Response(200, `layout-view,layout-handler,home-view`, { 'Content-Type': 'text/plain' }),
    );
  });

  it('should child not found', async () => {
    const content = `
    <template name="main-layout">
      <script>exports.handler = () => context.child.script;</script>
      <view>Layout: <%- context.child.view %></view>
    </template>

    <route path="/home" layout="main-layout">
      <script>exports.layout = 'main-layout'; exports.handler = () => ({ status: 404 })</script>
      <view>Page Not Found</view>
    </route>
  `;

    expect(await execute(content, { path: '/home' })).toEqual(
      new Response(404, `Layout: Page Not Found`, { 'Content-Type': 'text/plain' }),
    );
  });

  it('should partial form', async () => {
    const content = `
      <script>const title = 'main';</script>
      <view><%= title %>-view</view>
    `;

    expect(await execute(content, { path: '/' })).toEqual(
      new Response(200, `main-view`, { 'Content-Type': 'text/plain' }),
    );
  });
});
