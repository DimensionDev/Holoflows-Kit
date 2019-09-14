# @holoflows/kit/DOM/

提供了一组方便追踪被注入页面中内容变化的工具。

## <a id="example">例子</a>

<details>
    <summary>
    我们先来看一个例子：
    </summary>

假设被注入页面是由 React 生成的机票价格页面，它会动态刷新。你想在每张机票的价格后面加上它的美元价格。

```ts
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

new MutationObserverWatcher(price, document.querySelector('#main'))
    .useForeach((node, key, meta) => {
        const addPrice = () => (meta.after.innerText = '$' + EuroToUSD(parseInt(node.innerText)))
        addPrice()
        return {
            onNodeMutation: addPrice,
        }
    })
    .startWatch()
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

ls.evaluate() // 返回当前页面上所有的链接列表
setTimeout(() => {
    ls.evaluate() // 可以多次调用！每次都会返回页面上最新的符合 LiveSelector 的结果！
})
```

关于 LiveSelector 的完整用法，参见 [LiveSelector 的文档](../../api-documents/kit.liveselector.md)。

那么 `MutationObserverWatcher` 又是什么？

</details>

## <a id="example-watcher">Watcher</a>

<details>
Watcher 可以根据某些特定的条件自动执行 `LiveSelector` 的 `evaluate()`，然后通过比较两次列表的变化通知你 LiveSelector 发生了哪些更改。
<summary>
简而言之，就是可以监听指定内容的变化。
</summary>
Watcher 有以下几种：

-   MutationObserverWatcher (使用 [MutationObserver](https://mdn.io/MutationObserver))
-   IntervalWatcher (使用 [setInterval](https://mdn.io/setInterval))
-   EventWatcher (手动触发)

所有 Watcher 的使用方法都是一样的：

-   要让 Watcher 开始监听网页变化，你都需要调用 `startWatch()`
-   要停止 Watcher，需要 `stopWatch()`

一般情况下，Watcher 关注的都是 DOM 的变化，如果你希望关注其他内容的变化，Watcher 提供了 `onAdd` `onRemove` 等的事件，具体请参阅[Watcher 的文档](#doc-watchers)。

### <a id="example-watcher-useforeach">`useForeach`</a>

这是我们来关注 DOM 变化的主要办法。如果你了解 React hooks 的话，这个和那个很像。

简单的说，一个完整的 `useForeach` 调用是这样的

```ts
.useForeach((node, key, meta) => {
    // 这里的代码会在 **每次** 有一个新的 元素 E 进入列表的时候调用。以下是传入的参数：
    node // 是一种叫 DOMProxy 的对象
    meta.before // 是一个 <span> 始终指向 E 的前面
    meta.after // 是一个 <span> 始终指向 E 的后面
    meta.current // 它就是 node（第一个参数），它始终指向 E，就算 E 换了，它的引用也会自动"更新"（事实并非如此，请参见 DOMProxy 的文档）

    key // 用过 React, Vue 或者 Angular 吗？在渲染列表的时候它们都会要求你提供 key 以保证复用。这就和那个差不多。

    meta.realCurrent // 有时候你就是想访问真实的 DOM 元素，那就用它吧。

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
        onTargetChanged(newNode, oldNode) {
            // 如果 key 没变，但是 key 指向的 E 变了的话
            // oldNode 是变化前指向的元素，newNode 是变化后指向的新元素
            // 注意，node.current 始终指向 newNode，所以很多事情你不必手动处理
        },
    }
})
```

> Tips: 如果你始终只关心 `LiveSelector` 选中的第一个元素的话，这里有个捷径！`Watcher#firstDOMProxy` 是一个始终指向第一个元素的 `DOMProxy`！

[Watcher 的文档](#doc-watchers)

</details>

教程到这里就结束了，你可以回头看看最开始的例子。
