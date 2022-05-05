import { useState, useEffect } from 'react';
import type { StoryId, AnyFramework } from '@storybook/csf';
import type { Story } from '@storybook/store';

import { DocsContextProps } from './DocsContext';

export function useStory<TFramework extends AnyFramework = AnyFramework>(
  storyId: StoryId,
  context: DocsContextProps<TFramework>
): Story<TFramework> | void {
  const stories = useStories([storyId], context);
  return stories && stories[0];
}

export function useStories<TFramework extends AnyFramework = AnyFramework>(
  storyIds: StoryId[],
  context: DocsContextProps<TFramework>
): (Story<TFramework> | void)[] {
  // Legacy docs pages can reference any story by id. Those stories will need to be
  // asyncronously loaded; we use the state for this
  const [storiesById, setStories] = useState<Record<StoryId, Story<TFramework>>>({});

  useEffect(() => {
    Promise.all(
      storyIds.filter(Boolean).map(async (storyId) => {
        // loadStory will be called every single time useStory is called
        // because useEffect does not use storyIds as an input. This is because
        // HMR can change the story even when the storyId hasn't changed. However, it
        // will be a no-op once the story has loaded. Furthermore, the `story` will
        // have an exact equality when the story hasn't changed, so it won't trigger
        // any unnecessary re-renders
        const story = await context.loadStory(storyId);
        setStories((current) =>
          current[storyId] === story ? current : { ...current, [storyId]: story }
        );
      })
    );
  });

  return storyIds.filter(Boolean).map((storyId) => {
    if (storiesById[storyId]) return storiesById[storyId];

    try {
      // If we are allowed to load this story id synchonously, this will work
      return context.storyById(storyId);
    } catch (err) {
      return null;
    }
  });
}
