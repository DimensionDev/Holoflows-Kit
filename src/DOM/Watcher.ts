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
import { DomProxy } from './Proxy'
import { EventEmitter } from 'events'
import { LiveSelector } from './LiveSelector'

import { differenceWith, intersectionWith, uniqWith } from 'lodash-es'

//#region Interface for Watcher
type RequireNode<T, V> = T extends Element ? V : never
interface SingleNodeWatcher<T> {
    /** The virtual node always point to the first result of the LiveSelector */
    firstVirtualNode: RequireNode<T, DomProxy>
}
type useWatchCallback<T> =
    | void
    | ((oldNode: T) => void)
    | {
          onRemove?: (old: T) => void
          onTargetChanged?: (oldNode: T, newNode: T) => void
          onNodeMutation?: (node: T) => void
      }
/** Watcher for multiple node */
interface MultipleNodeWatcher<T> {
    /**
     * To help identify same nodes in different iteration,
     * you need to implement a map function that map `node` => `key`
     *
     * If the key is changed, the same node will call through `forEachRemove` then `forEach`
     *
     * *Param map*: `node` => `key`, defaults to `node => node`
     *
     * *Param comparer*: compare between two keys, defaults to `===`
     */
    assignKeys: RequireNode<
        T,
        <Q = unknown>(
            assigner: (node: T, index: number, arr: T[]) => Q,
            comparer?: (a: Q, b: Q) => boolean,
        ) => Watcher<T>
    >
    useNodeForeach: RequireNode<
        T,
        (fn: (virtualNode: DomProxy, key: unknown, realNode: T) => useWatchCallback<T>) => Watcher<T>
    >
    /**
     * Get virtual node by key.
     * Virtual node will be unavailable if it is deleted
     */
    getVirtualNodeByKey: RequireNode<T, (key: unknown) => DomProxy>
}
//#endregion
type EventFn<T> = (fn: CustomEvent<T> & { data: T }) => void
/**
 * Use LiveSelector to watch dom change
 *
 * @abstract You need to implement `startWatch` and `stopWatch`
 */
export abstract class Watcher<T> extends EventEmitter implements SingleNodeWatcher<T>, MultipleNodeWatcher<T> {
    protected readonly nodeWatcher = new MutationWatcherHelper(this)
    constructor(protected liveSelector: LiveSelector<T>) {
        super()
        this.nodeWatcher.callback = (key, node) => {
            for (const [invariantKey, callbacks] of this.lastCallbackMap.entries()) {
                if (this.keyComparer(key, invariantKey)) {
                    if (typeof callbacks === 'object' && callbacks.onNodeMutation) {
                        callbacks.onNodeMutation(node as any)
                    }
                }
            }
        }
    }
    abstract startWatch(...args: any[]): this
    abstract stopWatch(...args: any[]): void
    //#region Watcher
    /** Is the watcher running */
    protected watching = false
    /** Found key list of last watch */
    protected lastKeyList: unknown[] = []
    /** Found Node list of last watch */
    protected lastNodeList: T[] = []
    /** Saved callback map of last watch */
    protected lastCallbackMap = new Map<unknown, useWatchCallback<T>>()
    /** Saved virtual node of last watch */
    protected lastVirtualNodesMap = new Map<unknown, DomProxy>()
    /** Find node from the given list by key */
    protected findNodeFromListByKey = (list: T[], keys: unknown[]) => (key: unknown) => {
        const i = keys.findIndex(x => this.keyComparer(x, key))
        if (i === -1) return null
        return list[i]
    }
    /** Should be called every watch */
    protected watcherCallback = () => {
        if (!this.watching) return

        const thisNodes = this.liveSelector.evaluateOnce()
        const thisKeyList = thisNodes.map(this.mapNodeToKey)

        //#region Warn about repeated keys
        {
            const uniq = uniqWith(thisKeyList, this.keyComparer)
            if (uniq.length < thisKeyList.length) {
                console.warn('There are repeated keys in your watcher. [uniqKeys, allKeys] = ', uniq, thisKeyList)
            }
        }
        //#endregion

        // New maps for the next generation
        const nextCallbackMap = new Map<unknown, useWatchCallback<T>>()
        const nextVirtualNodesMap = new Map<unknown, DomProxy>()

        //#region Key is gone
        // Do: Delete node
        const findFromLast = this.findNodeFromListByKey(this.lastNodeList, this.lastKeyList)
        const goneKeys = differenceWith(this.lastKeyList, thisKeyList, this.keyComparer)
        {
            for (const oldKey of goneKeys) {
                const virtualNode = this.lastVirtualNodesMap.get(oldKey)
                const callbacks = this.lastCallbackMap.get(oldKey)
                const node = findFromLast(oldKey)!
                if (node instanceof Node) this.nodeWatcher.removeNode(oldKey)
                if (callbacks) {
                    if (typeof callbacks === 'function') virtualNode && callbacks(virtualNode.realCurrent as any)
                    else if (callbacks.onRemove) {
                        callbacks.onRemove(node)
                    }
                }
                if (virtualNode) virtualNode.destroy()
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
                    this.nodeWatcher.addNode(newKey, node)

                    const virtualNode = DomProxy()
                    virtualNode.realCurrent = node

                    const callbacks = this.useNodeForeachFn(virtualNode, newKey, node)
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
                this.nodeWatcher.removeNode(oldKey)
                this.nodeWatcher.addNode(newKey, newNode)

                const virtualNode = this.lastVirtualNodesMap.get(oldKey)!
                virtualNode.realCurrent = newNode

                const fn = this.lastCallbackMap.get(oldKey)
                if (fn && typeof fn !== 'function' && fn.onTargetChanged) {
                    fn.onTargetChanged(oldNode, newNode)
                }
            }
        }
        //#endregion

        // Key is the same, node is the same
        // Do: nothing

        // Final: Copy the same keys
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
        if (first instanceof HTMLElement || first === undefined || first === null) {
            this.firstVirtualNode.realCurrent = first as any
        }
    }
    //#endregion

    //#region events
    addListener(event: 'onChange', fn: EventFn<{ oldNode: T; newNode: T; oldKey: unknown; newKey: unknown }[]>): this
    addListener(event: 'onChangeFull', fn: EventFn<T[]>): this
    addListener(event: 'onRemove' | 'onAdd', fn: EventFn<{ node: T; key: unknown }[]>): this
    addListener(event: string | symbol, fn: (...args: any[]) => void) {
        super.addListener(event, fn)
        return this
    }
    emit(event: 'onChange', data: { oldNode: T; newNode: T; oldKey: unknown; newKey: unknown }[]): boolean
    emit(event: 'onChangeFull', data: T[]): boolean
    emit(event: 'onRemove' | 'onAdd', data: { node: T; key: unknown }[]): boolean
    emit(event: string | symbol, data: any) {
        return super.emit(event, { data })
    }
    //#endregion
    /**
     * This virtualNode always point to the first node in the LiveSelector
     */
    public readonly firstVirtualNode: RequireNode<T, DomProxy> = DomProxy() as any
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
    public assignKeys: MultipleNodeWatcher<T>['assignKeys'] = ((
        ...args: Parameters<MultipleNodeWatcher<T>['assignKeys']>
    ) => {
        this.mapNodeToKey = args[0]
        if (args[1]) this.keyComparer = args[1]
        return this
    }) as any
    /** Saved useNodeForeach */
    protected useNodeForeachFn: Parameters<MultipleNodeWatcher<T>['useNodeForeach']>[0] | null = null
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
    public useNodeForeach: MultipleNodeWatcher<T>['useNodeForeach'] = ((
        ...args: Parameters<MultipleNodeWatcher<T>['useNodeForeach']>
    ) => {
        if (this.useNodeForeachFn) {
            console.warn("You can't chain useNodeForeach currently. The old one will be replaced.")
        }
        this.useNodeForeachFn = args[0]
        return this
    }) as any
    public getVirtualNodeByKey: MultipleNodeWatcher<T>['getVirtualNodeByKey'] = ((key: unknown) => {
        return this.lastVirtualNodesMap.get(
            [...this.lastVirtualNodesMap.keys()].find(_ => this.keyComparer(_, key)),
        ) as ReturnType<MultipleNodeWatcher<T>['getVirtualNodeByKey']>
    }) as any
    //#endregion
}

class MutationWatcherHelper<T> {
    constructor(private ref: Watcher<any>) {}
    /** Observer */
    private observer = new MutationObserver(this.onMutation.bind(this))
    /** Watching nodes */
    private nodesMap = new Map<unknown, Node>()
    /** Limit onMutation computation by rAF */
    private rAFLock = false
    private onMutation(mutations: MutationRecord[], observer: MutationObserver) {
        requestAnimationFrame(() => {
            if (this.rAFLock) return
            this.rAFLock = true
            for (const mutation of mutations) {
                for (const [key, node] of this.nodesMap.entries()) {
                    let cNode: Node | null = mutation.target
                    compare: while (cNode) {
                        if (cNode === node) {
                            this.callback(key, node)
                            break compare
                        }
                        cNode = cNode.parentNode
                    }
                }
            }
            this.rAFLock = false
        })
    }
    private readonly options = {
        attributes: true,
        characterData: true,
        childList: true,
        subtree: true,
    }
    callback = (key: unknown, node: Node) => {}
    addNode(key: unknown, node: Node) {
        this.observer.observe(node, this.options)
        this.nodesMap.set(key, node)
    }
    removeNode(key: unknown) {
        // No need to call this.observer.disconnect()
        // See: https://developer.mozilla.org/en-US/docs/Web/API/MutationObserver/observe
        // If you call observe() on a node that's already being observed by the same MutationObserver,
        // all existing observers are automatically removed from all targets being observed before the new observer is activated.
        // Access the protected `keyComparer` here
        const foundKey = Array.from(this.nodesMap.keys()).find(k => (this.ref as any).keyComparer(k, key))
        this.nodesMap.delete(foundKey)
        for (const node of this.nodesMap.values()) {
            this.observer.observe(node, this.options)
        }
    }
}
