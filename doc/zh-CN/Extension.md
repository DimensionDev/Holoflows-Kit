# @holoflows/kit/Extension/

一些扩展开发会使用到的实用工具

# <a id="doc-messagecenter">class MessageCenter</a>

一个在 Chrome 扩展不同上下文间传递消息的类。

> Typescript: 消息是有类型的！

```ts
interface AllEvents {
    event1: { x: number; y: number }
}
const mc = new MessageCenter<AllEvents>()
mc.on // 只接受监听 keyof AllEvents
mc.send // 只允许发送 keyof AllEvents, 且 data 需要是 AllEvents[key]
```

## <a id="doc-messagecenter-new">`constructor(key?: string)`</a>

-   key?: 可随意指定，但需要在各个实例之间保持一致。

## <a id="doc-messagecenter-on">`.on(event, handler)`</a>

接受事件。

## <a id="doc-messagecenter-send">`.on(event, data)`</a>

发送事件。

## <a id="doc-messagecenter-writeToConsole">`.writeToConsole`</a>

发送、接受事件时打印到控制台。

# <a id="doc-asynccall">AsyncCall</a>

一个简易 RPC。

[文档见此](../../src/Extension/Async-Call.ts)

# <a id="doc-contexts">Contexts</a>

辨别当前运行的上下文

## <a id="doc-contexts-contexts">type `Contexts`</a>

-   background: 背景页
-   content: 内容脚本
-   unknown: 未知

## <a id="doc-contexts-getcontext">`GetContext():`<a href="#doc-contexts-contexts">Contexts</a></a>

获取当前上下文

## <a id="doc-contexts-onlyrunincontext">`OnlyRunInContext`(context: <a href="#doc-contexts-contexts">Contexts</a> | Contexts[], name: string)</a>

只允许本段代码在某个上下文中运行，否则报错。

-   name 是报错时提供的名字。
