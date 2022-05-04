import React, {
  FunctionComponent,
  ReactNode,
  ElementType,
  ComponentProps,
  useContext,
  useRef,
  useEffect,
  useState,
} from 'react';
import { MDXProvider } from '@mdx-js/react';
import global from 'global';
import { resetComponents, Story as PureStory, StorySkeleton } from '@storybook/components';
import { StoryId, toId, storyNameFromExport, StoryAnnotations, AnyFramework } from '@storybook/csf';
import { Story as StoryType } from '@storybook/store';
import { addons } from '@storybook/addons';
import Events from '@storybook/core-events';

import { CURRENT_SELECTION } from './types';
import { DocsContext, DocsContextProps } from './DocsContext';
import { useStory } from './useStory';

export const storyBlockIdFromId = (storyId: string) => `story--${storyId}`;

type PureStoryProps = ComponentProps<typeof PureStory>;

type CommonProps = StoryAnnotations & {
  height?: string;
  inline?: boolean;
};

type StoryDefProps = {
  name: string;
  children: ReactNode;
};

type StoryRefProps = {
  id?: string;
  of?: any;
};

type StoryImportProps = {
  name: string;
  story: ElementType;
};

export type StoryProps = (StoryDefProps | StoryRefProps | StoryImportProps) & CommonProps;

export const lookupStoryId = (
  storyName: string,
  { mdxStoryNameToKey, mdxComponentAnnotations }: DocsContextProps
) =>
  toId(
    mdxComponentAnnotations.id || mdxComponentAnnotations.title,
    storyNameFromExport(mdxStoryNameToKey[storyName])
  );

export const getStoryId = (props: StoryProps, context: DocsContextProps): StoryId => {
  const { id, of } = props as StoryRefProps;

  if (of) {
    return context.storyIdByModuleExport(of);
  }

  const { name } = props as StoryDefProps;
  const inputId = id === CURRENT_SELECTION ? context.id : id;
  return inputId || lookupStoryId(name, context);
};

export const getStoryProps = <TFramework extends AnyFramework>(
  { height, inline }: StoryProps,
  story: StoryType<TFramework>,
  context: DocsContextProps<TFramework>,
  onStoryFnCalled: () => void
): PureStoryProps => {
  const { name: storyName, parameters } = story;
  const { docs = {} } = parameters;

  if (docs.disable) {
    return null;
  }

  // prefer block props, then story parameters defined by the framework-specific settings and optionally overridden by users
  const { inlineStories = false, iframeHeight = 100, prepareForInline } = docs;
  const storyIsInline = typeof inline === 'boolean' ? inline : inlineStories;
  if (storyIsInline && !prepareForInline) {
    throw new Error(
      `Story '${storyName}' is set to render inline, but no 'prepareForInline' function is implemented in your docs configuration!`
    );
  }

  const boundStoryFn = () => {
    const storyResult = story.unboundStoryFn({
      ...context.getStoryContext(story),
      loaded: {},
      abortSignal: undefined,
      canvasElement: undefined,
    });

    // We need to wait until the bound story function has actually been called before we
    // consider the story rendered. Certain frameworks (i.e. angular) don't actually render
    // the component in the very first react render cycle, and so we can't just wait until the
    // `PureStory` component has been rendered to consider the underlying story "rendered".
    onStoryFnCalled();
    return storyResult;
  };

  return {
    inline: storyIsInline,
    id: story.id,
    height: height || (storyIsInline ? undefined : iframeHeight),
    title: storyName,
    ...(storyIsInline && {
      parameters,
      storyFn: () => prepareForInline(boundStoryFn, context.getStoryContext(story)),
    }),
  };
};

function makeGate(): [Promise<void>, () => void] {
  let open;
  const gate = new Promise<void>((r) => {
    open = r;
  });
  return [gate, open];
}

const Story: FunctionComponent<StoryProps> = (props) => {
  const context = useContext(DocsContext);
  const channel = addons.getChannel();
  const storyRef = useRef();
  const storyId = getStoryId(props, context);
  const story = useStory(storyId, context);
  const [showLoader, setShowLoader] = useState(true);

  useEffect(() => {
    let cleanup: () => void;
    if (story && storyRef.current) {
      const element = storyRef.current as HTMLElement;
      cleanup = context.renderStoryToElement(story, element);
      setShowLoader(false);
    }
    return () => cleanup && cleanup();
  }, [story]);

  const [storyFnRan, onStoryFnRan] = makeGate();
  const [rendered, onRendered] = makeGate();
  useEffect(onRendered);

  if (!story) {
    return <StorySkeleton />;
  }

  const storyProps = getStoryProps(props, story, context, onStoryFnRan);
  if (!storyProps) {
    return null;
  }

  if (storyProps.inline) {
    // If we are rendering a old-style inline Story via `PureStory` below, we want to emit
    // the `STORY_RENDERED` event when it renders. The modern mode below calls out to
    // `Preview.renderStoryToDom()` which itself emits the event.
    if (!global?.FEATURES?.modernInlineRender) {
      // We need to wait for two things before we can consider the story rendered:
      //  (a) React's `useEffect` hook needs to fire. This is needed for React stories, as
      //      decorators of the form `<A><B/></A>` will not actually execute `B` in the first
      //      call to the story function.
      //  (b) The story function needs to actually have been called.
      //      Certain frameworks (i.e.angular) don't actually render the component in the very first
      //      React render cycle, so we need to wait for the framework to actually do that
      Promise.all([storyFnRan, rendered]).then(() => {
        channel.emit(Events.STORY_RENDERED, storyId);
      });
    } else {
      // We do this so React doesn't complain when we replace the span in a secondary render
      const htmlContents = `<span></span>`;

      // FIXME: height/style/etc. lifted from PureStory
      const { height } = storyProps;
      return (
        <div id={storyBlockIdFromId(story.id)}>
          <MDXProvider components={resetComponents}>
            {height ? (
              <style>{`#story--${story.id} { min-height: ${height}; transform: translateZ(0); overflow: auto }`}</style>
            ) : null}
            {showLoader && <StorySkeleton />}
            <div
              ref={storyRef}
              data-name={story.name}
              dangerouslySetInnerHTML={{ __html: htmlContents }}
            />
          </MDXProvider>
        </div>
      );
    }
  }

  return (
    <div id={storyBlockIdFromId(story.id)}>
      <MDXProvider components={resetComponents}>
        <PureStory {...storyProps} />
      </MDXProvider>
    </div>
  );
};

Story.defaultProps = {
  children: null,
  name: null,
};

export { Story };
