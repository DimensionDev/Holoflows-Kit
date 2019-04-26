# @holoflows/kit/Extension/

Some tools that useful in extension developing

# <a id="doc-messagecenter">class MessageCenter</a>

A class that can help you to send messages in different context.

> Typescript: Messages are typed!

```ts
interface AllEvents {
    event1: { x: number; y: number }
}
const mc = new MessageCenter<AllEvents>()
mc.on // Can only listen to keyof AllEvents
mc.send // Can only send event of keyof AllEvents and data need to be type AllEvents[key]
```

## <a id="doc-messagecenter-new">`constructor(key?: string)`</a>

-   key?: Whatever, but need to be same in all instances.

## <a id="doc-messagecenter-on">`.on(event, handler)`</a>

Listen to event

## <a id="doc-messagecenter-send">`.on(event, data)`</a>

Send event

## <a id="doc-messagecenter-writeToConsole">`.writeToConsole`</a>

Log to console when receive/send event

# <a id="doc-asynccall">AsyncCall</a>

Async call between different context.

A High level abstraction of MessageCenter.

> Shared code

-   How to stringify/parse parameters/returns should be shared, defaults to NoSerialization.
-   `key` should be shared.

> One side

-   Should provide some functions then export its type (for example, `BackgroundCalls`)
-   `const call = AsyncCall<AllFunctions, ForegroundCalls>(backgroundCalls)`
-   Then you can `call` any method on `ForegroundCalls`

> Other side

-   Should provide some functions then export its type (for example, `ForegroundCalls`)
-   `const call = AsyncCall<AllFunctions, BackgroundCalls>(foregroundCalls)`
-   Then you can `call` any method on `BackgroundCalls`

_Note: Two sides can implement the same function_

Example:

```typescript
// Mono repo
// On UI
const UI = {
    async dialog(text: string) {
        alert(text)
    },
}
export type UI = typeof UI
const callsClient = AsyncCall<Server>(UI)
callsClient.sendMail('hello world', 'what')

// On server
const Server = {
    async sendMail(text: string, to: string) {
        return true
    },
}
export type Server = typeof Server
const calls = AsyncCall<UI>(Server)
calls.dialog('hello')
```

## Options

-   key: A key to prevent collision with other AsyncCalls. Can be anything, but need to be the same on the both side. (Defaults to `default`)
-   serializer: How to serialization and deserialization parameters and return values (Defaults to `NoSerialization`)
-   MessageCenter: A class that can let you transfer messages between two sides (Defaults to `MessageCenter` of @holoflows/kit)
-   dontThrowOnNotImplemented: If this side receive messages that we didn't implemented, throw an error (Defaults to `true`)
-   writeToConsole: Write all calls to console. (Defaults to `true`)

## Serializer:

We offer some built-in serializer:

-   `NoSerialization` (Do not do any serialization)
-   `JSONSerialization` (Use JSON.parse/stringify) (You can provide a `replacer`! See [JSON.stringify](https://mdn.io/JSON.stringify))

You can also build your own serializer by implement interface `Serialization`

## Return:

`typeof` the type parameter. (`<OtherSideImplementedFunctions>`)

# <a id="doc-automatedtabtask">AutomatedTabTask</a>

Based on AsyncCall. Open a new page in the background, execute some task, then close it automatically.

Usage:

> In content script: (You must run this in the page you wanted to run task in!)

```ts
export const task = AutomatedTabTask({
    async taskA() {
        return 'Done!'
    },
})
```

> In background script:

```ts
import { task } from '...'
task('https://example.com/').taskA()
// Open https://example.com/ then run taskA() on that page, which will return 'Done!'
```

## Parameters:

-   taskImplements: All tasks that background page can call.
-   AsyncCallKey: A unique key, defaults to a extension specific url.

## Return:

-   `null` on content script
-   `typeof taskImplements` on background page

# <a id="doc-contexts">Contexts</a>

Identify the current running context

## <a id="doc-contexts-contexts">type `Contexts`</a>

-   background: background page
-   content: content script
-   webpage: a normal webpage
-   options: options page
-   unknown: unknown

## <a id="doc-contexts-getcontext">`GetContext():`<a href="#doc-contexts-contexts">Contexts</a></a>

Get current context

## <a id="doc-contexts-onlyrunincontext">`OnlyRunInContext`(context: <a href="#doc-contexts-contexts">Contexts</a> | Contexts[], name: string)</a>

Check if the current context is the wanted context, if not, throws.

-   `name` is the name while you throw
