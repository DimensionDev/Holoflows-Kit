/**
 * WatcherClass provides an abstract implementation of a watcher to the LiveSelector
 *
 * You should extend it and implement your own watch logic.
 *
 * Built-in watcher:
 *
 * - Mutation Observer watcher (based on MutationObserver api, watch DOM changes)
 * - Interval watcher (based on time interval)
 * - Event watcher (based on addEventListener)
 */
import { DomProxy, DomProxyOptions } from './Proxy'
import { EventEmitter } from 'events'
import { LiveSelector } from './LiveSelector'

import differenceWith from 'lodash-es/differenceWith'
import intersectionWith from 'lodash-es/intersectionWith'
import uniqWith from 'lodash-es/uniqWith'

type RequireElement<T, V = T> = T extends Element ? V : never
type ElementLikeT<T> = T extends Element ? T : never
interface Deadline {
    didTimeout: boolean
    timeRemaining(): number
}
/**
 * Return value of useNodeForeach
 */
type useNodeForeachReturns<T> =
    | void
    | ((oldNode: T) => void)
    | {
          onRemove?: (old: T) => void
          onTargetChanged?: (oldNode: T, newNode: T) => void
          onNodeMutation?: (node: T, mutations: MutationRecord[]) => void
      }
type EventCallback<T> = (fn: CustomEvent<T> & { data: T }) => void
/**
 * Use LiveSelector to watch dom change
 *
 * @abstract You need to implement `startWatch`
 */
export abstract class Watcher<
    T,
    DomProxyBefore extends Element = HTMLSpanElement,
    DomProxyAfter extends Element = HTMLSpanElement
> {
    /** Event emitter */
    protected readonly eventEmitter = new EventEmitter()
    constructor(protected liveSelector: LiveSelector<T>) {
        if ('requestIdleCallback' in window) {
            this.requestIdleCallback = (...args: any) => (window as any)['requestIdleCallback'](...args)
        }
    }
    //#region DomProxy options
    protected domProxyOption: Partial<DomProxyOptions<DomProxyBefore, DomProxyAfter>> = {}
    /**
     * Set option for DomProxy
     * @param option DomProxy options
     */
    setDomProxyOption(option: Partial<DomProxyOptions<DomProxyBefore, DomProxyAfter>>): this {
        this.domProxyOption = option
        return this
    }
    //#endregion
    //#region Watch once
    /**
     * Run the Watcher once. Once it emit data, stop watching.
     * @param fn Map function transform T to Result
     * @param starter function used to start the watcher, defaults to `() => this.startWatch()`
     */
    once<Result>(
        fn: (data: T) => PromiseLike<Result> | Result,
        starter: (this: this, watcher: this) => void = () => this.startWatch(),
    ): Promise<Result[]> {
        return new Promise((resolve, reject) => {
            const f: EventCallback<T[]> = e => {
                this.stopWatch()
                Promise.all(e.data.map(fn)).then(resolve, reject)
            }
            this.eventEmitter.once('onChangeFull', f)
            starter.call(this)
        })
    }
    //#endregion
    abstract startWatch(...args: any[]): this
    stopWatch(...args: any[]): void {
        this.watching = false
        this.eventEmitter.removeAllListeners()
        this.lastCallbackMap = new Map()
        this.lastKeyList = []
        this.lastNodeList = []
        this.lastVirtualNodesMap = new Map()
    }
    //#region Watcher
    /** Is the watcher running */
    protected requestIdleCallback(fn: (t: Deadline) => void, timeout?: { timeout: number }) {
        const start = Date.now()
        return setTimeout(() => {
            fn({
                didTimeout: false,
                timeRemaining: function() {
                    return Math.max(0, 50 - (Date.now() - start))
                },
            })
        }, 1)
    }
    protected watching = false
    /** Found key list of last watch */
    protected lastKeyList: unknown[] = []
    /** Found Node list of last watch */
    protected lastNodeList: T[] = []
    /** Saved callback map of last watch */
    protected lastCallbackMap = new Map<unknown, useNodeForeachReturns<T>>()
    /** Saved virtual node of last watch */
    protected lastVirtualNodesMap = new Map<unknown, DomProxy<ElementLikeT<T>, DomProxyBefore, DomProxyAfter>>()
    /** Find node from the given list by key */
    protected findNodeFromListByKey = (list: T[], keys: unknown[]) => (key: unknown) => {
        const i = keys.findIndex(x => this.keyComparer(x, key))
        if (i === -1) return null
        return list[i]
    }
    protected _omitWarningForRepeatedKeys = false
    /**
     * If you're expecting repeating keys, call this function, this will omit the warning.
     */
    omitWarningForRepeatedKeys() {
        this._omitWarningForRepeatedKeys = true
        return this
    }
    /** Should be called every watch */
    protected watcherCallback = (deadline?: Deadline) => {
        if (!this.watching) return

        const thisNodes = this.liveSelector.evaluateOnce()
        const thisKeyList = thisNodes.map(this.mapNodeToKey)

        //#region Warn about repeated keys
        {
            if (!this._omitWarningForRepeatedKeys) {
                const uniq = uniqWith(thisKeyList, this.keyComparer)
                if (uniq.length < thisKeyList.length) {
                    console.warn(
                        'There are repeated keys in your watcher. [uniqKeys, allKeys] = ',
                        uniq,
                        thisKeyList,
                        ', to omit this warning, call watcher.omitWarningForRepeatedKeys',
                    )
                }
            }
        }
        //#endregion

        // New maps for the next generation
        const nextCallbackMap = new Map<unknown, useNodeForeachReturns<T>>()
        const nextVirtualNodesMap = new Map<unknown, DomProxy<ElementLikeT<T>, DomProxyBefore, DomProxyAfter>>()

        //#region Key is gone
        // Do: Delete node
        const findFromLast = this.findNodeFromListByKey(this.lastNodeList, this.lastKeyList)
        const goneKeys = differenceWith(this.lastKeyList, thisKeyList, this.keyComparer)
        {
            for (const oldKey of goneKeys) {
                const virtualNode = this.lastVirtualNodesMap.get(oldKey)
                const callbacks = this.lastCallbackMap.get(oldKey)
                const node = findFromLast(oldKey)!
                // Delete node don't need a short timeout.
                this.requestIdleCallback(
                    () => {
                        if (callbacks) {
                            if (typeof callbacks === 'function') virtualNode && callbacks(virtualNode.realCurrent!)
                            else if (callbacks.onRemove) {
                                callbacks.onRemove(node)
                            }
                        }
                        if (virtualNode) virtualNode.destroy()
                    },
                    { timeout: 2000 },
                )
            }
        }
        //#endregion

        //#region Key is new
        // Do: Add node
        const findFromNew = this.findNodeFromListByKey(thisNodes, thisKeyList)
        const newKeys = differenceWith(thisKeyList, this.lastKeyList, this.keyComparer)
        {
            for (const newKey of newKeys) {
                if (!this.useNodeForeachFn) break
                const node = findFromNew(newKey)
                if (node instanceof Element) {
                    const virtualNode = DomProxy<ElementLikeT<T>, DomProxyBefore, DomProxyAfter>(this.domProxyOption)
                    virtualNode.realCurrent = node as ElementLikeT<T>
                    // This step must be sync.
                    const callbacks = this.useNodeForeachFn(virtualNode, newKey, node)
                    if (callbacks && typeof callbacks !== 'function' && callbacks.onNodeMutation) {
                        virtualNode.observer.init = {
                            subtree: true,
                            childList: true,
                            characterData: true,
                            attributes: true,
                        }
                        virtualNode.observer.callback = m => callbacks.onNodeMutation!(node, m)
                    }
                    nextCallbackMap.set(newKey, callbacks)
                    nextVirtualNodesMap.set(newKey, virtualNode)
                }
            }
        }
        //#endregion

        //#region Key is the same, but node is changed
        // Do: Change reference
        const oldSameKeys = intersectionWith(this.lastKeyList, thisKeyList, this.keyComparer)
        const newSameKeys = intersectionWith(thisKeyList, this.lastKeyList, this.keyComparer)
        type U = [T, T, unknown, unknown]
        const changedNodes = oldSameKeys
            .map(x => [findFromLast(x), findFromNew(x), x, newSameKeys.find(newK => this.keyComparer(newK, x))] as U)
            .filter(([a, b]) => a !== b)
        for (const [oldNode, newNode, oldKey, newKey] of changedNodes) {
            if (newNode instanceof Element) {
                const virtualNode = this.lastVirtualNodesMap.get(oldKey)!
                virtualNode.realCurrent = newNode as ElementLikeT<T>

                const fn = this.lastCallbackMap.get(oldKey)
                if (fn && typeof fn !== 'function' && fn.onTargetChanged) {
                    // This should be ordered. So keep it sync now.
                    fn.onTargetChanged(oldNode, newNode)
                }
            }
        }
        //#endregion

        // Key is the same, node is the same
        // Do: nothing

        // #region Final: Copy the same keys
        for (const newKey of newSameKeys) {
            const oldKey = oldSameKeys.find(oldKey => this.keyComparer(newKey, oldKey))
            nextCallbackMap.set(newKey, this.lastCallbackMap.get(oldKey))
            nextVirtualNodesMap.set(newKey, this.lastVirtualNodesMap.get(oldKey)!)
        }
        this.lastCallbackMap = nextCallbackMap
        this.lastVirtualNodesMap = nextVirtualNodesMap
        this.lastKeyList = thisKeyList
        this.lastNodeList = thisNodes

        this.emit('onChangeFull', thisNodes)
        this.emit(
            'onChange',
            changedNodes.map(([oldNode, newNode, oldKey, newKey]) => ({ oldNode, newNode, oldKey, newKey })),
        )
        this.emit('onRemove', goneKeys.map(key => ({ key, node: findFromLast(key)! })))
        this.emit('onAdd', newKeys.map(key => ({ key, node: findFromNew(key)! })))

        // For single node mode
        const first = thisNodes[0]
        if (first instanceof Element) {
            this.firstVirtualNode.realCurrent = first as ElementLikeT<T>
        } else if (first === undefined || first === null) {
            this.firstVirtualNode.realCurrent = null
        }
        //#endregion
    }
    //#endregion

    //#region events
    addListener(
        event: 'onChange',
        fn: EventCallback<{ oldNode: T; newNode: T; oldKey: unknown; newKey: unknown }[]>,
    ): this
    addListener(event: 'onChangeFull', fn: EventCallback<T[]>): this
    addListener(event: 'onRemove' | 'onAdd', fn: EventCallback<{ node: T; key: unknown }[]>): this
    addListener(event: string | symbol, fn: (...args: any[]) => void) {
        this.eventEmitter.addListener(event, fn)
        return this
    }
    emit(event: 'onChange', data: { oldNode: T; newNode: T; oldKey: unknown; newKey: unknown }[]): boolean
    emit(event: 'onChangeFull', data: T[]): boolean
    emit(event: 'onRemove' | 'onAdd', data: { node: T; key: unknown }[]): boolean
    emit(event: string | symbol, data: any) {
        return this.eventEmitter.emit(event, { data })
    }
    //#endregion
    /**
     * This virtualNode always point to the first node in the LiveSelector
     */
    readonly firstVirtualNode: RequireElement<T, DomProxy<ElementLikeT<T>, DomProxyBefore, DomProxyAfter>> = DomProxy(
        this.domProxyOption,
    ) as any
    //#region For multiple nodes injection
    /**
     * Map `Node -> Key`, in case of you don't want the default behavior
     */
    protected mapNodeToKey(node: T, index: number, arr: T[]): unknown {
        return node
    }
    /**
     * Compare between `key` and `key`, in case of you don't want the default behavior
     */
    protected keyComparer(a: unknown, b: unknown) {
        return a === b
    }
    /**
     * To help identify same nodes in different iteration,
     * you need to implement a map function that map `node` => `key`
     *
     * If the key is changed, the same node will call through `forEachRemove` then `forEach`
     *
     * @param assigner `node` => `key`, defaults to `node => node`
     * @param comparer compare between two keys, defaults to `===`
     */
    assignKeys<Q = unknown>(assigner: (node: T, index: number, arr: T[]) => Q, comparer?: (a: Q, b: Q) => boolean) {
        this.mapNodeToKey = assigner
        if (comparer) this.keyComparer = comparer
        return this
    }
    /** Saved useNodeForeach */
    protected useNodeForeachFn: Parameters<Watcher<T, DomProxyBefore, DomProxyAfter>['useNodeForeach']>[0] | null = null
    /**
     * Just like React hooks.
     *
     * @param fn you can return a set of functions that will be called on changes.
     * - `void`: No-op
     * - `((oldNode: T) => void)`: it will be called when the node is removed.
     * - `{ onRemove?: (old: T) => void; onTargetChanged?: (oldNode: T, newNode: T) => void; onNodeMutation?: (node: T) => void }`,
     * `onRemove` will be called when node is removed.
     * `onTargetChanged` will be called when the node is still existing but target has changed.
     * `onNodeMutation` will be called when the node is the same, but it inner content or attributes are modified.
     */
    useNodeForeach(
        fn: RequireElement<
            T,
            (
                virtualNode: DomProxy<ElementLikeT<T>, DomProxyBefore, DomProxyAfter>,
                key: unknown,
                realNode: T,
            ) => useNodeForeachReturns<T>
        >,
    ) {
        if (this.useNodeForeachFn) {
            console.warn("You can't chain useNodeForeach currently. The old one will be replaced.")
        }
        this.useNodeForeachFn = fn
        return this
    }

    /**
     * Get virtual node by key.
     * Virtual node will be unavailable if it is deleted
     * @param key Key used to find DomProxy
     */
    getVirtualNodeByKey(key: unknown) {
        return (
            this.lastVirtualNodesMap.get([...this.lastVirtualNodesMap.keys()].find(_ => this.keyComparer(_, key))) ||
            null
        )
    }
    //#endregion
}
