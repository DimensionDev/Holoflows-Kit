# @holoflows/kit

A toolkit for browser extension developing.

## Components

See [API documents](../../api-documents/kit.md)

See tutorial of [DOM watcher](./DOM.md)

## Installation

Use `yarn` or `npm`. Or use UMD.

> https://unpkg.com/@holoflows/kit@latest/umd/index.js

If you're using module bundler, use `@holoflows/kit` to import;
using umd, use `window.HoloflowsKit`.

You need to load a polyfill for WebExtension in Chrome [webextension-polyfill](https://github.com/mozilla/webextension-polyfill).

### ECMAScript version

Since this package depends on [Proxy](https://mdn.io/Proxy), it is useless to support ES5.

`@holoflows/kit` export as umd(/umd/index.js) and ESModule(/es/).UMD compiles to ES6，ESModule compiles to ES2018.

Full Typescript support.
