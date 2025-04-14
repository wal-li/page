#!/usr/bin/env node

import { program } from 'commander';
import { serve } from './serve.js';
import { build } from './build.js';
import { bundle } from './bundle.js';

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
  .action((dir, out) => {
    bundle(dir, out);
  });

program.parse();
