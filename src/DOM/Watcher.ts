import { DomProxy } from './Proxy'
import { EventEmitter } from 'events'
import { LiveSelector } from './LiveSelector'

import { differenceWith, intersectionWith, uniqWith } from 'lodash-es'

type RequireNode<T, V> = T extends Element ? V : never
interface SingleNodeWatcher<T> {
    firstVirtualNode: RequireNode<T, DomProxy>
}
type EffectReturnFn<T> =
    | void
    | (() => void)
    | {
          remove?: (old: T) => void
          onCurrentChange: (old: T, newT: T) => void
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
    /**
     * Just like React hooks.
     *
     * @param fn will be called every node update.
     * If `fn` return a `function`, when `node` removed from the list, it will be called.
     */
    useNodeForeach: RequireNode<
        T,
        (fn: (virtualNode: DomProxy, key: unknown, realNode: T) => EffectReturnFn<T>) => Watcher<T>
    >
    /**
     * Get virtual node by key.
     * Virtual node will be unavailable if it is deleted
     */
    getVirtualNodeByKey: RequireNode<T, (key: unknown) => DomProxy>
}
type EventFn<T> = (fn: CustomEvent<T> & { data: T }) => void
/** Use LiveSelector to watch dom change
 *
 * **You must call `stopWatch` if you won't use it anymore**
 */
export abstract class Watcher<T> extends EventEmitter implements SingleNodeWatcher<T>, MultipleNodeWatcher<T> {
    constructor(protected liveSelector: LiveSelector<T>) {
        super()
    }
    abstract startWatch(...args: any[]): this
    abstract stopWatch(...args: any[]): void
    //#region Watcher
    protected watching = false
    protected lastKeyList: unknown[] = []
    protected lastNodeList: T[] = []
    protected lastUndoEffectMap = new Map<unknown, EffectReturnFn<T>>()
    protected lastVirtualNodesMap = new Map<unknown, DomProxy>()
    protected findNodeFromListByKey = (list: T[], keys: unknown[]) => (key: unknown) => {
        const i = keys.findIndex(x => this.keyComparer(x, key))
        if (i === -1) return null
        return list[i]
    }
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

        // New maps in the next generation
        const nextUndoEffectMap = new Map<unknown, EffectReturnFn<T>>()
        const nextVirtualNodesMap = new Map<unknown, DomProxy>()

        //#region Key is gone
        // Do: Delete node
        const findFromLast = this.findNodeFromListByKey(this.lastNodeList, this.lastKeyList)
        const goneKeys = differenceWith(this.lastKeyList, thisKeyList, this.keyComparer)
        {
            for (const oldKey of goneKeys) {
                const virtualNode = this.lastVirtualNodesMap.get(oldKey)
                if (virtualNode) virtualNode.destroy()
                const undoFn = this.lastUndoEffectMap.get(oldKey)
                if (undoFn)
                    typeof undoFn === 'function'
                        ? undoFn()
                        : typeof undoFn.remove === 'function' && undoFn.remove(findFromLast(oldKey))
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
                    const virtualNode = DomProxy()
                    virtualNode.realCurrent = node
                    const undoFn = this.useNodeForeachFn(virtualNode, newKey, node)
                    nextUndoEffectMap.set(newKey, undoFn)
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
        for (const [oldNode, newNode, oldKey] of changedNodes) {
            if (newNode instanceof Element) {
                const virtualNode = this.lastVirtualNodesMap.get(oldKey)
                virtualNode.realCurrent = newNode
                const fn = this.lastUndoEffectMap.get(oldKey)
                if (fn) typeof fn === 'function' ? undefined : fn.onCurrentChange(oldNode, newNode)
            }
        }
        //#endregion

        // Key is the same, node is the same
        // Do: nothing

        // Final: Copy the same keys
        for (const newKey of newSameKeys) {
            const oldKey = oldSameKeys.find(oldKey => this.keyComparer(newKey, oldKey))
            nextUndoEffectMap.set(newKey, this.lastUndoEffectMap.get(oldKey))
            nextVirtualNodesMap.set(newKey, this.lastVirtualNodesMap.get(oldKey))
            this.lastUndoEffectMap = nextUndoEffectMap
            this.lastVirtualNodesMap = nextVirtualNodesMap
        }
        this.lastKeyList = thisKeyList
        this.lastNodeList = thisNodes

        this.emit('onChangeFull', thisNodes)
        this.emit(
            'onChange',
            changedNodes.map(([oldNode, newNode, oldKey, newKey]) => ({ oldNode, newNode, oldKey, newKey })),
        )
        this.emit('onRemove', goneKeys.map(key => ({ key, node: findFromLast(key) })))
        this.emit('onAdd', newKeys.map(key => ({ key, node: findFromNew(key) })))

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
    addListener(event: 'onRemove', fn: EventFn<{ node: T; key: unknown }[]>): this
    addListener(event: 'onAdd', fn: EventFn<{ node: T; key: unknown }[]>): this
    addListener(event: string | symbol, fn: (...args: any[]) => void) {
        super.addListener(event, fn)
        return this
    }
    emit(event: 'onChange', data: { oldNode: T; newNode: T; oldKey: unknown; newKey: unknown }[]): boolean
    emit(event: 'onChangeFull', data: T[]): boolean
    emit(event: 'onRemove', data: { node: T; key: unknown }[]): boolean
    emit(event: 'onAdd', data: { node: T; key: unknown }[]): boolean
    emit(event: string | symbol, data: any) {
        return super.emit(event, { data })
    }
    //#endregion
    /**
     * This virtualNode always point to the first node in the LiveSelector
     */
    firstVirtualNode: RequireNode<T, DomProxy> = DomProxy() as any
    //#region For multiple nodes injection
    protected mapNodeToKey: Parameters<MultipleNodeWatcher<T>['assignKeys']>[0] = node => node
    protected keyComparer(a: unknown, b: unknown) {
        return a === b
    }
    assignKeys: MultipleNodeWatcher<T>['assignKeys'] = ((...args: Parameters<MultipleNodeWatcher<T>['assignKeys']>) => {
        this.mapNodeToKey = args[0]
        if (args[1]) this.keyComparer = args[1]
        return this
    }) as any
    protected useNodeForeachFn: Parameters<MultipleNodeWatcher<T>['useNodeForeach']>[0] | null = null
    useNodeForeach: MultipleNodeWatcher<T>['useNodeForeach'] = ((
        ...args: Parameters<MultipleNodeWatcher<T>['useNodeForeach']>
    ) => {
        this.useNodeForeachFn = args[0]
        return this
    }) as any
    getVirtualNodeByKey: MultipleNodeWatcher<T>['getVirtualNodeByKey'] = ((key: unknown) => {
        return this.lastVirtualNodesMap.get(
            [...this.lastVirtualNodesMap.keys()].find(_ => this.keyComparer(_, key)),
        ) as ReturnType<MultipleNodeWatcher<T>['getVirtualNodeByKey']>
    }) as any
    //#endregion
}
