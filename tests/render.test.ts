import { renderContent } from '../src/render';

const SIMPLE_CONTENT = `
<script>
/**
 * global:
 * - context
 * - dump
 * - exports
 * - result (after run handler)
 */

exports.handler = async (context) => {
  return {
    greet: context.title ?? 'Foo',
  };
} // -> result
</script>

<view>
  Hello, <%= result.greet %>
</view>
`;

const COMPLEX_CONTENT = `
<script>
function year() {
  return new Date('01-01-2025').getFullYear();
}

const blog = {
  title: 'Tech & Coffee',
  featured: true,
  posts: [
    {
      title: 'Introducing TypeScript',
      author: 'Alice',
      tags: ['typescript', 'javascript', 'coding'],
      content: '<p>TypeScript is a typed superset of JavaScript that compiles to plain JavaScript.</p>',
      comments: [
        {
          user: 'Bob',
          text: 'Great introduction!',
          likes: 2,
        },
        {
          user: 'Charlie',
          text: 'Thanks for sharing!',
          likes: 0,
        },
      ],
    },
    {
      title: 'Understanding Async/Await',
      author: 'Dave',
      tags: [],
      content: '<p>Async/Await makes writing asynchronous code easier and more readable.</p>',
      comments: [],
    },
  ]
};

const footerLinks = [
  { url: '/about', label: 'About Us' },
  { url: '/contact', label: 'Contact' },
  { url: '/rss', label: 'RSS Feed' },
];
</script>

<view>
  <h1><%= blog.title %></h1>

  <% if blog.featured %>
    <div class="featured">🌟 Featured Blog</div>
  <% endif %>

  <% for post in blog.posts %>
    <article>
      <h2><%= post.title %></h2>
      <p><strong>Author:</strong> <%= post.author %></p>

      <% if post.tags.length > 0 %>
        <div class="tags">
          <% for index, tag in post.tags %>
            <span class="tag"><%= tag %></span>
          <% endfor %>
        </div>
      <% else %>
        <p><em>No tags available</em></p>
      <% endif %>

      <div class="content">
        <%- post.content %>
      </div>

      <% if post.comments.length > 0 %>
        <div class="comments">
          <h3>Comments:</h3>
          <ul>
            <% for j, comment in post.comments %>
              <li>
                <strong><%= comment.user %></strong>: <%= comment.text %>
                <% if comment.likes > 0 %>
                  <span class="likes">❤️ <%= comment.likes %></span>
                <% endif %>
              </li>
            <% endfor %>
          </ul>
        </div>
      <% else %>
        <p>No comments yet.</p>
      <% endif %>
    </article>
  <% endfor %>

  <footer>
    <h4>Navigation</h4>
    <ul>
      <% for item in footerLinks %>
        <li><a href="<%= item.url %>"><%= item.label %></a></li>
      <% endfor %>
    </ul>
    <p><%= year() %></p>
  </footer>
</view>
`;

describe('render test', () => {
  it('should simple render', async () => {
    expect(await renderContent(SIMPLE_CONTENT)).toEqual({ script: { greet: 'Foo' }, view: 'Hello, Foo' });
    expect(await renderContent(SIMPLE_CONTENT, { title: 'Bar' })).toEqual({
      script: { greet: 'Bar' },
      view: 'Hello, Bar',
    });
  });

  it('should complex render', async () => {
    const { view } = await renderContent(COMPLEX_CONTENT);

    expect(view).toContain('<h1>Tech &amp; Coffee</h1>');
    expect(view).toContain('<p>2025</p>');
  });

  it('should render empty', async () => {
    expect(await renderContent('')).toEqual({});
  });

  it('should render js only', async () => {
    expect(await renderContent('<script>const a = 1; exports.handler = () => a;</script>')).toEqual({ script: 1 });
  });

  it('should render view only', async () => {
    expect(await renderContent('<view>Flowers</view>')).toEqual({ view: 'Flowers' });
  });

  it('should handle undefined exports.handler gracefully', async () => {
    const content = `<script>const x = 1;</script><view>Test<%= result %></view>`;
    expect(await renderContent(content)).toEqual({ view: 'Testundefined' });
  });

  it('should allow inline expressions in view', async () => {
    const content = `
      <script>
        exports.handler = () => ({ name: 'World' });
      </script>
      <view>Hello, <%= result.name %></view>
    `;
    const { view } = await renderContent(content);
    expect(view).toBe('Hello, World');
  });

  it('should throw error for invalid or unexpected token in unsafe HTML content', async () => {
    const content = `
      <script>
        exports.handler = () => ({ unsafe: '<script>alert("xss")</script>' });
      </script>
      <view>Output: <%= result.unsafe %></view>
    `;
    await expect(renderContent(content)).rejects.toThrow('Invalid or unexpected token [<isolated-vm>:1:36]');
  });

  it('should escape HTML content and prevent XSS', async () => {
    const content = `
      <script>
        exports.handler = () => ({ unsafe: '<logic>alert("xss")</logic>' });
      </script>
      <view><%= result.unsafe %></view>
    `;

    const rendered = await renderContent(content);

    // Check if the script tag is escaped
    expect(rendered.view).toContain('&lt;logic&gt;alert(&quot;xss&quot;)&lt;/logic&gt;');
    expect(rendered.view).not.toContain('<logic>alert("xss")</logic>');
  });

  it('should output raw HTML with <%- %>', async () => {
    const content = `
      <script>
        exports.handler = () => ({ html: '<b>bold</b>' });
      </script>
      <view>Output: <%- result.html %></view>
    `;
    const { view } = await renderContent(content);
    expect(view).toBe('Output: <b>bold</b>');
  });

  it('should handle nested conditionals', async () => {
    const content = `
      <script>
        exports.handler = () => ({ user: { admin: true, name: 'Admin' } });
      </script>
      <view>
        <% if result.user %>
          <% if result.user.admin %>
            Welcome, <%= result.user.name %>!
          <% endif %>
        <% endif %>
      </view>
    `;
    const { view } = await renderContent(content);
    expect(view).toContain('Welcome, Admin!');
  });

  it('should skip block when condition is false', async () => {
    const content = `
      <script>
        exports.handler = () => ({ show: false });
      </script>
      <view>
        <% if result.show %>
          You should not see this
        <% endif %>
        Done.
      </view>
    `;
    const { view } = await renderContent(content);
    expect(view).not.toContain('You should not see this');
    expect(view).toContain('Done.');
  });

  it('should iterate over array using for loop', async () => {
    const content = `
      <script>
        exports.handler = () => ({ items: ['A', 'B', 'C'] });
      </script>
      <view>
        <ul>
          <% for i, item in result.items %>
            <li><%= item %></li>
          <% endfor %>
        </ul>
      </view>
    `;
    const { view } = await renderContent(content);
    expect(view).toContain('<li>A</li>');
    expect(view).toContain('<li>B</li>');
    expect(view).toContain('<li>C</li>');
  });

  it('should handle empty loop without error', async () => {
    const content = `
      <script>
        exports.handler = () => ({ items: [] });
      </script>
      <view>
        <ul>
          <% for i, item in result.items %>
            <li><%= item %></li>
          <% endfor %>
        </ul>
      </view>
    `;
    const { view } = await renderContent(content);
    expect(view).toContain('<ul>');
    expect(view).not.toContain('<li>');
  });

  it('should support multiple variables in context', async () => {
    const content = `
      <script>
        exports.handler = (context) => {
          return { message: \`\${context.prefix} World\` };
        };
      </script>
      <view><%= result.message %></view>
    `;
    const context = { prefix: 'Hello' };
    const { view } = await renderContent(content, context);
    expect(view).toBe('Hello World');
  });
});
