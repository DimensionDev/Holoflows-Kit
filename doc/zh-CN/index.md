# @holoflows/kit

一个浏览器扩展开发的工具包

## 组成

@holoflows/kit 由以下部分组成

-   [DOM](./DOM.md) - 帮助扩展开发者追踪被注入网页中的内容变化
-   [Extension](./Extension.md) - 一些扩展开发会使用到的实用工具

## 安装

使用 `yarn` 或 `npm` 安装，或直接使用 umd

> https://unpkg.com/@holoflows/kit@latest/dist/out.js

使用模块加载器时，使用 `@holoflows/kit` 导入；使用 umd 时，使用 `window.HoloflowsKit`。

### ECMAScript 版本

因为本库重度依赖 [Proxy](https://mdn.io/Proxy)，所以支持 ES5 没有意义。

`@holoflows/kit` 以 umd 格式 (/dist/out.js) 和 ESModule 格式 (/es/) 导出，umd 格式编译到 ES6，ESModule 格式编译到 ES2018。

开箱提供了完整的 Typescript 支持。
