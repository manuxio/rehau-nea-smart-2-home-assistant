// Metro config for npm-workspaces monorepo. Default Metro only resolves from
// apps/mobile/node_modules, but npm hoists everything to the repo root, so
// `expo` (and friends) live at <repo>/node_modules and the bundler errors
// out with "Unable to resolve 'expo' from index.ts".
//
// Per Expo's monorepo guide:
//   https://docs.expo.dev/guides/monorepos/
//
// 1. watchFolders   — Metro watches the workspace root for file changes.
// 2. nodeModulesPaths + disableHierarchicalLookup — Metro looks in exactly
//    these two folders (project-local + repo root) and nowhere else, which
//    avoids the "duplicate React" trap when an unrelated package up the tree
//    drags in its own copy.

const { getDefaultConfig } = require("expo/metro-config");
const path = require("node:path");

const projectRoot = __dirname;
const workspaceRoot = path.resolve(projectRoot, "..", "..");

const config = getDefaultConfig(projectRoot);

config.watchFolders = [workspaceRoot];

config.resolver.nodeModulesPaths = [
  path.resolve(projectRoot, "node_modules"),
  path.resolve(workspaceRoot, "node_modules"),
];
config.resolver.disableHierarchicalLookup = true;

module.exports = config;
