import global from 'global';
import { AnyFramework, StoryId, ViewMode, StoryContextForLoaders } from '@storybook/csf';
import { Story, StoryStore, CSFFile, ModuleExports, IndexEntry } from '@storybook/store';
import { Channel } from '@storybook/addons';
import { DOCS_RENDERED } from '@storybook/core-events';

import { Render, RenderType } from './StoryRender';
import type { DocsContextProps, DocsRenderFunction } from './types';

export class DocsRender<TFramework extends AnyFramework> implements Render<TFramework> {
  public type: RenderType = 'docs';

  public id: StoryId;

  public legacy: boolean;

  public story?: Story<TFramework>;

  public exports?: ModuleExports;

  private csfFiles?: CSFFile<TFramework>[];

  private preparing = false;

  private canvasElement?: HTMLElement;

  private docsContext?: DocsContextProps<TFramework>;

  public disableKeyListeners = false;

  public teardown: (options: { viewModeChanged?: boolean }) => Promise<void>;

  constructor(
    private channel: Channel,
    private store: StoryStore<TFramework>,
    public entry: IndexEntry
  ) {
    this.id = entry.id;
    this.legacy = entry.type !== 'docs' || entry.legacy;
  }

  // The two story "renders" are equal and have both loaded the same story
  isEqual(other?: Render<TFramework>) {
    return other && this.id === other.id && this.legacy
      ? this.story && this.story === other.story
      : other.type === 'docs' && this.entry === (other as DocsRender<TFramework>).entry;
  }

  async prepare() {
    this.preparing = true;
    if (this.legacy) {
      this.story = await this.store.loadStory({ storyId: this.id });
    } else {
      const { docsExports, csfFiles } = await this.store.loadDocsFileById(this.id);
      this.exports = docsExports;
      this.csfFiles = csfFiles;
    }
    this.preparing = false;
  }

  isPreparing() {
    return this.preparing;
  }

  async getDocsContext(
    renderStoryToElement: DocsContextProps<TFramework>['renderStoryToElement']
  ): Promise<DocsContextProps<TFramework>> {
    const { id, title, name } = this.entry;

    const base = {
      type: this.legacy ? 'legacy' : ('modern' as DocsContextProps['type']),
      id,
      title,
      name,
      loadStory: (storyId: StoryId) => this.store.loadStory({ storyId }),
      renderStoryToElement,
      getStoryContext: (renderedStory: Story<TFramework>) =>
        ({
          ...this.store.getStoryContext(renderedStory),
          viewMode: 'docs' as ViewMode,
        } as StoryContextForLoaders<TFramework>),

      // These three are intended for external renders only
      setMeta: () => {},
      addStory: () => {},
      renderStory: () => {},
    };

    if (this.legacy) {
      const csfFile: CSFFile<TFramework> = await this.store.loadCSFFileByStoryId(this.id);
      const componentStories = () => this.store.componentStoriesFromCSFFile({ csfFile });
      return {
        ...base,

        storyIdByModuleExport: () => {
          // NOTE: we could implement this easily enough by checking all the component stories
          throw new Error('`storyIdByModuleExport` not available for legacy docs files.');
        },
        storyById: (storyId: StoryId) => this.store.storyFromCSFFile({ storyId, csfFile }),

        componentStories,
      };
    }

    return {
      ...base,
      storyIdByModuleExport: (moduleExport) => {
        // eslint-disable-next-line no-restricted-syntax
        for (const csfFile of this.csfFiles) {
          // eslint-disable-next-line no-restricted-syntax
          for (const annotation of Object.values(csfFile.stories)) {
            if (annotation.moduleExport === moduleExport) {
              return annotation.id;
            }
          }
        }

        throw new Error(`No story found with that export: ${moduleExport}`);
      },
      storyById: () => {
        throw new Error('`storyById` not available for modern docs files.');
      },
      componentStories: () => {
        throw new Error('You cannot render all the stories for a component in a docs.mdx file');
      },
    };
  }

  async renderToElement(
    canvasElement: HTMLElement,
    renderStoryToElement: DocsContextProps['renderStoryToElement']
  ) {
    this.canvasElement = canvasElement;
    this.docsContext = await this.getDocsContext(renderStoryToElement);

    return this.render();
  }

  async render() {
    if (!(this.story || this.exports) || !this.docsContext || !this.canvasElement)
      throw new Error('DocsRender not ready to render');

    const { docs } = this.story?.parameters || this.store.projectAnnotations.parameters;

    if (!docs) {
      throw new Error(
        `Cannot render a story in viewMode=docs if \`@storybook/addon-docs\` is not installed`
      );
    }

    const renderer = await docs.renderer();
    (renderer.render as DocsRenderFunction<TFramework>)(
      this.docsContext,
      {
        ...docs,
        ...(!this.legacy && { page: this.exports.default }),
      },
      this.canvasElement,
      () => this.channel.emit(DOCS_RENDERED, this.id)
    );
    this.teardown = async ({ viewModeChanged }: { viewModeChanged?: boolean } = {}) => {
      if (!viewModeChanged || !this.canvasElement) return;
      renderer.unmount(this.canvasElement);
    };
  }

  async rerender() {
    // NOTE: in modern inline render mode, each story is rendered via
    // `preview.renderStoryToElement` which means the story will track
    // its own re-renders. Thus there will be no need to re-render the whole
    // docs page when a single story changes.
    if (!global.FEATURES?.modernInlineRender) await this.render();
  }
}
