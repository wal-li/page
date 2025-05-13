import { evalInContext, renderAST, tokenize, tokensToAST, tokensToString } from '../src/template';

const TEMPLATE = `<h1><%= blog.title %></h1>

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
    <% for item in blog.footerLinks %>
      <li><a href="<%= item.url %>"><%= item.label %></a></li>
    <% endfor %>
  </ul>
</footer>
`;

const CONTEXT = {
  blog: {
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
    ],
    footerLinks: [
      { url: '/about', label: 'About Us' },
      { url: '/contact', label: 'Contact' },
      { url: '/rss', label: 'RSS Feed' },
    ],
  },
};

describe('utils test', () => {
  let tokens, tree;

  it('should tokenize', async () => {
    tokens = tokenize(TEMPLATE);

    expect(tokens[0]).toEqual({ type: 'text', value: '<h1>' });
    expect(tokens).toHaveProperty('length', 57);

    expect(tokensToString(tokens)).toEqual(TEMPLATE);
  });

  it('should tokens -> AST', async () => {
    tree = tokensToAST(tokens);
    expect(tree[0]).toEqual({ type: 'TextNode', value: '<h1>' });
    expect(tree).toHaveProperty('length', 9);
  });

  it('should render AST', async () => {
    const content = renderAST(tree, evalInContext, CONTEXT);
    expect(content).toContain('<h1>Tech &amp; Coffee</h1>');
  });
});
