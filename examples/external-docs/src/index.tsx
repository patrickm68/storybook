/* global document */

import React, { useState } from 'react';
import ReactDOM from 'react-dom';
import { ExternalDocsContainer } from '@storybook/addon-docs';

/* eslint-disable import/no-webpack-loader-syntax */
import AccountFormDocs from '!babel-loader!@mdx-js/loader!./components/AccountForm.docs.mdx';
/* eslint-disable import/no-webpack-loader-syntax */
// import AccountFormDocs from '!babel-loader!@mdx-js/loader!./components/AccountForm.docs.mdx';

import * as reactAnnotations from '@storybook/react/dist/esm/client/preview/config';
import * as previewAnnotations from './.storybook/preview';

const projectAnnotations = {
  ...reactAnnotations,
  ...previewAnnotations,
};

const Router = ({ docsPages }: { docsPages: any[] }) => {
  const [docNumber, setDocNumber] = useState(0);
  const DocsPage = docsPages[docNumber];

  return (
    <div>
      <ExternalDocsContainer projectAnnotations={projectAnnotations}>
        <DocsPage />
      </ExternalDocsContainer>
      {/* eslint-disable-next-line react/button-has-type */}
      <button onClick={() => setDocNumber((docNumber + 1) % docsPages.length)}>Next Route</button>
    </div>
  );
};

const App = () => <Router docsPages={[AccountFormDocs]} />;

ReactDOM.render(<App />, document.getElementById('root'));
