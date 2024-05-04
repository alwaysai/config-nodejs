# @alwaysai/config-nodejs [![npm version](https://badge.fury.io/js/%40alwaysai%2Fconfig-nodejs.svg)](https://www.npmjs.com/package/@alwaysai/config-nodejs) [![Build Status](https://travis-ci.com/alwaysai/config-nodejs.svg?branch=master)](https://travis-ci.com/alwaysai/config-nodejs)

A module for reading and writing JSON configuration files. This package includes runtime JavaScript files suitable for Node.js >=8 as well as the corresponding TypeScript type declarations.

## Usage
See [src/config-file.test.ts](src/config-file.test.ts) for examples of how to use this module's main export `ConfigFile`.

## More information
If you encounter any bugs or have any questions or feature requests, please don't hesitate to file an issue or submit a pull request on this project's repository on GitHub.

## Related

## Release procedure
To release the package to [npmjs.org](https://www.npmjs.com/package/@alwaysai/config-nodejs) follow the steps:

- publish new version: <code>npm run publish:<major|minor|patch></code>
- check the [github pipeline](https://github.com/alwaysai/config-nodejs/actions) running, if successful a new version will be created and published to npmjs.org
- to get the auto-generated commit and tags, simply pull: <code>git pull</code>

## Pipeline is lintng, unit testing and building package on:
- [x] Ubuntu latest / Node.js: 16.x, 18.x, 20.x, 22.x
- [x] MacOS latest / Node.js: 16.x, 18.x, 20.x, 22.x
- [x] Windows latest / Node.js: 16.x, 18.x, 20.x, 22.x
