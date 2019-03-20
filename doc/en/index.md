# @holoflows/kit

A toolkit for browser extension developing.

## Components

@holoflows/kit 由以下部分组成

-   [DOM](./DOM.md) - Help developer to track changes in the content script
-   [Extension](./Extension.md) - Some tools that useful in extension developing

## Installation

Use `yarn` or `npm`. Or use UMD.

> https://unpkg.com/@holoflows/kit@latest/dist/out.js

使用模块加载器时，使用 `@holoflows/kit` 导入；使用 umd 时，使用 `window.HoloflowsKit`。

### ECMAScript version

Since this package depends on [Proxy](https://mdn.io/Proxy), it is useless to support ES5.

`@holoflows/kit` export as umd(/dist/out.js) and ESModule(/es/).UMD compiles to ES6，ESModule compiles to ES2018.

Full Typescript support.
