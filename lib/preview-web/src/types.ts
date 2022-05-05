import type {
  StoryId,
  StoryName,
  AnyFramework,
  StoryContextForLoaders,
  ComponentTitle,
  Parameters,
} from '@storybook/csf';
import type { Story } from '@storybook/store';
import { PreviewWeb } from './PreviewWeb';

export interface DocsContextProps<TFramework extends AnyFramework = AnyFramework> {
  type: 'legacy' | 'modern' | 'external';

  id: StoryId;
  title: ComponentTitle;
  name: StoryName;

  storyIdByModuleExport: (moduleExport: any) => StoryId;
  storyById: (id: StoryId) => Story<TFramework>;
  getStoryContext: (story: Story<TFramework>) => StoryContextForLoaders<TFramework>;

  componentStories: () => Story<TFramework>[];

  loadStory: (id: StoryId) => Promise<Story<TFramework>>;
  renderStoryToElement: PreviewWeb<TFramework>['renderStoryToElement'];

  /**
   * mdxStoryNameToKey is an MDX-compiler-generated mapping of an MDX story's
   * display name to its story key for ID generation. It's used internally by the `<Story>`
   * and `Preview` doc blocks.
   */
  mdxStoryNameToKey?: Record<string, string>;
  mdxComponentAnnotations?: any;

  /**
   * To be used by external docs
   */
  setMeta: (metaExport: any) => void;
  addStory: (storyExport: any, metaExport: any) => void;
  renderStory: (storyExport: any, element: HTMLElement) => void;
}

export type DocsRenderFunction<TFramework extends AnyFramework> = (
  docsContext: DocsContextProps<TFramework>,
  docsParameters: Parameters,
  element: HTMLElement,
  callback: () => void
) => void;
