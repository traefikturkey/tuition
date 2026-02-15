#!/usr/bin/env bun
/**
 * Tuition - Terminal UI for homelab management
 * Main entry point
 */

import { createCli } from './src/cli/commands/index.js';

async function main(): Promise<void> {
  const cli = createCli();
  await cli.parseAsync(process.argv);
}

main().catch((error) => {
  console.error('Fatal error:', error);
  process.exit(1);
});
