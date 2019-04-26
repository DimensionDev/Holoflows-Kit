# @holoflows/kit

A toolkit for browser extension developing.

## Components

@holoflows/kit made up by following parts

-   [DOM](./DOM.md) - Help developer to track changes in the content script
-   [Extension](./Extension.md) - Some tools that useful in extension developing

## Installation

Use `yarn` or `npm`. Or use UMD.

> https://unpkg.com/@holoflows/kit@latest/dist/out.js

If you're using module bundler, use `@holoflows/kit` to import;
using umd, use `window.HoloflowsKit`.

You need to load a polyfill for WebExtension in Chrome (`webextension-polyfill`)

### ECMAScript version

Since this package depends on [Proxy](https://mdn.io/Proxy), it is useless to support ES5.

`@holoflows/kit` export as umd(/dist/out.js) and ESModule(/es/).UMD compiles to ES6，ESModule compiles to ES2018.

Full Typescript support.
