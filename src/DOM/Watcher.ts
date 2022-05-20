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
import { DOMProxy, DOMProxyOptions } from './Proxy.js'
import type { EventListener } from '@servie/events'
import type { LiveSelector } from './LiveSelector.js'

import { Deadline, requestIdleCallback } from '../util/requestIdleCallback.js'
import { isNil, uniqWith, intersectionWith, differenceWith } from 'lodash-es'
import { timeout } from '../util/timeout.js'
import { createEventTarget } from '../util/EventTarget.js'

/**
 * Use LiveSelector to watch dom change
 */
export abstract class Watcher<T, Before extends Element, After extends Element, SingleMode extends boolean>
    implements PromiseLike<ResultOf<SingleMode, T>>
{
    private events = createEventTarget<WatcherEvents<T>>()
    /**
     * The liveSelector that this object holds.
     */
    protected readonly liveSelector: LiveSelector<T, SingleMode>
    constructor(liveSelector: LiveSelector<T, SingleMode>) {
        this.liveSelector = liveSelector.clone()
    }
    //#region How to start and stop the watcher
    /** Let the watcher start to watching */
    public startWatch(...args: any[]): this {
        this.isWatching = true
        this._warning_forget_watch_.ignored = true
        this.watcherChecker()
        return this
    }
    /** Stop the watcher */
    public stopWatch(...args: any[]): void {
        this.isWatching = false
    }
    /** Is the watcher running */
    protected isWatching = false
    //#endregion
    //#region useForeach
    /** Saved useForeach */
    protected useForeachFn?: Parameters<Watcher<T, any, any, any>['useForeach']>[0]
    /**
     * Just like React hooks. Provide callbacks for each node changes.
     *
     * @param forEachFunction - You can return a set of functions that will be called on changes.
     *
     * @remarks
     *
     * Return value of `fn`
     *
     * - `void`: No-op
     *
     * - `((oldNode: T) => void)`: it will be called when the node is removed.
     *
     * - `{ onRemove?: (old: T) => void; onTargetChanged?: (newNode: T, oldNode: T) => void; onNodeMutation?: (node: T) => void }`,
     *
     * - - `onRemove` will be called when node is removed.
     *
     * - - `onTargetChanged` will be called when the node is still existing but target has changed.
     *
     * - - `onNodeMutation` will be called when the node is the same, but it inner content or attributes are modified.
     *
     * @example
     * ```
     * // ? if your LiveSelector return Element
     * watcher.useForeach((node, key, meta) => {
     *     console.log(node.innerHTML) // when a new key is found
     *     return {
     *         onRemove() { console.log('The node is gone!') },
     *         onTargetChanged() {
     *             console.log('Key is the same, but the node has changed!')
     *             console.log(node.innerHTML) // `node` is still the latest node!
     *             // appendChild, addEventListener will not lost too!
     *         },
     *         onNodeMutation() {
     *             console.log('Key and node are both the same, but node has been mutated.')
     *         }
     *     }
     * })
     *
     * // ? if your LiveSelector does not return Element but something else
     * watcher.useForeach((value, key) => {
     *     console.log(value) // your value here.
     *     return {
     *         onRemove() { console.log('The value is gone!') },
     *         onTargetChanged(value) {
     *             console.log('Key is the same, but the value has changed!')
     *             console.log(value) // New value
     *         }
     *     }
     * })
     *
     * ```
     */
    public useForeach(
        forEach: (
            element: T,
            key: unknown,
            metadata: T extends Node ? DOMProxy<T, Before, After> : unknown,
        ) => useForeachReturns<T>,
    ): this {
        if (this.useForeachFn) {
            console.warn("You can't chain useForeach currently. The old one will be replaced.")
        }
        this.useForeachFn = forEach
        return this
    }
    //#endregion
    //#region .then()
    protected defaultStarterForThen() {
        this.startWatch()
    }
    /**
     * Start the watcher, once it emitted data, stop watching.
     * @param map - Map function transform T to Result
     * @param options - Options for watcher
     *
     * @remarks This is an implementation of `PromiseLike`
     *
     * @example
     * ```ts
     * const value = await watcher
     * const value2 = await watcher(undefined, undefined, { minimalResultsRequired: 5 })
     * ```
     */
    // The PromiseLike<T> interface
    public then<TResult1 = ResultOf<SingleMode, T>, TResult2 = never>(
        onfulfilled?: ((value: ResultOf<SingleMode, T>) => TResult1 | PromiseLike<TResult1>) | null,
        onrejected?: ((reason: any) => TResult2 | PromiseLike<TResult2>) | null,
        options: { minimalResultsRequired?: number; timeout?: number } = {},
    ): Promise<TResult1 | TResult2> {
        this.defaultStarterForThen()
        const { minimalResultsRequired, timeout: timeoutTime } = {
            ...({
                minimalResultsRequired: 1,
                timeout: Infinity,
            } as Required<typeof options>),
            ...options,
        }
        let done: (state: boolean, val: any) => void = () => {}
        const then = async (): Promise<any> => {
            if (minimalResultsRequired < 1)
                throw new TypeError('Invalid minimalResultsRequired, must equal to or bigger than 1')
            if (this.singleMode && minimalResultsRequired > 1) {
                console.warn('In single mode, the watcher will ignore the option minimalResultsRequired')
            }
            const result = this.liveSelector.evaluate()
            if (Array.isArray(result) && result.length >= minimalResultsRequired) {
                // If we get the value now, return it
                return result
            } else if (this.singleMode) {
                // If in single mode, return the value now
                return result
            }
            // Or return a promise to wait the value
            return new Promise<ResultOf<SingleMode, TResult1>>((resolve, reject) => {
                done = (state, val) => {
                    this.stopWatch()
                    this.removeListener('onIteration', f)
                    if (state) resolve(val)
                    else reject(val)
                }
                const f = (v: WatcherEvents<T>['onIteration'][0]) => {
                    const nodes = Array.from(v.current.values())
                    if (this.singleMode && nodes.length >= 1) {
                        return done(true, nodes[0])
                    }
                    if (nodes.length < minimalResultsRequired) return
                    return done(true, nodes)
                }
                this.addListener('onIteration', f)
            })
        }
        const withTimeout = timeout(then(), timeoutTime)
        withTimeout.finally(() => done(false, new Error('timeout')))
        return withTimeout.then(onfulfilled, onrejected)
    }
    //#endregion
    //#region Multiple mode
    /** Found key list of last watch */
    protected lastKeyList: readonly unknown[] = []
    /** Found Node list of last watch */
    protected lastNodeList: readonly T[] = []
    /** Saved callback map of last watch */
    protected lastCallbackMap = new Map<unknown, useForeachReturns<T>>()
    /** Saved DOMProxy of last watch */
    protected lastDOMProxyMap = new Map<unknown, DOMProxy<any, Before, After>>()
    /** Find node from the given list by key */
    protected findNodeFromListByKey = (list: readonly T[], keys: readonly unknown[]) => (key: unknown) => {
        const i = keys.findIndex((x) => this.keyComparer(x, key))
        if (i === -1) return null
        return list[i]
    }
    /** Watcher callback with single mode is off */
    private normalModeWatcherCallback(currentIteration: readonly T[]) {
        /** Key list in this iteration */
        const thisKeyList: readonly unknown[] =
            this.mapNodeToKey === defaultMapNodeToKey ? currentIteration : currentIteration.map(this.mapNodeToKey)

        //#region Warn about repeated keys
        {
            const uniq = uniqWith(thisKeyList, this.keyComparer)
            if (uniq.length < thisKeyList.length) {
                this._warning_repeated_keys.warn(() =>
                    console.warn(
                        'There are repeated keys in your watcher. uniqKeys:',
                        uniq,
                        'allKeys:',
                        thisKeyList,
                        ', to omit this warning, call `.omitWarningForRepeatedKeys()`',
                    ),
                )
            }
        }
        //#endregion

        // New maps for the next generation
        /** Next generation Callback map */
        const nextCallbackMap = new Map<unknown, useForeachReturns<T>>()
        /** Next generation DOMProxy map */
        const nextDOMProxyMap = new Map<unknown, DOMProxy<any, Before, After>>()

        //#region Key is gone
        // Do: Delete node
        const findFromLast = this.findNodeFromListByKey(this.lastNodeList, this.lastKeyList)
        const goneKeys = differenceWith(this.lastKeyList, thisKeyList, this.keyComparer)
        {
            for (const oldKey of goneKeys) {
                const proxy = this.lastDOMProxyMap.get(oldKey)
                const callbacks = this.lastCallbackMap.get(oldKey)
                const node = findFromLast(oldKey)!
                this.requestIdleCallback(
                    () => {
                        applyUseForeachCallback(callbacks)('remove')(node)
                        if (proxy) proxy.destroy()
                    },
                    // Delete node don't need a short timeout.
                    { timeout: 2000 },
                )
            }
        }
        //#endregion

        //#region Key is new
        // Do: Add node
        const findFromNew = this.findNodeFromListByKey(currentIteration, thisKeyList)
        const newKeys = differenceWith(thisKeyList, this.lastKeyList, this.keyComparer)
        {
            for (const newKey of newKeys) {
                if (!this.useForeachFn) break
                const value = findFromNew(newKey)!
                if (value instanceof Node) {
                    const proxy = DOMProxy<typeof value, Before, After>(this.domProxyOption)
                    proxy.realCurrent = value
                    // This step must be sync.
                    const callbacks = this.useForeachFn(proxy.current, newKey, proxy as any)
                    if (hasMutationCallback(callbacks) && !proxy.observer.callback) {
                        proxy.observer.init = {
                            subtree: true,
                            childList: true,
                            characterData: true,
                            attributes: true,
                        }
                        proxy.observer.callback = (m) => callbacks.onNodeMutation?.(value, m)
                    }
                    nextCallbackMap.set(newKey, callbacks)
                    nextDOMProxyMap.set(newKey, proxy)
                } else {
                    const callbacks = this.useForeachFn(value, newKey, undefined as any)
                    applyUseForeachCallback(callbacks)('warn mutation')(this._warning_mutation_)
                    nextCallbackMap.set(newKey, callbacks)
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
            .map(
                (x) => [findFromLast(x), findFromNew(x), x, newSameKeys.find((newK) => this.keyComparer(newK, x))] as U,
            )
            .filter(([a, b]) => this.valueComparer(a, b) === false)
        for (const [oldNode, newNode, oldKey, newKey] of changedNodes) {
            const fn = this.lastCallbackMap.get(oldKey)
            if (newNode instanceof Node) {
                const proxy = this.lastDOMProxyMap.get(oldKey)!
                proxy.realCurrent = newNode
            }
            // This should be ordered. So keep it sync now.
            applyUseForeachCallback(fn)('target change')(newNode, oldNode)
        }
        //#endregion

        // Key is the same, node is the same
        // Do: nothing

        // #region Final: Copy the same keys
        for (const newKey of newSameKeys) {
            const oldKey = oldSameKeys.find((oldKey) => this.keyComparer(newKey, oldKey))
            nextCallbackMap.set(newKey, this.lastCallbackMap.get(oldKey))
            nextDOMProxyMap.set(newKey, this.lastDOMProxyMap.get(oldKey)!)
        }
        this.lastCallbackMap = nextCallbackMap
        this.lastDOMProxyMap = nextDOMProxyMap
        this.lastKeyList = thisKeyList
        this.lastNodeList = currentIteration

        if (this.events.has('onIteration') && changedNodes.length + goneKeys.length + newKeys.length > 0) {
            // Make a copy to prevent modifications
            const newMap = new Map<unknown, T>(newKeys.map((key) => [key, findFromNew(key)!]))
            const removedMap = new Map<unknown, T>(goneKeys.map((key) => [key, findFromLast(key)!]))
            const currentMap = new Map<unknown, T>(thisKeyList.map((key) => [key, findFromNew(key)!]))
            this.events.emit('onIteration', {
                new: newMap,
                removed: removedMap,
                current: currentMap,
            })
        }
        if (this.events.has('onChange'))
            for (const [oldNode, newNode, oldKey, newKey] of changedNodes) {
                this.events.emit('onChange', { oldValue: oldNode, newValue: newNode, oldKey, newKey })
            }
        if (this.events.has('onRemove'))
            for (const key of goneKeys) {
                this.events.emit('onRemove', { key, value: findFromLast(key)! })
            }
        if (this.events.has('onAdd'))
            for (const key of newKeys) {
                this.events.emit('onAdd', { key, value: findFromNew(key)! })
            }
        // For firstDOMProxy
        const first = currentIteration[0]
        if (first instanceof Node) {
            this._firstDOMProxy.realCurrent = first
        } else if (first === undefined || first === null) {
            this._firstDOMProxy.realCurrent = null
        }
        //#endregion

        //#region Prompt developer to open single mode
        if (currentIteration.length > 1) this._warning_single_mode.ignored = true
        if (currentIteration.length === 1) this._warning_single_mode.warn()
        //#endregion
    }
    //#endregion
    //#region Single mode
    /**
     * Is the single mode is on.
     */
    protected get singleMode(): boolean {
        // @ts-ignore
        return this.liveSelector.isSingleMode
    }
    /** Last iteration value for single mode */
    protected singleModeLastValue?: T
    /** Does it has a last iteration value in single mode? */
    protected singleModeHasLastValue = false
    /** Callback for single mode */
    protected singleModeCallback?: useForeachReturns<T>
    /** Watcher callback for single mode */
    private singleModeWatcherCallback(firstValue: T) {
        if (firstValue === undefined) {
            this.firstDOMProxy.realCurrent = null
        }
        if (firstValue instanceof Node) {
            this.firstDOMProxy.realCurrent = firstValue
        }
        if (hasMutationCallback(this.singleModeCallback) && !this._firstDOMProxy.observer.callback) {
            this._firstDOMProxy.observer.init = { attributes: true, characterData: true, subtree: true }
            this._firstDOMProxy.observer.callback = (e) =>
                hasMutationCallback(this.singleModeCallback) &&
                this.singleModeCallback.onNodeMutation(this._firstDOMProxy.current as any, e)
        }
        // ? Case: value is gone
        if (this.singleModeHasLastValue && isNil(firstValue)) {
            applyUseForeachCallback(this.singleModeCallback)('remove')(this.singleModeLastValue!)
            if (this.singleModeLastValue instanceof Node) {
                this._firstDOMProxy.realCurrent = null
            }
            this.events.emit('onRemove', { key: undefined, value: this.singleModeLastValue! })
            this.singleModeLastValue = undefined
            this.singleModeHasLastValue = false
        }
        // ? Case: value is new
        else if (!this.singleModeHasLastValue && Boolean(firstValue)) {
            if (this.useForeachFn) {
                if (firstValue instanceof Node) {
                    this.singleModeCallback = this.useForeachFn(
                        this.firstDOMProxy.current,
                        undefined,
                        this.firstDOMProxy,
                    )
                } else {
                    this.singleModeCallback = this.useForeachFn(firstValue, undefined, undefined as any)
                    applyUseForeachCallback(this.singleModeCallback)('warn mutation')(this._warning_mutation_)
                }
            }
            this.events.emit('onAdd', { key: undefined, value: firstValue })
            this.singleModeLastValue = firstValue
            this.singleModeHasLastValue = true
        }
        // ? Case: value has changed
        else if (this.singleModeHasLastValue && !this.valueComparer(this.singleModeLastValue!, firstValue)) {
            applyUseForeachCallback(this.singleModeCallback)('target change')(firstValue, this.singleModeLastValue!)
            this.events.emit('onChange', {
                newKey: undefined,
                oldKey: undefined,
                newValue: firstValue,
                oldValue: this.singleModeLastValue,
            })
            this.singleModeLastValue = firstValue
            this.singleModeHasLastValue = true
        }
        // ? Case: value is not changed
        else {
            // ? Do nothing
        }
        return
    }
    //#endregion
    //#region Watcher callback
    /** Should be called every watch */
    private watcherChecker = (deadline?: Deadline) => {
        if (!this.isWatching) return
        setTimeout(() => {
            const thisNodes: readonly T[] | T | undefined = this.liveSelector.evaluate()
            if (this.singleMode) return this.singleModeWatcherCallback(thisNodes as T)
            else return this.normalModeWatcherCallback(thisNodes as readonly T[])
        }, 0)
    }
    //#endregion
    //#region LiveSelector settings
    /**
     * The dom proxy option used in DOMProxy()
     */
    protected domProxyOption: Partial<DOMProxyOptions<Before, After>> = {}
    /**
     * Set option for DOMProxy
     * @param option - DOMProxy options
     */
    setDOMProxyOption(option: Partial<DOMProxyOptions<Before, After>>): this {
        this.domProxyOption = option
        const oldProxy = this._firstDOMProxy
        if (
            oldProxy.has('after') ||
            oldProxy.has('before') ||
            oldProxy.has('afterShadow') ||
            oldProxy.has('beforeShadow') ||
            oldProxy.realCurrent
        ) {
            console.warn("Don't set DOMProxy before using it.")
        }
        this._firstDOMProxy = DOMProxy(option)
        return this
    }
    //#endregion
    //#region events

    addListener<K extends keyof WatcherEvents<T>>(
        type: K,
        callback: EventListener<WatcherEvents<T>, K>,
        options?: AddEventListenerOptions,
    ): this {
        this.events.add(type, callback, options)
        return this
    }
    removeListener<K extends keyof WatcherEvents<T>>(type: K, callback: EventListener<WatcherEvents<T>, K>): this {
        this.events.remove(type, callback)
        return this
    }
    //#endregion
    //#region firstDOMProxy
    /** The first DOMProxy */
    protected _firstDOMProxy = DOMProxy<Node, Before, After>(this.domProxyOption)
    /**
     * This DOMProxy always point to the first node in the LiveSelector
     */
    public get firstDOMProxy() {
        return this._firstDOMProxy as unknown as T extends Node ? DOMProxy<T, Before, After> : never
    }
    //#endregion
    //#region Watcher settings
    /**
     * Map `Node -> Key`, in case of you don't want the default behavior
     */
    protected mapNodeToKey: (node: T, index: number, arr: readonly T[]) => unknown = defaultMapNodeToKey
    /**
     * Compare between `key` and `key`, in case of you don't want the default behavior
     */
    protected keyComparer: (a: unknown, b: unknown) => boolean = defaultEqualityComparer
    /**
     * Compare between `value` and `value`, in case of you don't want the default behavior
     */
    protected valueComparer: (a: T, b: T) => boolean = defaultEqualityComparer
    /**
     * To help identify same nodes in different iteration,
     * you need to implement a map function that map `node` to `key`
     *
     * If the key is changed, the same node will call through `forEachRemove` then `forEach`
     *
     * @param keyAssigner - map `node` to `key`, defaults to `node => node`
     *
     * @example
     * ```ts
     * watcher.assignKeys(node => node.innerText)
     * ```
     */
    public assignKeys<Q = unknown>(keyAssigner: (node: T, index: number, arr: readonly T[]) => Q) {
        this.noNeedInSingleMode(this.assignKeys.name)
        this.mapNodeToKey = keyAssigner
        return this
    }
    /**
     * To help identify same nodes in different iteration,
     * you need to implement a map function to compare `node` and `key`
     *
     * You probably don't need this.
     *
     * @param keyComparer - compare between two keys, defaults to `===`
     * @param valueComparer - compare between two value, defaults to `===`
     *
     * @example
     * ```ts
     * watcher.setComparer(
     *     (a, b) => JSON.stringify(a) === JSON.stringify(b),
     *     (a, b) => a.equals(b)
     * )
     * ```
     */
    public setComparer(keyComparer?: (a: unknown, b: unknown) => boolean, valueComparer?: (a: T, b: T) => boolean) {
        if (keyComparer) this.noNeedInSingleMode(this.setComparer.name)
        if (keyComparer) this.keyComparer = keyComparer
        if (valueComparer) this.valueComparer = valueComparer
        return this
    }
    //#endregion
    //#region Schedule a watcher callback run
    private isWatcherCheckerRunning = false
    private needCheckerRunAgainAfterCurrentSchedule = false
    /**
     * Schedule a watcher check
     */
    protected scheduleWatcherCheck = () => {
        if (this.isWatcherCheckerRunning) {
            this.needCheckerRunAgainAfterCurrentSchedule = true
            return
        }
        this.isWatcherCheckerRunning = true
        this.watcherChecker()
        // Now watcherChecker is sync so this path will run at most once.
        while (this.needCheckerRunAgainAfterCurrentSchedule) {
            this.watcherChecker()
            this.needCheckerRunAgainAfterCurrentSchedule = false
        }
        this.isWatcherCheckerRunning = false
    }
    //#endregion
    //#region Utils
    /**
     * Get DOMProxy by key.
     * DOMProxy will be unavailable if it is deleted
     * @param key - Key used to find DOMProxy
     */
    public getDOMProxyByKey(key: unknown) {
        this.noNeedInSingleMode(this.getDOMProxyByKey.name)
        return this.lastDOMProxyMap.get([...this.lastDOMProxyMap.keys()].find((_) => this.keyComparer(_, key))) || null
    }
    /** window.requestIdleCallback, or polyfill. */
    protected readonly requestIdleCallback = requestIdleCallback
    /** For debug usage. Just keep it. */
    private readonly stack = new Error().stack ?? ''
    //#endregion
    //#region Warnings
    /**
     * Warning to remember if developer forget to call the startWatch.
     */
    protected _warning_forget_watch_ = warning({
        fn: (stack) => console.warn('Did you forget to call `.startWatch()`?\n', stack),
    })
    /**
     * If you're expecting Watcher may not be called, call this function, this will omit the warning.
     */
    public omitWarningForForgetWatch() {
        this._warning_forget_watch_.ignored = true
        return this
    }
    private _warning_repeated_keys = warning({ once: true })
    /**
     * If you're expecting repeating keys, call this function, this will omit the warning.
     */
    public omitWarningForRepeatedKeys() {
        this.noNeedInSingleMode(this.omitWarningForRepeatedKeys.name)
        this._warning_repeated_keys.ignored = true
        return this
    }

    private _warning_single_mode = warning({
        once: 15,
        fn(stack) {
            console.warn(
                `Your watcher seems like only watching 1 node.
If you can make sure there is only 1 node to watch, call \`.enableSingleMode()\` on the watcher.
Or to ignore this message, call \`.dismissSingleModeWarning()\` on the watcher.\n`,
                stack,
            )
        },
    })
    /**
     * Dismiss the warning that let you enable single mode but the warning is false positive.
     */
    public dismissSingleModeWarning(): this {
        this._warning_single_mode.ignored = true
        return this
    }
    private noNeedInSingleMode(method: string) {
        if (this.singleMode) console.warn(`Method ${method} has no effect in SingleMode watcher`)
    }

    private _warning_mutation_ = warning({
        fn(stack) {
            console.warn('When watcher is watching LiveSelector<not Node>, onNodeMutation will not be ignored\n', stack)
        },
    })
    //#endregion
}

export interface WatcherEvents<T> {
    /**
     * @eventProperty
     */
    onIteration: [
        {
            new: Map<unknown, T>
            removed: Map<unknown, T>
            current: Map<unknown, T>
        },
    ]
    /**
     * @eventProperty
     */
    onChange: [
        {
            oldKey: unknown
            newKey: unknown
            oldValue?: T
            newValue: T
        },
    ]
    /**
     * @eventProperty
     */
    onRemove: [
        {
            key: unknown
            value: T
        },
    ]
    /**
     * @eventProperty
     */
    onAdd: [
        {
            key: unknown
            value: T
        },
    ]
}

//#region Default implementations
function defaultEqualityComparer(a: unknown, b: unknown) {
    return a === b
}
function defaultMapNodeToKey(node: unknown) {
    return node
}
//#endregion
//#region Events
// ? Event callbacks
/** Callback on Remove */
type RemoveCallback<T> = (oldNode: T) => void
/** Callback on target changed */
type TargetChangedCallback<T> = (newNode: T, oldNode: T) => void
/** Callback on  */
type MutationCallback<T> = (node: T, mutations: MutationRecord[]) => void
//#endregion
//#region useForeach types and helpers
/**
 * Return value of useForeach
 */
type useForeachObject<T> = {
    onRemove?: RemoveCallback<T>
    onTargetChanged?: TargetChangedCallback<T>
    /** This will not be called if T is not Node */
    onNodeMutation?: MutationCallback<T>
}
type useForeachReturns<T> = void | RemoveCallback<T> | useForeachObject<T>
function hasMutationCallback<T>(
    x: useForeachReturns<T>,
): x is useForeachObject<T> & Required<Pick<useForeachObject<T>, 'onNodeMutation'>> {
    if (typeof x !== 'object' || x === null) return false
    if ('onNodeMutation' in x && typeof x.onNodeMutation === 'function') return true
    return false
}
function applyUseForeachCallback<T>(callback: useForeachReturns<T>) {
    const cb = callback as useForeachReturns<Node>
    type f = undefined | ((...args: any[]) => any)
    let remove: f, change: f, mutation: f
    if (typeof cb === 'function') remove = cb
    else if (cb !== undefined) {
        const { onNodeMutation, onRemove, onTargetChanged } = cb
        ;[remove, change, mutation] = [onRemove, onTargetChanged, onNodeMutation]
    }
    // Return
    interface applyUseForeach {
        (type: 'remove'): RemoveCallback<T>
        (type: 'target change'): TargetChangedCallback<T>
        (type: 'warn mutation'): (x: ReturnType<typeof warning>) => void
    }
    return ((type: string) =>
        (...args: any[]) => {
            if (type === 'remove') remove && remove(...args)
            else if (type === 'target change') change && change(...args)
            else if (type === 'warn mutation') mutation && args[0]()
        }) as applyUseForeach
}
//#endregion
//#region Typescript generic helper
type ResultOf<SingleMode extends boolean, Result> = SingleMode extends true ? Result : Result[]
//#endregion
//#region Warnings
interface WarningOptions {
    /** warn only one time (or at nth time) pre instance, defaults to true */
    once: boolean | number
    /** only run in dev, defaults to false */
    dev: boolean
    /** default warn function */
    fn: (stack: string) => void
}
function warning(_: Partial<WarningOptions> = {}) {
    const { dev, once, fn } = { ...({ dev: false, once: true, fn: () => {} } as WarningOptions), ..._ }
    if (dev) if (process.env.NODE_ENV !== 'development') return { warn(f = fn) {}, ignored: true, stack: '' }
    const [_0, _1, _2, ...lines] = (new Error().stack ?? '').split('\n')
    const stack = lines.join('\n')
    let warned = 0
    const obj = {
        ignored: false,
        stack,
        warn(f = fn) {
            if (obj.ignored) return
            if (warned > 0 && Boolean(once)) return
            if (typeof once === 'number' && warned <= once) return
            warned = warned + 1
            f(stack)
        },
    }
    return obj
}
//#endregion
