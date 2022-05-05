import React, { ComponentType, ReactElement } from 'react';
import ReactDOM from 'react-dom';
import { AnyFramework, Parameters } from '@storybook/csf';
import { DocsRenderFunction } from '@storybook/preview-web';

import { DocsContainer } from './DocsContainer';
import { DocsPage } from './DocsPage';
import { DocsContext, DocsContextProps } from './DocsContext';

export class DocsRenderer<TFramework extends AnyFramework> {
  public render: DocsRenderFunction<TFramework>;

  public unmount: (element: HTMLElement) => void;

  constructor() {
    this.render = (
      docsContext: DocsContextProps<TFramework>,
      docsParameters: Parameters,
      element: HTMLElement,
      callback: () => void
    ): void => {
      renderDocsAsync(docsContext, docsParameters, element).then(callback);
    };

    this.unmount = (element: HTMLElement) => {
      ReactDOM.unmountComponentAtNode(element);
    };
  }
}

async function renderDocsAsync<TFramework extends AnyFramework>(
  docsContext: DocsContextProps<TFramework>,
  docsParameters: Parameters,
  element: HTMLElement
) {
  // FIXME -- use DocsContainer, make it work for modern
  const SimpleContainer = ({ children }: any) => (
    <DocsContext.Provider value={docsContext}>{children} </DocsContext.Provider>
  );

  const Container: ComponentType<{ context: DocsContextProps<TFramework> }> =
    docsParameters.container ||
    (await docsParameters.getContainer?.()) ||
    (docsContext.type === 'legacy' ? DocsContainer : SimpleContainer);

  const Page: ComponentType = docsParameters.page || (await docsParameters.getPage?.()) || DocsPage;

  // Use `title` as a key so that we force a re-render every time we switch components
  const docsElement = (
    <Container key={docsContext.title} context={docsContext}>
      <Page />
    </Container>
  );

  await new Promise<void>((resolve) => {
    ReactDOM.render(docsElement, element, resolve);
  });
}
