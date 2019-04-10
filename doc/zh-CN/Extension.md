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

在不同环境之间进行远程过程调用。

一个 MessageCenter 的高阶抽象。

> 两端共享的代码

-   如何对参数和返回值进行序列化、反序列化的代码应该在两端共享，默认值为不进行序列化。
-   `key` should be shared.

> 甲端

-   应该提供一些函数供另一端调用。（例如， `BackgroundCalls`）
-   `const call = AsyncCall<ForegroundCalls>(backgroundCalls)`
-   然后你就能把 `call` 当作 `ForegroundCalls` 类型的对象来调用另一端的代码了。

> 乙端

-   应该提供一些函数供另一端调用。（例如， `ForegroundCalls`）
-   `const call = AsyncCall<BackgroundCalls>(foregroundCalls)`
-   然后你就能把 `call` 当作 `BackgroundCalls` 类型的对象来调用另一端的代码了。

_提示: 两端可以定义同一个函数_

例子:

```typescript
// Mono repo
// UI 一端
const UI = {
    async dialog(text: string) {
        alert(text)
    },
}
export type UI = typeof UI
const callsClient = AsyncCall<Server>(UI)
callsClient.sendMail('hello world', 'what')

// 服务器一端
const Server = {
    async sendMail(text: string, to: string) {
        return true
    },
}
export type Server = typeof Server
const calls = AsyncCall<UI>(Server)
calls.dialog('hello')
```

## 选项

-   key: 一个 Key，以防与其他同一信道上通信的 AsyncCall 冲突，可以是任何内容，但需要在两端一致。（默认为 `default`）
-   serializer: 如何序列化、反序列化参数和返回值。（默认为 `NoSerialization`）
-   MessageCenter: 一个消息中心，作为通信信道，只要实现了对应接口即可使用任何信道通信，比如 `WebSocket` `chrome.runtime` 等。（默认为 `@holoflows/kit` 自带的 `MessageCenter`）
-   dontThrowOnNotImplemented: 如果本端收到了远程调用，但本端没有实现该函数时，是否忽略错误。（默认为 `true`）
-   writeToConsole: 是否把所有调用输出到控制台以便调试。（默认为 `true`）

## 序列化

有一些内置的序列化办法：

-   `NoSerialization` (不进行任何序列化)
-   `JSONSerialization` (使用 JSON.parse/stringify 进行序列化) (你可以提供一个 `replacer`！见 [JSON.stringify](https://mdn.io/JSON.stringify))

你也可以实现自己的序列化，只需要实现 `Serialization` 接口即可。

## 返回值

返回一个类型为 `OtherSideImplementedFunctions` 的对象。

# <a id="doc-automatedtabtask">AutomatedTabTask</a>

基于 AsyncCall。打开一个新标签页，执行一些任务，然后自动关闭标签页。

例子：

> 在 content script 中（一定要在你需要执行任务的页面里注入！）：

```ts
export const task = AutomatedTabTask({
    async taskA() {
        return 'Done!'
    },
})
```

> 在背景页中：

```ts
import { task } from '...'
task('https://example.com/').taskA()
// 打开 https://example.com/，在上面运行 taskA()，等待返回结果（'Done!'）然后自动关闭页面
```

## 参数

-   taskImplements: Content script 能执行的任务。
-   AsyncCallKey: 一个 Key，默认对每个插件不同。

## 返回值

-   在 content script 上为 `null`
-   在背景页上为 `typeof taskImplements`

# <a id="doc-contexts">Contexts</a>

辨别当前运行的上下文

## <a id="doc-contexts-contexts">type `Contexts`</a>

-   background: 背景页
-   content: 内容脚本
-   webpage: 普通的网页
-   unknown: 未知

## <a id="doc-contexts-getcontext">`GetContext():`<a href="#doc-contexts-contexts">Contexts</a></a>

获取当前上下文

## <a id="doc-contexts-onlyrunincontext">`OnlyRunInContext`(context: <a href="#doc-contexts-contexts">Contexts</a> | Contexts[], name: string)</a>

只允许本段代码在某个上下文中运行，否则报错。

-   name 是报错时提供的名字。
