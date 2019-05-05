# @holoflows/kit/DOM/

提供了一组方便追踪被注入页面中内容变化的工具。

只是来查阅文档的？跳过教程，直接跳转到 [文档](#doc) 吧

## <a id="example">例子</a>

<details>
    <summary>
    我们先来看一个例子：
    </summary>

假设被注入页面是由 React 生成的机票价格页面，它会动态刷新。你想在每张机票的价格后面加上它的美元价格。

```typescript
import { LiveSelector, MutationObserverWatcher } from '@holoflows/kit/DOM'

const price = new LiveSelector()
    // 选择所有的 .ticket-row
    .querySelector<HTMLDivElement>('.ticket-row')
    // 排除那些没有欧元符号的行
    .filter(x => x.innerText.match('€'))
    // 把每个元素映射成它里面的 .price
    .map(x => x.querySelector('.price'))

function EuroToUSD(x: number) {
    return x * 1.13
}

new MutationObserverWatcher(price, document.querySelector('#main')).useNodeForeach(node => {
    const addPrice = () => (node.after.innerText = '$' + EuroToUSD(parseInt(node.current.innerText)))
    addPrice()
    return {
        onNodeMutation: addPrice,
    }
})
```

大功告成，每当有新机票出现，就会自动在后面加上一个美元价格！不过慢点，我还没搞懂！

上面是一个常规的用法，展示了 @holoflows/kit 的简洁与强大之处。

看完了下面的文档再来回头看看上面这段例子，你就能明白了！

</details>

## <a id="example-liveselector">LiveSelector</a>

<details>
一切都要从 LiveSelector 开始……

<summary>
LiveSelector 是一个方便的工具，可以帮你多次计算同一个 "Selector" 的值，而且它很像数组，可以直接执行一些方便的操作。
</summary>

```ts
const ls = new LiveSelector()
ls.querySelectorAll('a') // 选择所有的 a
ls.filter(x => x.href.startsWith('https://')) // 去掉所有不以 https:// 开头的链接
ls.map(x => x.href) // 把 HTMLAnchorElement[] 映射成 string[]

ls.evaluateOnce() // 返回当前页面上所有的链接列表
setTimeout(() => {
    ls.evaluateOnce() // 可以多次调用！每次都会返回页面上最新的符合 LiveSelector 的结果！
})
```

关于 LiveSelector 的完整用法，参见 [LiveSelector 的文档](#doc-LiveSelector)。

那么 `MutationObserverWatcher` 又是什么？

</details>

## <a id="example-watcher">Watcher</a>

<details>
Watcher 可以根据某些特定的条件自动执行 `LiveSelector` 的 `evaluateOnce()`，然后通过比较两次列表的变化通知你 LiveSelector 发生了哪些更改。
<summary>
简而言之，就是可以监听指定内容的变化。
</summary>
Watcher 有以下几种：

-   MutationObserverWatcher (使用 [MutationObserver](https://mdn.io/MutationObserver))
-   IntervalWatcher (使用 [setInterval](https://mdn.io/setInterval))
-   EventWatcher (手动触发)
-   ValueRef (手动触发)

所有 Watcher 的使用方法都是一样的：

-   要让 Watcher 开始监听网页变化，你都需要调用 `startWatch()`
-   要停止 Watcher，需要 `stopWatch()`

一般情况下，Watcher 关注的都是 DOM 的变化，如果你希望关注其他内容的变化，Watcher 提供了 `onAdd` `onRemove` 等的事件，具体请参阅[Watcher 的文档](#doc-watchers)。

### <a id="example-watcher-usenodeforeach">`useNodeForeach`</a>

这是我们来关注 DOM 变化的主要办法。如果你了解 React hooks 的话，这个和那个很像。

简单的说，一个完整的 `useNodeForeach` 调用是这样的

```ts
.useNodeForeach((node, key, realNode) => {
    // 这里的代码会在 **每次** 有一个新的 元素 E 进入列表的时候调用。以下是传入的参数：
    node // 是一种叫 DomProxy 的对象
    node.before // 是一个 <span> 始终指向 E 的前面
    node.after // 是一个 <span> 始终指向 E 的后面
    node.current // 是魔法，它始终指向 E，就算 E 换了，它的引用也会自动"更新"（事实并非如此，请参见 DomProxy 的文档）

    key // 用过 React, Vue 或者 Angular 吗？在渲染列表的时候它们都会要求你提供 key 以保证复用。这就和那个差不多。

    realNode // 有时候 node.current 的魔法会失灵，或者奇奇怪怪的故障，或者总之你就是想访问真实的 DOM 元素，那就用它吧。不过它不会自动更新！

    return {
        onRemove(old) {
            // 如果 E 从文档里消失了……
            // 你需要做的善后工作……
            // 类似于 React.useEffect(() => { return 这里返回的函数 })
        },
        onNodeMutation() {
            // 如果 key 没变，E 也没变
            // 只是 E 内部发生了变化的话，这里会被通知到
            // 比如 node.current 里面新插入了一个元素
        },
        onTargetChanged(oldNode, newNode) {
            // 如果 key 没变，但是 key 指向的 E 变了的话
            // oldNode 是变化前指向的元素，newNode 是变化后指向的新元素
            // 注意，node.current 始终指向 newNode，所以很多事情你不必手动处理
        },
    }
})
```

> Tips: 如果你始终只关心 `LiveSelector` 选中的第一个元素的话，这里有个捷径！`Watcher#firstVirtualNode` 是一个始终指向第一个元素的 `DomProxy`！

[Watcher 的文档](#doc-watchers)

</details>

教程到这里就结束了，你可以回头看看最开始的例子。

# <a id="doc">文档</a>

## <a id="doc-liveselector">class LiveSelector</a>

LiveSelector 上的方法，除了 `evaluateOnce()` 都可以链式调用。

```ts
const ls = new LiveSelector()
```

> Typescript: `LiveSelector` 每一次都有一个类型参数 `<T>` 告诉你计算到这一步时它的类型。

### <a id="doc-liveselector-queryselector">`.querySelector(selector)`</a>

同 [document.querySelector](https://mdn.io/document.querySelector)，计算时，将选中的元素加入列表。

```typescript
ls.querySelector('div#root').querySelector('.nav')
```

**注意：以上的例子等于 `div#root .nav`！**

> Typescript: 这个函数的泛型与 `document.querySelector` 相同

> Typescript: 对于复杂的 CSS 选择器，无法推断它的类型，你需要手动指定。`.querySelector<HTMLDivElement>('div > div')`

### <a id="doc-liveselector-queryselectorall">`.querySelectorAll(selector)`</a>

同 [document.querySelectorAll](https://mdn.io/document.querySelectorAll)，计算时，将选中的元素加入列表。

```typescript
ls.querySelectorAll('div').querySelectorAll('h1')
```

**注意：以上的例子等于 `div h1`**

> Typescript: 这个函数的泛型与 `document.querySelectorAll` 相同

> Typescript: 对于复杂的 CSS 选择器，无法推断它的类型，你需要手动指定。`.querySelectorAll<HTMLDivElement>('div > div')`

### <a id="doc-liveselector-filter">`.filter(callbackfn)`</a>

与 [Array#filter](https://mdn.io/Array.filter) 类似。计算时，过滤掉列表中不符合的内容。

```ts
ls.filter(x => x.innerText.match('hello'))
```

### <a id="doc-liveselector-map">`.map(callbackfn)`</a>

与 [Array#map](https://mdn.io/Array.map) 类似。计算时，将列表中的每个元素映射为另一个元素。

```ts
ls.map(x => x.parentElement)
```

**提示：map 不只限于 map 到 Dom 元素，你可以 map 到任何东西**

### <a id="doc-liveselector-concat">`.concat(newLS: LiveSelector)`</a>

与 [Array#concat](https://mdn.io/Array.concat) 类似。计算时，将一个新的 `LiveSelector` 的计算结果合并进当前的计算结果。

```ts
ls.concat(new LiveSelector().querySelector('#root'))
```

### <a id="doc-liveselector-reverse">`.reverse()`</a>

与 [Array#reverse](https://mdn.io/Array.reverse) 类似。计算时，将列表反转。

```ts
ls.reverse()
```

### <a id="doc-liveselector-slice">`.slice(start?, end?)`</a>

与 [Array#slice](https://mdn.io/Array.slice) 类似。计算时，截取列表的一部分。

```ts
ls.slice(2, 4)
```

### <a id="doc-liveselector-sort">`.sort(compareFn)`</a>

与 [Array#sort](https://mdn.io/Array.sort) 类似。计算时，对列表排序。

```ts
ls.sort((a, b) => a.innerText.length - b.innerText.length)
```

### <a id="doc-liveselector-flat">`.flat()`</a>

与 [Array#flat](https://mdn.io/Array.flat) 类似。计算时，将列表变平。

**注意：这不是递归的操作！**

```ts
ls.flat()
```

### <a id="doc-liveselector-nth">`.nth(n: number)`</a>

计算时，只保留第 N 个元素。

```ts
ls.nth(-1)
```

### <a id="doc-liveselector-replace">`.replace(f: (list: T[]) => NextT[])`</a>

如果认为上面这些类 Array 的方法还不足以满足你的要求，你可以直接在计算时替换列表。

```ts
ls.replace(x => lodash.dropRight(x, 2))
```

### <a id="doc-liveselector-evaluateonce">`.evaluateOnce()`</a>

执行一次计算。这应该是最后一个被调用的方法。每一次调用，它都会重新根据你之前所执行的 `querySelector` 等方法查询一次。

```ts
ls.evaluateOnce()
```

## <a id="doc-watchers">Watchers</a>

所有 Watcher 都继承自抽象类 [Watcher](#abstract-class-Watcher-public)。

### <a id="doc-watcher-public">abstract class Watcher (public)</a>

继承自 [EventEmitter](https://nodejs.org/api/events.html#events_class_eventemitter)

#### <a id="doc-watcher-new">`constructor (liveSelector)`</a>

创建一个新的 `Watcher`。

-   liveSelector: `LiveSelector<any>`, 要监听的 LiveSelector

> Typescript: 泛型 `T` 等于 LiveSelector 的泛型

#### <a id="doc-watcher-startwatch">abstract `.startWatch(?): this`</a>

开始监听。参数请参见实现的说明。

#### <a id="doc-watcher-stopwatch">abstract `.stopWatch()`</a>

停止监听。

#### <a id="doc-watcher-addlistener">`.addListener(event, fn)`</a>

见 [EventEmitter](https://nodejs.org/api/events.html#events_class_eventemitter)。
仅提供以下事件：

-   onChange - 每次列表更新时，发生变化的部分
-   onChangeFull - 每次列表更新时，新的完整的列表
-   onRemove - 每次列表更新时，被删除的部分
-   onAdd - 每次列表更新时，被添加的部分

#### <a id="doc-watcher-firstvirtualnode">`.firstVirtualNode`</a>

**注意：如果 T 不是 HTMLElement 的子类型，那么该对象不可用。**

一个 [DomProxy](#doc-domproxy)，始终指向 LiveSelector 的第一个元素

#### <a id="doc-watcher-assignkeys">`.assignKeys(assigner, comparer?)`</a>

-   assigner: 为每个元素分配一个 key，key 可以是任何内容。
    默认为 `x => x`

```ts
assigner: <Q = unknown>(node: T, index: number, arr: T[]) => Q
// node: 需要被分配 key 的元素
// index: 当前位置
// arr: 整个数组
```

-   comparer: 如果你的 key 不能用 `===` 来直接比较的话，用这个参数自定义一个比较方式。默认为 `(a, b) => a === b`

```ts
comparer: (a: Q, b: Q) => boolean
// a: 一种 assigner 返回的对象
// b: 另一种 assigner 返回的对象
```

#### <a id="doc-watcher-usenodeforeach">`.useNodeForEach(fn)`</a>

**注意：如果 T 不是 HTMLElement 的子类型，那么该函数不可用。**

列表里每添加一个新项目，会调用一次 fn。

##### <a id="doc-watcher-usenodeforeach-fn">fn 与它的返回值：</a>

```ts
(fn: (node: DomProxy, key: Q, realNode: HTMLElement) => ...)
// node: 一个 DomProxy
// key: assigner 返回的 key
// realNode: node 所对应的真实 node
```

-   undefined: 什么也不会发生
-   一个函数: `(oldNode: T) => void`，当 `key` 在某一次迭代中从列表中消失了，该函数会被调用
-   一个对象: `{ onRemove?: (old: T) => void; onTargetChanged?: (oldNode: T, newNode: T) => void; onNodeMutation?: (node: T) => void }`
-   -   `onRemove(oldNode: T) => void` 当 `key` 在某一次迭代中从列表中消失了，该函数会被调用
-   -   `onTargetChanged(oldNode: T, newNode: T) => void` 当 `key` 在两次迭代中依然存在，但它对应的元素不同时会调用
-   -   `onNodeMutation: (node: T) => void` 当 `key` 和元素都没有变化，而是元素内部发生了变化时会调用。

#### <a id="doc-watcher-getvirtualnodebykey">`.getVirtualNodeByKey(key)`</a>

**注意：如果 T 不是 HTMLElement 的子类型，那么该函数不可用。**

-   key: Q. 根据 key 寻找 key 对应的 [DomProxy](#doc-domproxy)

### <a id="doc-mutationobserverwatcher">MutationObserverWatcher</a>

#### <a id="doc-mutationobserverwatcher-new">`constructor (liveSelector, consistentWatchRoot = document.body)`</a>

创建一个新的 `MutationObserverWatcher`。

它会在 `consistentWatchRoot` 上发生任何变化时计算变化。

> 每 requestAnimateFrame 最多查询一次，不会导致页面卡顿。

-   liveSelector: `LiveSelector<any>`, 要监听的 LiveSelector
-   consistentWatchRoot: `Element | Document`, 保证稳定（不会被删除从而导致监听失效）的元素，默认为 `document.body`，如果你怀疑 `MutationObserverWatcher` 导致了性能问题，请提供这个参数缩小监听范围。

#### <a id="doc-mutationobserverwatcher-startwatch">`startWatch(options?: MutationObserverInit)`</a>

开始监听。

-   options: `MutationObserverInit`，你可以自行排除掉对某些修改事件的监听。（见： [MutationObserver](https://mdn.io/MutationObserver) ）

### <a id="doc-intervalwatcher">IntervalWatcher</a>

通过时间流逝触发检查。

#### <a id="doc-intervalwatcher-startwatch">`.startWatch(interval)`</a>

开始监听。

-   options: `numebr`，每隔多少毫秒检查一次。

### <a id="doc-eventwatcher">EventWatcher</a>

手动触发检查。

#### <a id="doc-eventwatcher-startwatch">`.startWatch()`</a>

开始监听。

#### <a id="doc-eventwatcher-eventlistener">`.eventListener()`</a>

事件监听器。
用法：

```ts
ele.addEventListener('click', watcher.eventListener)
```

### <a id="doc-valueref">ValueRef</a>

ValueRef 与 `Watcher` 无关，它监听 `.value =`。例如：

```ts
const ref = new ValueRef(0)
ref.value // 0
ref.addListener((newVal, old) => console.log(newVal, old))
ref.value = 1
// Log: 1, 0
ref.value // 1
```

#### <a id="doc-valueref-new">`constructor<T>(value: T)`</a>

-   value: 初始值。

#### <a id="doc-valueref-value">`.value`</a>

当前值。写入的话会触发事件。

#### <a id="doc-valueref-addlistener>`.addListener(fn: (newValue: T, oldValue: T) => void): () => void`</a>

添加监听器。当值改变的时候会被触发。

-   newValue: 新的值
-   oldValue: 旧的值

返回一个函数，调用该函数会取消该监听器。可以用在 React 的 hooks 中。

```ts
const [val, setVal] = React.useState(0)
React.useEffect(() => ref.addListener(setVal))
```

#### <a id="doc-valueref-removelistener>`.removeListener(fn: (newValue: T, oldValue: T) => void): void`</a>

取消监听器。

#### <a id="doc-valueref-removealllistener>`.removeAllListener(): void`</a>

取消所有监听器。

### <a id="doc-watcher-protected">abstract class Watcher (protected)</a>

这里 Watcher 的 protected 属性与方法。如果你不是在自己继承 `Watcher`，那么你用不到这里提到的属性和方法。

#### <a id="doc-watcher-nodewatcher">protected readonly `.nodeWatcher: MutationWatcherHelper`</a>

用于触发 onNodeMutation 的 Watcher。

`MutationWatcherHelper` 是内部类，没有导出。你不应该使用它。

#### <a id="doc-watcher-watching">protected `.watching: boolean`</a>

当前是否正在监听。如果为 `false`，那么 `.watcherCallback()` 不会有反应。

#### <a id="doc-watcher-lastkeylist">protected `.lastKeyList: unknown[]`</a>

上一次检查的 Key 列表。

#### <a id="doc-watcher-lastnodelist">protected `.lastNodeList: T[]`</a>

上一次检查的元素列表。

#### <a id="doc-watcher-lastcallbackmap">protected `.lastCallbackMap: Map<unknown, useWatchCallback<T>>`</a>

所有还未销毁的 `useNodeForeach()` 所返回的函数（`onRemove` `onNodeMutation` 等）

#### <a id="doc-watcher-lastvirtualnodesmap">protected `.lastVirtualNodesMap: Map<unknown, DomProxy>`</a>

所有还未销毁的 DomProxy

#### <a id="doc-watcher-findnodefromlistbykey">protected `.findNodeFromListByKey(list: T[], keys: unknown: []): (key: unknown) => T | null`</a>

一个高阶函数。通过 key 在 list 中寻找元素。（因为元素可能是复杂的对象，不能直接比较。）

```ts
.findNodeFromListByKey(this.lastNodeList, this.lastKeyList)(key)
```

#### <a id="doc-watcher-watchercallback">protected `.watcherCallback()`</a>

检查逻辑。当你需要触发检查时，调用它。

它做了以下这些事情：

-   调用 `LiveSelector` 的 `EvaluateOnce`
-   通过 `assignKeys` 为每个元素设置 `key`

-   寻找被删除的元素并调用 `onRemove`
-   寻找新增的元素并调用 `useNodeForeachFn()`
-   寻找 `key` 相同但变化了的元素并调用 `onTargetChanged()`
-   重新设置 `lastCallbackMap` `lastVirtualNodesMap` `lastKeyList` `lastNodeList`
-   发出 `onChangeFull` `onChange` `onRemove` `onAdd` 事件
-   为 `.firstVirtualNode` 绑定新的 Node

#### <a id="doc-watcher-mapnodetokey">protected `.mapNodeToKey(node: T, index: number: arr: T[]): unknown`</a>

返回 node 对应的 key（可被 `assignKeys` 覆盖）

#### <a id="doc-watcher-keycomparer">protected `.keyComparer(a: unknown, b: unknown): boolean`</a>

返回 `a` 和 `b` 是否相等 (可被 `assignKeys` 覆盖)

#### <a id="doc-watcher-usenodeforeachfn">protected `.useNodeForeachFn(...): ...`</a>

见 [.useNodeForeach](#doc-watcher-usenodeforeach-fn)

## <a id="doc-domproxy">DomProxy</a>

DomProxy 提供抽象的 Dom，其引用不随 Dom 变化而变化。

调用后返回以下对象

### <a id="doc-domproxy-before">`.before`</a>

一个 span 元素，始终位于 [realCurrent](#doc-domproxy-realCurrent) 前面

### <a id="doc-domproxy-beforeshadow">`.beforeShadow`</a>

等同于 .before.shadowRoot (闭合的)

### <a id="doc-domproxy-current">`.current`</a>

一个伪装的 HTML 元素，对其的操作会转发到 [realCurrent](#doc-domproxy-realCurrent)，realCurrent 改变后，曾经的部分操作会被转发。

### <a id="doc-domproxy-after">`.after`</a>

一个 span 元素，始终位于 [realCurrent](#doc-domproxy-realCurrent) 后面

### <a id="doc-domproxy-aftershadow">`.afterShadow`</a>

等同于 .after.shadowRoot (闭合的)

### <a id="dom-domproxy-realCurrent">`.realCurrent`</a>

真实的 current。修改的话会触发 [after](#doc-domproxy-after), [current](#doc-domproxy-current), [before](#doc-domproxy-before) 的修改。

### <a id="dom-domproxy-destroy">`.destroy()`</a>

调用后该 DomProxy 不再可用。

### DOMProxy 当前的转发策略

**注意：只有通过 current 进行的修改才会被转发**

-   forward: 转发到当前的 `realCurrent`
-   undo: `realCurrent` 修改时被撤销
-   move: `realCurrent` 修改时移动到新的 `realCurrent` 上

| 属性             | forward | undo | move |
| ---------------- | ------- | ---- | ---- |
| style            | Yes     | Yes  | Yes  |
| addEventListener | Yes     | Yes  | Yes  |
| appendChild      | Yes     | Yes  | Yes  |
| ...默认          | Yes     | No   | No   |

这意味着，你修改 `current.style.opacity`，在 `realCurrent` 被修改后，新的 `realCurrent` 也会自动修改 `current.style.opacity`

**将来会添加更多转发策略，如有需要，欢迎到 issue 提出，或自己实现！**
