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

A simple RPC. [Documentation in the code](../../src/Extension/Async-Call.ts)

# <a id="doc-contexts">Contexts</a>

Identify the current running context

## <a id="doc-contexts-contexts">type `Contexts`</a>

-   background: background page
-   content: content script
-   unknown: unknown

## <a id="doc-contexts-getcontext">`GetContext():`<a href="#doc-contexts-contexts">Contexts</a></a>

Get current context

## <a id="doc-contexts-onlyrunincontext">`OnlyRunInContext`(context: <a href="#doc-contexts-contexts">Contexts</a> | Contexts[], name: string)</a>

Check if the current context is the wanted context, if not, throws.

-   `name` is the name while you throw
