import type { Parameters, AnyFramework, ComponentTitle, StoryId } from '@storybook/csf';
import { isExportStory } from '@storybook/csf';
import { logger } from '@storybook/client-logger';

import { normalizeStory } from './normalizeStory';
import { normalizeComponentAnnotations } from './normalizeComponentAnnotations';
import type {
  ModuleExports,
  CSFFile,
  NormalizedComponentAnnotations,
  Path,
  NormalizedStoryAnnotations,
} from '../types';

const checkGlobals = (parameters: Parameters) => {
  const { globals, globalTypes } = parameters;
  if (globals || globalTypes) {
    logger.error(
      'Global args/argTypes can only be set globally',
      JSON.stringify({
        globals,
        globalTypes,
      })
    );
  }
};

const checkStorySort = (parameters: Parameters) => {
  const { options } = parameters;
  if (options?.storySort) logger.error('The storySort option parameter can only be set globally');
};

const checkDisallowedParameters = (parameters: Parameters) => {
  if (!parameters) {
    return;
  }
  checkGlobals(parameters);
  checkStorySort(parameters);
};

// Given the raw exports of a CSF file, check and normalize it.
export function processCSFFile<TFramework extends AnyFramework>(
  moduleExports: ModuleExports,
  importPath: Path,
  title: ComponentTitle,
  moduleExportMap?: Map<any, StoryId>
): CSFFile<TFramework> {
  const { default: defaultExport, __namedExportsOrder, ...namedExports } = moduleExports;

  const meta: NormalizedComponentAnnotations<TFramework> =
    normalizeComponentAnnotations<TFramework>(defaultExport, title, importPath);
  checkDisallowedParameters(meta.parameters);

  const csfFile: CSFFile<TFramework> = { meta, stories: {} };

  Object.keys(namedExports).forEach((key) => {
    if (isExportStory(key, meta)) {
      const storyMeta = normalizeStory(key, namedExports[key], meta);
      checkDisallowedParameters(storyMeta.parameters);

      // Track which exports get turned into which ids
      if (moduleExportMap) moduleExportMap.set(namedExports[key], storyMeta.id);
      csfFile.stories[storyMeta.id] = storyMeta;
    }
  });

  return csfFile;
}
