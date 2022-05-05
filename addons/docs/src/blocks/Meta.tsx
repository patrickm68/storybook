import React, { FC, useContext } from 'react';
import global from 'global';
import { BaseAnnotations } from '@storybook/csf';
import { Anchor } from './Anchor';
import { DocsContext, DocsContextProps } from './DocsContext';

const { document } = global;

type MetaProps = BaseAnnotations & { of?: any };

function getFirstStoryId(docsContext: DocsContextProps): string {
  const stories = docsContext.componentStories();

  return stories.length > 0 ? stories[0].id : null;
}

function renderAnchor() {
  const context = useContext(DocsContext);
  if (context.type !== 'legacy') {
    return null;
  }
  const anchorId = getFirstStoryId(context) || context.id;

  return <Anchor storyId={anchorId} />;
}

/**
 * This component is used to declare component metadata in docs
 * and gets transformed into a default export underneath the hood.
 */
export const Meta: FC<MetaProps> = ({ of }) => {
  const params = new URL(document.location).searchParams;
  const isDocs = params.get('viewMode') === 'docs';

  const context = useContext(DocsContext);
  if (of) context.setMeta(of);

  return isDocs ? renderAnchor() : null;
};
