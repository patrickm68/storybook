import type { StoriesHash } from '@storybook/api';
import { collapseAllStories } from '../data';

type Item = StoriesHash[keyof StoriesHash];

const root: Item = {
  type: 'root',
  id: 'root',
  name: 'root',
  depth: 0,
  children: ['a', 'b'],
};
const a: Item = {
  type: 'component',
  id: 'a',
  name: 'a',
  depth: 1,
  parent: 'root',
  children: ['a1'],
};
const a1: Item = {
  type: 'story',
  id: 'a1',
  name: 'a1',
  title: 'a',
  depth: 2,
  parent: 'a',
  args: {},
  prepared: true,
  importPath: './a.js',
};
const b: Item = {
  type: 'component',
  id: 'b',
  name: 'b',
  depth: 1,
  parent: 'root',
  children: ['b1', 'b2'],
};
const b1: Item = {
  type: 'story',
  id: 'b1',
  name: 'b1',
  title: 'b',
  depth: 2,
  parent: 'b',
  args: {},
  prepared: true,
  importPath: './b1.js',
};
const b2: Item = {
  type: 'story',
  id: 'b2',
  name: 'b2',
  title: 'b',
  depth: 2,
  parent: 'b',
  args: {},
  prepared: true,
  importPath: './b2.js',
};

const stories: StoriesHash = { root, a, a1, b, b1, b2 };

describe('collapse all stories', () => {
  it('collapses normal stories', () => {
    const collapsed = collapseAllStories(stories);

    const expected: StoriesHash = {
      a1: {
        type: 'story',
        id: 'a1',
        depth: 1,
        name: 'a',
        title: 'a',
        parent: 'root',
        args: {},
        prepared: true,
        importPath: './a.js',
      },
      b1: {
        type: 'story',
        id: 'b1',
        depth: 1,
        name: 'b',
        title: 'b',
        parent: 'root',
        args: {},
        prepared: true,
        importPath: './b1.js',
      },
      root: {
        type: 'root',
        id: 'root',
        name: 'root',
        depth: 0,
        children: ['a1', 'b1'],
      },
    };

    expect(collapsed).toEqual(expected);
  });

  it('collapses docs-only stories', () => {
    const hasDocsOnly: StoriesHash = {
      ...stories,
      a1: {
        type: 'docs',
        id: 'a1',
        name: 'a1',
        title: 'a',
        depth: 2,
        parent: 'a',
        importPath: './a.js',
      },
    };

    const collapsed = collapseAllStories(hasDocsOnly);

    expect(collapsed.a1).toEqual({
      type: 'docs',
      id: 'a1',
      name: 'a',
      title: 'a',
      depth: 1,
      parent: 'root',
      importPath: './a.js',
    });
  });
});
