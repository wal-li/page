import { render } from '../src/render';

describe('render function', () => {
  it('should return the original content if type is neither wlp nor js', async () => {
    const result = await render(
      '<script>exports.handler = () => { return { foo: "bar" } }</script><template>{{result | json}}</template>',
    );
    expect(result).toEqual('{"foo":"bar"}');
  });

  it('should process WLP type and extract script setup', async () => {
    const content = `<script>const a = 1;</script><template><p>Hello, {{ foo }}!</p><template>`;
    const context = { foo: 'bar' };
    const result = await render(content, context);

    expect(result).toBe('<p>Hello, bar!</p>');
  });

  it('should process WLP without context', async () => {
    const content = `<script>exports.handler = () => { return { foo: "bar" }; }</script><template><p>Hello, {{ foo }}!</p></template>`;
    const result = await render(content);

    expect(result).toBe('<p>Hello, bar!</p>');
  });

  it('should process WLP type and handle multiple script setup tags', async () => {
    const content = `<script path="/foo">const b = 2;exports.handler = () => { return b + 1; }</script><template path="/foo"><p>Hello, {{ result }}!</p></template>`;
    const result = await render(content, { path: '/foo' });

    expect(result).toBe('<p>Hello, 3!</p>');
  });

  it('should remove script setup and return template even if script execution is empty', async () => {
    const content = `<script></script><template><p>Hello</p></template>`;
    const result = await render(content, {});

    expect(result).toBe('<p>Hello</p>');
  });

  it('should return template if script is absent', async () => {
    const content = `<template><p>Hello</p><template>`;
    const result = await render(content, {});

    expect(result).toBe('<p>Hello</p>');
  });
});
