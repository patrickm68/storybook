import React from 'react';

import { Preview, DocsContextProps } from '@storybook/preview-web';
import { Path, ModuleExports, StoryIndex, Story } from '@storybook/store';
import { toId, AnyFramework, ComponentTitle, StoryId } from '@storybook/csf';

import { DocsContext } from './DocsContext';

type StoryExport = any;
type MetaExport = any;
type ExportName = string;

class ConstantMap<TKey, TValue extends string> {
  entries = new Map<TKey, TValue>();

  // eslint-disable-next-line no-useless-constructor
  constructor(private prefix: string) {}

  get(key: TKey) {
    if (!this.entries.has(key)) {
      this.entries.set(key, `${this.prefix}${this.entries.size}` as TValue);
    }
    return this.entries.get(key);
  }
}

let previewInitialized = false;
const preview = new Preview<AnyFramework>();

const importPaths = new ConstantMap<MetaExport, Path>('./importPath/');
const titles = new ConstantMap<MetaExport, ComponentTitle>('title-');
const exportNames = new ConstantMap<StoryExport, ExportName>('story-');

const storyIds = new Map<StoryExport, StoryId>();

const storyIndex: StoryIndex = { v: 4, entries: {} };
const knownCsfFiles: Record<Path, ModuleExports> = {};

export const ExternalDocsContainer: React.FC<{ projectAnnotations: any }> = ({
  children,
  projectAnnotations,
}) => {
  let pageMeta: MetaExport;
  const setMeta = (m: MetaExport) => {
    pageMeta = m;
  };

  const addStory = (storyExport: StoryExport, storyMeta?: MetaExport) => {
    const meta = storyMeta || pageMeta;
    const importPath = importPaths.get(meta);
    const title = meta.title || titles.get(meta);

    const exportName = exportNames.get(storyExport);
    const storyId = toId(title, exportName);
    storyIds.set(storyExport, storyId);

    if (!knownCsfFiles[importPath]) knownCsfFiles[importPath] = { default: meta };
    knownCsfFiles[importPath][exportName] = storyExport;

    storyIndex.entries[storyId] = {
      id: storyId,
      importPath,
      title,
      name: 'Name',
      type: 'story',
    };
  };

  let previewPromise: Promise<void>;
  const updatePreview = () => {
    const importFn = (importPath: Path) => {
      console.log(knownCsfFiles, importPath);
      return Promise.resolve(knownCsfFiles[importPath]);
    };

    if (!previewPromise) {
      previewPromise = (async () => {
        if (previewInitialized) {
          preview.onStoriesChanged({
            importFn,
            storyIndex,
          });
        } else {
          previewInitialized = true;
          await preview.initialize({
            getStoryIndex: () => storyIndex,
            importFn,
            getProjectAnnotations: () => projectAnnotations,
          });
        }
      })();
    }

    return previewPromise;
  };

  const renderStory = async (storyExport: any, element: HTMLElement) => {
    await updatePreview();

    const storyId = storyIds.get(storyExport);
    if (!storyId) throw new Error(`Didn't find story id '${storyId}'`);
    const story = await preview.storyStore.loadStory({ storyId });

    preview.renderStoryToElement(story, element);
  };

  const docsContext: DocsContextProps = {
    type: 'external',

    id: 'external-docs',
    title: 'External',
    name: 'Docs',

    // FIXME
    storyIdByModuleExport: (moduleExport: any) => storyIds.get(moduleExport) || 'unknown',

    storyById: (id: StoryId) => {
      throw new Error('not implemented');
    },
    getStoryContext: () => {
      throw new Error('not implemented');
    },

    componentStories: () => {
      throw new Error('not implemented');
    },

    loadStory: (id: StoryId) => {
      throw new Error('not implemented');
    },
    renderStoryToElement: () => {
      throw new Error('not implemented');
    },

    setMeta,
    addStory,
    renderStory,
  };

  return <DocsContext.Provider value={docsContext}>{children}</DocsContext.Provider>;
};
