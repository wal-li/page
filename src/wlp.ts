#!/usr/bin/env node

import { program } from 'commander';
import { serve } from './serve.js';
import { build } from './build.js';
import { bundle } from './bundle.js';
import { existsSync, mkdirSync, rmSync, writeFileSync } from 'fs';
import { dirname } from 'path';

program.name('wlp').description('Site generator').version('0.0.2');

program
  .command('serve')
  .argument('<dir>', 'Project directory.')
  .action((dir) => {
    serve(dir);
  });

program
  .command('build')
  .argument('<dir>', 'Project directory.')
  .argument('<out>', 'Output directory.')
  .action((dir, out) => {
    build(dir, out);
  });

program
  .command('bundle')
  .argument('<dir>', 'Project directory.')
  .argument('<out>', 'Output file.')
  .action(async (dir, out) => {
    if (existsSync(out)) rmSync(out, { recursive: true, force: true });
    mkdirSync(dirname(out), { recursive: true });

    writeFileSync(out, await bundle(dir));
  });

program.parse();
