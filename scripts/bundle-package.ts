import path, { resolve } from 'path';
import { bold, gray, greenBright } from 'chalk';
import execa from 'execa';
import { rollup, OutputOptions, watch, RollupOptions } from 'rollup';
import readPkgUp from 'read-pkg-up';
import fs from 'fs-extra';
import rollupTypescript from '@rollup/plugin-typescript';
import { nodeResolve } from '@rollup/plugin-node-resolve';
import commonjs from '@rollup/plugin-commonjs';
import json from '@rollup/plugin-json';
import { babel, getBabelOutputPlugin } from '@rollup/plugin-babel';
import { terser } from 'rollup-plugin-terser';
import { generateDtsBundle } from 'dts-bundle-generator';
import * as dtsLozalize from './dts-localize';

interface Options {
  input: string;
  externals: string[];
  cwd: string;
  optimized?: boolean;
  watch?: boolean;
}

const makeExternalPredicate = (externals: string[]) => {
  if (externals.length === 0) {
    return () => false;
  }
  const pattern = new RegExp(`^(${externals.join('|')})($|/)`);
  return (id: string) => pattern.test(id);
};

async function build(options: Options) {
  const { input, externals, cwd, optimized } = options;
  const setting: RollupOptions = {
    input,
    external: makeExternalPredicate(externals),
    plugins: [
      nodeResolve({
        preferBuiltins: true,
      }),
      commonjs(),
      babel({
        babelHelpers: 'external',
        skipPreflightCheck: true,
      }),
      json(),
      rollupTypescript({ lib: ['es2015', 'dom', 'esnext'], target: 'es6' }),
    ],
  };

  const outputs: OutputOptions[] = [
    {
      dir: resolve(cwd, './dist/modern'),
      format: 'es',
      sourcemap: optimized,
      preferConst: true,
      plugins: [
        getBabelOutputPlugin({
          presets: [
            [
              '@babel/preset-env',
              {
                shippedProposals: true,
                useBuiltIns: 'usage',
                corejs: '3',
                modules: false,
                targets: { chrome: '94' },
              },
            ],
          ],
        }),
        optimized ? terser({ output: { comments: false }, module: true }) : null,
      ].filter(Boolean),
    },
    {
      dir: resolve(cwd, './dist/esm'),
      format: 'es',
      sourcemap: optimized,
      plugins: [
        getBabelOutputPlugin({
          presets: [
            [
              '@babel/preset-env',
              {
                shippedProposals: true,
                useBuiltIns: 'usage',
                modules: false,
                corejs: '3',
              },
            ],
          ],
        }),
        optimized ? terser({ output: { comments: false }, module: true }) : null,
      ].filter(Boolean),
    },
    {
      dir: resolve(cwd, './dist/cjs'),
      format: 'commonjs',
      plugins: [
        getBabelOutputPlugin({
          presets: [
            [
              '@babel/preset-env',
              {
                shippedProposals: true,
                useBuiltIns: 'usage',
                corejs: '3',
                modules: false,
                targets: { node: '14' },
              },
            ],
          ],
        }),
        optimized ? terser({ output: { comments: false }, module: true }) : null,
      ].filter(Boolean),
    },
  ];

  if (options.watch) {
    const watcher = watch({ ...setting, output: outputs });

    watcher.on('change', (event) => {
      console.log(`${greenBright('changed')}: ${event.replace(path.resolve(cwd, '../..'), '.')}`);

      dts(options);
    });
  } else {
    const bundler = await rollup(setting);

    await Promise.all(outputs.map((config) => bundler.write(config)));

    await bundler.close();
  }
}

async function dts({ input, externals, cwd, ...options }: Options) {
  if (options.watch) {
    try {
      const [out] = await generateDtsBundle(
        [
          {
            filePath: input,
            output: { inlineDeclareGlobals: false, sortNodes: true, noBanner: true },
          },
        ],
        { followSymlinks: false }
      );

      await fs.outputFile('dist/ts3.9/index.d.ts', out);
    } catch (e) {
      console.log(e.message);
    }
  } else {
    const [out] = await generateDtsBundle(
      [
        {
          filePath: input,
          output: { inlineDeclareGlobals: false, sortNodes: true, noBanner: true },
        },
      ],
      { followSymlinks: false }
    );

    const bundledDTSfile = path.join(cwd, 'dist/ts-tmp/index.d.ts');
    const localizedDTSout = path.join(cwd, 'dist/ts3.9');
    await fs.outputFile(bundledDTSfile, out);

    await dtsLozalize.run([bundledDTSfile], localizedDTSout, { externals, cwd });

    // await fs.remove(path.join(cwd, 'dist/ts-tmp'));

    await execa('node', [
      path.join(__dirname, '../node_modules/.bin/downlevel-dts'),
      'dist/ts3.9',
      'dist/ts3.4',
    ]);
  }
}

async function removeDist() {
  await fs.remove('dist');
}

export async function run({ cwd, flags }: { cwd: string; flags: string[] }) {
  const { packageJson: pkg } = await readPkgUp({ cwd });
  const message = gray(`Built: ${bold(`${pkg.name}@${pkg.version}`)}`);
  console.time(message);

  if (flags.includes('--reset')) {
    await removeDist();
  }

  const input = path.join(cwd, pkg.bundlerEntrypoint);
  const externals = Object.keys({ ...pkg.dependencies, ...pkg.peerDependencies });

  const options: Options = {
    cwd,
    externals,
    input,
    optimized: flags.includes('--optimized'),
    watch: flags.includes('--watch'),
  };

  await Promise.all([
    //
    build(options),
    dts(options),
  ]);

  console.timeEnd(message);
}
