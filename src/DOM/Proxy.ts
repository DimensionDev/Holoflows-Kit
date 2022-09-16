import { Emitter } from '@servie/events'

/**
 * Options for DOMProxy
 */
export interface DOMProxyOptions<Before extends Element = HTMLSpanElement, After extends Element = HTMLSpanElement> {
    /** Create the `before` node of the DOMProxy */ createBefore(): Before
    /** Create the `after` node of the DOMProxy */ createAfter(): After
    /** ShadowRootInit for creating the shadow of `before` */ beforeShadowRootInit: ShadowRootInit
    /** ShadowRootInit for creating the shadow of `after` */ afterShadowRootInit: ShadowRootInit
}
/**
 * DOMProxy provide an interface that be stable even dom is changed.
 *
 * @remarks
 *
 * DOMProxy provide 3 nodes. `before`, `current` and `after`.
 * `current` is a fake dom node powered by Proxy,
 * it will forward all your operations to the `realCurrent`.
 *
 * `before` and `after` is a true `span` that always point to before and after of `realCurrent`
 *
 * Special Handlers:
 *
 * *forward*: forward to current `realCurrent`
 *
 * *undo*: undo effect when `realCurrent` changes
 *
 * *move*: move effect to new `realCurrent`
 *
 * - style (forward, undo, move)
 * - addEventListener (forward, undo, move)
 * - appendChild (forward, undo, move)
 */
export function DOMProxy<
    ProxiedElement extends Node = HTMLElement,
    Before extends Element = HTMLSpanElement,
    After extends Element = HTMLSpanElement,
>(options: Partial<DOMProxyOptions<Before, After>> = {}): DOMProxy<ProxiedElement, Before, After> {
    const event = new Emitter<DOMProxyEvents<ProxiedElement>>()
    // Options
    const { createAfter, createBefore, afterShadowRootInit, beforeShadowRootInit } = {
        ...({
            createAfter: () => document.createElement('span'),
            createBefore: () => document.createElement('span'),
            afterShadowRootInit: { mode: 'open' },
            beforeShadowRootInit: { mode: 'open' },
        } as DOMProxyOptions),
        ...options,
    } as DOMProxyOptions<Before, After>
    //
    let isDestroyed = false
    // Nodes
    let virtualBefore: Before | null = null
    let virtualBeforeShadow: ShadowRoot | null = null
    const defaultCurrent = document.createElement('div')
    let current: Node = defaultCurrent
    let virtualAfter: After | null = null
    let virtualAfterShadow: ShadowRoot | null = null
    /** All changes applied on the `proxy` */
    const changes: ActionTypes[keyof ActionTypes][] = []
    /** Proxy Traps */
    const proxyTraps: ProxyHandler<Node> = {
        get: (t, key, r) => {
            const current_: any = current
            if (typeof current_[key] === 'function')
                return new Proxy(current_[key], {
                    apply: (target, thisArg, args) => {
                        changes.push({ type: 'callMethods', op: { name: key, param: args, thisArg } })
                        return current_[key](...args)
                    },
                })
            else if (key === 'style')
                return new Proxy((current as HTMLElement).style, {
                    set: (t, styleKey, styleValue, r) => {
                        changes.push({
                            type: 'modifyStyle',
                            op: { name: styleKey, value: styleValue, originalValue: current_.style[styleKey] },
                        })
                        current_.style[styleKey] = styleValue
                        return true
                    },
                })
            return current_[key]
        },
        deleteProperty: (t, key: keyof HTMLElement) => {
            changes.push({ type: 'delete', op: key })
            return Reflect.deleteProperty(current, key)
        },
        set: (t, key: keyof HTMLElement, value, r) => {
            changes.push({ type: 'set', op: [key, value] })
            return ((current as any)[key] = value)
        },
        defineProperty: (t, key, attributes) => {
            changes.push({ type: 'defineProperty', op: [key, attributes] })
            return Reflect.defineProperty(current, key, attributes)
        },
        preventExtensions: (t) => {
            changes.push({ type: 'preventExtensions', op: undefined })
            return Reflect.preventExtensions(current)
        },
        setPrototypeOf: (t, prototype) => {
            changes.push({ type: 'setPrototypeOf', op: prototype })
            return Reflect.setPrototypeOf(current, prototype)
        },
    }
    const proxy = Proxy.revocable(defaultCurrent, proxyTraps)
    function hasStyle(e: Node): e is HTMLElement {
        return 'style' in e
    }
    /** Call before realCurrent change */
    function undoEffects(nextCurrent?: Node | null) {
        for (const change of changes) {
            if (change.type === 'callMethods') {
                const attr: keyof HTMLElement = change.op.name as any
                if (attr === 'addEventListener') {
                    current.removeEventListener(...(change.op.param as [any, any, any]))
                } else if (attr === 'appendChild') {
                    if (!nextCurrent) {
                        const node = (change.op.thisArg as Parameters<HTMLElement['appendChild']>)[0]
                        if (node !== undefined) current.removeChild(node)
                    }
                }
            } else if (change.type === 'modifyStyle') {
                const { name, value, originalValue } = change.op
                if (hasStyle(current)) {
                    current.style[name as any] = originalValue
                }
            }
        }
    }
    /** Call after realCurrent change */
    function redoEffects() {
        if (current === defaultCurrent) return
        const t = {}
        for (const change of changes) {
            if (change.type === 'setPrototypeOf') Reflect.setPrototypeOf(current, change.op)
            else if (change.type === 'preventExtensions') Reflect.preventExtensions(current)
            else if (change.type === 'defineProperty') Reflect.defineProperty(current, change.op[0], change.op[1])
            else if (change.type === 'set') Reflect.set(current, change.op[0], change.op[1], t)
            else if (change.type === 'delete') Reflect.deleteProperty(current, change.op)
            else if (change.type === 'callMethods') {
                const replayable = ['appendChild', 'addEventListener', 'before', 'after']
                const key: keyof Node = change.op.name as any
                if (replayable.indexOf(key) !== -1) {
                    if (current[key] !== undefined) {
                        ;(current[key] as any)(...change.op.param)
                    } else {
                        console.warn(current, `doesn't have method "${key}", replay failed.`)
                    }
                }
            } else if (change.type === 'modifyStyle') {
                ;(current as HTMLElement).style[change.op.name as any] = change.op.value
            }
        }
    }
    // MutationObserver
    const noop: MutationCallback = () => {}
    let observerCallback = noop
    let mutationObserverInit: MutationObserverInit | undefined = undefined
    let observer: MutationObserver | null = null
    function reObserve(reinit: boolean) {
        observer && observer.disconnect()
        if (observerCallback === noop || current === defaultCurrent) return
        if (reinit || !observer) observer = new MutationObserver(observerCallback)
        observer.observe(current, mutationObserverInit)
    }
    const DOMProxyObject = {
        observer: {
            set callback(v) {
                if (v === undefined) v = noop
                observerCallback = v
                reObserve(true)
            },
            get callback() {
                return observerCallback
            },
            get init() {
                return mutationObserverInit
            },
            set init(v) {
                mutationObserverInit = v
                reObserve(false)
            },
            get observer() {
                return observer
            },
        },
        get destroyed() {
            return isDestroyed
        },
        get before() {
            if (isDestroyed) throw new TypeError('Try to access `before` node after DOMProxy is destroyed')
            if (!virtualBefore) {
                virtualBefore = createBefore()
                if (current instanceof Element) current.before(virtualBefore)
            }
            return virtualBefore
        },
        get beforeShadow(): ShadowRoot {
            if (!virtualBeforeShadow) virtualBeforeShadow = this.before.attachShadow(beforeShadowRootInit)
            return virtualBeforeShadow
        },
        get current(): ProxiedElement {
            if (isDestroyed) throw new TypeError('Try to access `current` node after DOMProxy is destroyed')
            return proxy.proxy as ProxiedElement
        },
        get after(): After {
            if (isDestroyed) throw new TypeError('Try to access `after` node after DOMProxy is destroyed')
            if (!virtualAfter) {
                virtualAfter = createAfter()
                if (current instanceof Element) current.after(virtualAfter)
            }
            return virtualAfter
        },
        get afterShadow(): ShadowRoot {
            if (!virtualAfterShadow) virtualAfterShadow = this.after.attachShadow(afterShadowRootInit)
            return virtualAfterShadow
        },
        has(type: 'beforeShadow' | 'afterShadow' | 'before' | 'after'): any | null {
            if (type === 'before') return virtualBefore
            else if (type === 'after') return virtualAfter
            else if (type === 'afterShadow') return virtualAfterShadow
            else if (type === 'beforeShadow') return virtualBeforeShadow
            else return null
        },
        get realCurrent(): ProxiedElement | null {
            if (isDestroyed) return null
            if (current === defaultCurrent) return null
            return current as any
        },
        set realCurrent(node: ProxiedElement | null) {
            const old: ProxiedElement | null = current as any
            if (isDestroyed) throw new TypeError('You can not set current for a destroyed proxy')
            if (node === current) return
            if ((node === virtualAfter || node === virtualBefore) && node !== null) {
                console.warn(
                    "In the DOMProxy, you're setting .realCurrent to this DOMProxy's virtualAfter or virtualBefore. Doing this may cause bugs. If you're confused with this warning, check your rules for LiveSelector.",
                    this,
                )
            }
            undoEffects(node)
            reObserve(false)
            if (node === null || node === undefined) {
                current = defaultCurrent
                if (virtualBefore) virtualBefore.remove()
                if (virtualAfter) virtualAfter.remove()
            } else {
                current = node
                if (virtualAfter && current instanceof Element) current.after(virtualAfter)
                if (virtualBefore && current instanceof Element) current.before(virtualBefore)
                redoEffects()
            }
            event.emit('currentChanged', { new: node, old })
        },
        destroy() {
            observer && observer.disconnect()
            isDestroyed = true
            proxy.revoke()
            virtualBeforeShadow = null
            virtualAfterShadow = null
            if (virtualBefore) virtualBefore.remove()
            if (virtualAfter) virtualAfter.remove()
            virtualBefore = null
            virtualAfter = null
            current = defaultCurrent
        },
    } as DOMProxy<ProxiedElement, Before, After>
    Object.defineProperties(event, Object.getOwnPropertyDescriptors(DOMProxyObject))
    return event as any
}

/**
 * {@inheritdoc (DOMProxy:function)}
 */
export interface DOMProxy<
    ProxiedElement extends Node = HTMLElement,
    Before extends Element = HTMLSpanElement,
    After extends Element = HTMLSpanElement,
> extends DOMProxy_Properties<ProxiedElement, Before, After> {
    on(
        type: 'currentChanged',
        fn: (data: { new: ProxiedElement | null; old: ProxiedElement | null }) => void,
    ): () => void
}

/**
 * {@inheritdoc (DOMProxy:function)}
 */
export interface DOMProxy_Properties<ProxiedElement extends Node, Before extends Element, After extends Element> {
    /** Destroy the DOMProxy */
    destroy(): void
    readonly destroyed: boolean
    /** Returns the `before` element, if it doesn't exist, create it implicitly. */
    readonly before: Before
    /** Returns the `ShadowRoot` of the `before` element. */
    readonly beforeShadow: ShadowRoot
    /**
     * A proxy that always point to `realCurrent`,
     * and if `realCurrent` changes, all action will be forwarded to new `realCurrent`
     */
    readonly current: ProxiedElement
    /** Returns the `after` element, if it doesn't exist, create it implicitly. */
    readonly after: After
    /** Returns the `ShadowRoot` of the `after` element. */
    readonly afterShadow: ShadowRoot
    /** Get weak reference to `before` node */
    has(type: 'before'): Before | null
    /** Get weak reference to `after` node */
    has(type: 'after'): After | null
    /** Get weak reference to `beforeShadow` or `afterShadow` node */
    has(type: 'beforeShadow' | 'afterShadow'): ShadowRoot | null
    /**
     * The real current of the `current`
     */
    realCurrent: ProxiedElement | null
    /**
     * Observer for the current node.
     * You need to set callback and init to activate it.
     */
    readonly observer: DOMProxy_MutationObserver
}

/**
 * The proxied MutationObserver. You need to set callback and init to activate it.
 */
export interface DOMProxy_MutationObserver {
    /**
     * The proxied of MutationObserver of this DOMProxy
     */
    readonly observer: MutationObserver | null
    /**
     * Get the callback of the MutationObserver
     */
    get callback(): MutationCallback | undefined
    set callback(callback: MutationCallback | undefined)
    /**
     * Get the init parameter of the MutationObserver
     */
    get init(): MutationObserverInit | undefined
    set init(init: MutationObserverInit | undefined)
}

/** Events that DOMProxy supported */
export interface DOMProxyEvents<ProxiedElement extends Node> {
    currentChanged: [{ new: ProxiedElement | null; old: ProxiedElement | null }]
}

interface ActionTypes {
    delete: { type: 'delete'; op: PropertyKey }
    set: { type: 'set'; op: [PropertyKey, unknown] }
    defineProperty: { type: 'defineProperty'; op: [PropertyKey, PropertyDescriptor] }
    preventExtensions: { type: 'preventExtensions'; op: void }
    setPrototypeOf: { type: 'setPrototypeOf'; op: object | null }
    callMethods: { type: 'callMethods'; op: { name: PropertyKey; param: any[]; thisArg: any } }
    modifyStyle: { type: 'modifyStyle'; op: { name: PropertyKey; value: string; originalValue: string } }
}
