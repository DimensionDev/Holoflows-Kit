# @holoflows/kit

一个浏览器扩展开发的工具包

## 组成

@holoflows/kit 由以下部分组成

-   [DOM 相关的工具的教程](./DOM.md) - 帮助扩展开发者追踪被注入网页中的内容变化
-   -   [DOMProxy](../../api-documents/kit.domproxy.md) 用于持续追踪网页变化而不丢失引用和副作用
-   -   [LiveSelector](../../api-documents/kit.liveselector.md) 用于持续选择网页中的元素。
-   -   `abstract` [Watcher](../../api-documents/kit.watcher.md)
-   -   -   [MutationObserverWatcher](../../api-documents/kit.mutationobserverwatcher.md) 通过 `MutationObserver` 追踪网页中的变化
-   -   -   [IntervalWatcher](../../api-documents/kit.intervalwatcher.md) 通过 `setInterval` 追踪网页中的变化
-   -   -   [EventWatcher](../../api-documents/kit.eventwatcher.md) 通过事件回调追踪网页中的变化

-   Extension - 一些扩展开发会使用到的实用工具
-   -   [Context](../../api-documents/kit.contexts.md) 在扩展开发中检测当前的上下文
-   -   [MessageCenter](../../api-documents/kit.messagechannel.md) 在插件开发的不同上下文中通信

-   Util
-   -   [ValueRef](../../api-documents/kit.valueref.md) 通过 `setter` 订阅值的变化

## 安装

使用 `yarn` 或 `npm` 安装，或直接使用 umd

> https://unpkg.com/@holoflows/kit@latest/umd/index.js

使用模块加载器时，使用 `@holoflows/kit` 导入；使用 umd 时，使用 `window.HoloflowsKit`。

如果在 Chrome 中使用，需要加载 WebExtension 的 Polyfill [webextension-polyfill](https://github.com/mozilla/webextension-polyfill)。

### ECMAScript 版本

因为本库重度依赖 [Proxy](https://mdn.io/Proxy)，所以支持 ES5 没有意义。

`@holoflows/kit` 以 umd 格式 (/umd/index.js) 和 ESModule 格式 (/es/) 导出，umd 格式编译到 ES6，ESModule 格式编译到 ES2018。

开箱提供了完整的 Typescript 支持。
