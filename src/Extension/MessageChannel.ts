import { NoSerialization } from 'async-call-rpc'
import { Serialization } from './MessageCenter'
import { Emitter } from '@servie/events'
import { EventIterator } from 'event-iterator'
import { Environment, getEnvironment, isEnvironment } from './Context'

export enum MessageTarget {
    /** Current execution context */ IncludeLocal = 1 << 20,
    LocalOnly = 1 << 21,
    /** Visible page, maybe have more than 1 page. */ VisiblePageOnly = 1 << 22,
    /** Page that has focus (devtools not included), 0 or 1 page. */ FocusedPageOnly = 1 << 23,
    /** Send to external. */ External = 1 << 24,
    /** Externals not included */ Broadcast = Environment.HasBrowserAPI,
    All = Broadcast | IncludeLocal,
}
export interface TargetBoundEventRegistry<T> {
    /** @returns A function to remove the listener */
    on(callback: (data: T) => void): () => void
    off(callback: (data: T) => void): void
    send(data: T): void
    /**
     * Pausing the dispatch of this event. Collect all new incoming events.
     * @param reducer When resuming the dispatch of events, all pausing data will be passed into this function. Return value of the reducer will be used as the final result for dispatching. Every target will have a unique call to the reducer.
     * @returns A function that resume the dispatching
     */
    pause(): (reducer?: (data: T[]) => T[]) => Promise<void>
}
// export interface EventTargetRegistry<T> extends EventTarget {}
// export interface EventEmitterRegistry<T> extends NodeJS.EventEmitter {}
export interface UnboundedRegistry<T> extends Omit<TargetBoundEventRegistry<T>, 'send'>, AsyncIterable<T> {
    // For different send targets
    send(target: MessageTarget | Environment, data: T): void
    sendToLocal(data: T): void
    sendToBackgroundPage(data: T): void
    sendToContentScripts(data: T): void
    sendToVisiblePages(data: T): void
    sendToFocusedPage(data: T): void
    sendByBroadcast(data: T): void
    sendToAll(data: T): void
    /** You may create a bound version that have a clear interface. */
    bind(target: MessageTarget | Environment): TargetBoundEventRegistry<T>
}
export interface WebExtensionMessageOptions {
    /** The "domain" of the message. Messages within different domain won't affect each other. */
    readonly domain?: string
    /**
     * Use this when connect from a normal web page.
     * You must configure externally_connectable to make it work.
     *
     * DO NOT use it to connect between two extensions!
     *
     * ONLY use it in a normal webpage.
     *
     * PLEASE make sure to call acceptExternalConnect otherwise it will not work.
     */
    readonly externalExtensionID?: string
}
const throwSetter = () => {
    throw new TypeError()
}
type BackgroundOnlyLivingPortsInfo = {
    sender?: browser.runtime.MessageSender
    environment?: Environment
    external?: boolean
}

// Only available in background page
const backgroundOnlyLivingPorts = new Map<browser.runtime.Port, BackgroundOnlyLivingPortsInfo>()
// Only be set in other pages
let currentTabID = -1
let externalMode = false
// Shared global
let postMessage: undefined | ((message: number | InternalMessageType) => void) = undefined
const domainRegistry = new Emitter<Record<string, [InternalMessageType]>>()
const constant = '@holoflows/kit/WebExtensionMessage/setup'
export type ShouldAcceptExternalConnectionResult =
    | boolean
    | {
          /** Be careful, acceptAs will treat it as a internal connection, not an external one */
          acceptAs: Environment
      }
export type ShouldAcceptExternalConnection = (
    sender: browser.runtime.MessageSender,
) => ShouldAcceptExternalConnectionResult
export class WebExtensionMessage<Message> {
    // Only execute once.
    private static setup(id: string | undefined) {
        if (id) externalMode = true
        if (isEnvironment(Environment.ManifestBackground)) {
            // Wait for other pages to connect
            browser.runtime.onConnect.addListener((port) => {
                if (port.name !== constant) return // not for ours
                const sender = port.sender
                backgroundOnlyLivingPorts.set(port, { sender })
                backgroundPortBoarding(port, sender)
            })
            WebExtensionMessage.setup = () => {}
            postMessage = backgroundPageMessageHandler
        } else {
            function reconnect() {
                const port = id
                    ? // @ts-ignore
                      chrome.runtime.connect(id, { name: constant })
                    : browser.runtime.connect({ name: constant })
                postMessage = otherEnvMessageHandler.bind(port)
                // don't reconnect when external connect
                otherEnvPortBoarding(port, id ? () => {} : reconnect)
            }
            reconnect()
            WebExtensionMessage.setup = () => {}
        }
    }
    private static acceptExternalConnectFns = new Set<ShouldAcceptExternalConnection>()
    /** If the connection is not accepted, it will be passed to the next handler until it is handled or no more handlers */
    static acceptExternalConnect(acceptExternalConnectFn: ShouldAcceptExternalConnection) {
        this.acceptExternalConnectFns.add(acceptExternalConnectFn)
        if (!isEnvironment(Environment.ManifestBackground)) return
        // Wait for other pages to connect
        // @ts-ignore
        const c: typeof browser = chrome
        c.runtime.onConnectExternal.addListener((port) => {
            if (port.name !== constant) return // not for ours
            const sender = port.sender
            if (!sender) return port.disconnect()
            let accepted = false
            for (const each of this.acceptExternalConnectFns) {
                const result = each(sender)
                if (!result) continue
                if (result === true) backgroundOnlyLivingPorts.set(port, { sender, external: true, environment: 0 })
                else backgroundOnlyLivingPorts.set(port, { sender, environment: result.acceptAs })
                accepted = true
                break
            }
            if (!accepted) return port.disconnect()
            backgroundPortBoarding(port, sender)
        })
        this.acceptExternalConnect = (f) => void this.acceptExternalConnectFns.add(f)
        postMessage = backgroundPageMessageHandler
    }
    #domain: string
    /** Same message name within different domain won't collide with each other. */
    get domain() {
        return this.#domain
    }
    /**
     * @param options WebExtensionMessage options
     */
    constructor(options?: WebExtensionMessageOptions) {
        // invoke the warning if needed
        getEnvironment()
        try {
            if (options?.externalExtensionID) {
                WebExtensionMessage.setup(options.externalExtensionID)
            } else {
                typeof browser === 'object' && browser && WebExtensionMessage.setup(undefined)
            }
        } catch (e) {
            console.error('Setup failed', e)
        }
        const domain = (this.#domain = options?.domain ?? '')

        domainRegistry.on(domain, async (payload: InternalMessageType) => {
            if (!isInternalMessageType(payload)) return
            let { event, data, target } = payload
            if (!shouldAcceptThisMessage(target)) return
            data = await this.serialization.deserialization(data)
            if (this.enableLog) {
                this.log(...this.logFormatter(this, event, data))
            }
            this.#eventRegistry.emit(event, data)
        })
    }
    //#region Simple API
    #events: any = new Proxy({ __proto__: null } as any, {
        get: (cache, event) => {
            if (typeof event !== 'string') throw new Error('Only string can be event keys')
            if (cache[event]) return cache[event]
            const registry = UnboundedRegistry(this, event, this.#eventRegistry)
            Object.defineProperty(cache, event, { value: registry })
            return registry
        },
        defineProperty: () => false,
        setPrototypeOf: () => false,
        set: throwSetter,
    })
    /** Event listeners */
    get events(): { readonly [K in keyof Message]: UnboundedRegistry<Message[K]> } {
        return this.#events
    }
    //#endregion

    // declare readonly eventTarget: { readonly [key in keyof Message]: UnboundedRegister<Message[key], EventTargetRegister<Message>> }
    // declare readonly eventEmitter: { readonly [key in keyof Message]: UnboundedRegister<Message[key], EventEmitterRegister<Message>> }
    /**
     * Watch new tabs created and get event listener register of that tab.
     *
     * This API only works in the BackgroundPage.
     */
    public serialization: Serialization = NoSerialization
    public logFormatter: (instance: this, key: string, data: unknown) => unknown[] = (instance, key, data) => {
        return [
            `%cReceive%c %c${String(key)}`,
            'background: rgba(0, 255, 255, 0.6); color: black; padding: 0px 6px; border-radius: 4px;',
            '',
            'text-decoration: underline',
            data,
        ]
    }
    public enableLog = false
    public log: (...args: unknown[]) => void = console.log
    #eventRegistry: EventRegistry = new Emitter<any>()
    protected get eventRegistry() {
        return this.#eventRegistry
    }
}
//#region Internal message handling
type InternalMessageType = {
    domain: string
    event: string
    data: unknown
    target: BoundTarget
}
function isInternalMessageType(e: unknown): e is InternalMessageType {
    if (typeof e !== 'object' || e === null) return false
    const { domain, event, target } = e as InternalMessageType
    // Message is not for us
    if (typeof domain !== 'string') return false
    if (typeof event !== 'string') return false
    if (typeof target !== 'object' || target === null) return false
    return true
}
function shouldAcceptThisMessage(target: BoundTarget) {
    if (target.kind === 'tab') return target.id === currentTabID && currentTabID !== -1
    if (target.kind === 'port') return true
    const flag = target.target
    if (flag & (MessageTarget.IncludeLocal | MessageTarget.LocalOnly)) return true
    const here = getEnvironment()
    if (flag & MessageTarget.FocusedPageOnly) return typeof document === 'object' && document?.hasFocus?.()
    if (flag & MessageTarget.VisiblePageOnly) {
        // background page has document.visibilityState === 'visible' for reason I don't know why
        if (here & Environment.ManifestBackground) return false
        return typeof document === 'object' && document?.visibilityState === 'visible'
    }
    if (externalMode) return true // skip mode checking for external connection
    return Boolean(here & flag)
}
//#endregion

function UnboundedRegistry<T>(
    instance: WebExtensionMessage<T>,
    eventName: string,
    eventListener: Emitter<any>,
): UnboundedRegistry<T> {
    //#region Batch message
    let pausing = false
    const pausingMap = new Map<Environment | MessageTarget, T[]>()
    //#endregion
    async function send(target: MessageTarget | Environment, data: T) {
        if (typeof target !== 'number') throw new TypeError('target must be a bit flag of MessageTarget | Environment')
        if (pausing) {
            const list = pausingMap.get(target) || []
            pausingMap.set(target, list)
            list.push(data)
            return
        }
        postMessage!({
            data: await instance.serialization.serialization(data),
            domain: instance.domain,
            event: eventName,
            target: { kind: 'target', target },
        })
    }
    let binder: TargetBoundEventRegistry<T>
    function on(cb: (data: T) => void) {
        eventListener.on(eventName, cb)
        return () => eventListener.off(eventName, cb)
    }
    function off(cb: (data: T) => void) {
        eventListener.off(eventName, cb)
    }
    function pause() {
        pausing = true
        return async (reducer: (args: T[]) => T[] = (x) => x) => {
            pausing = false
            for (const [target, list] of pausingMap) {
                try {
                    await Promise.all(reducer(list).map((x) => send(target, x)))
                } finally {
                    pausingMap.clear()
                }
            }
        }
    }
    const self: UnboundedRegistry<T> = {
        send,
        sendToLocal: send.bind(null, MessageTarget.LocalOnly),
        sendToBackgroundPage: send.bind(null, Environment.ManifestBackground),
        sendToContentScripts: send.bind(null, Environment.ContentScript),
        sendToVisiblePages: send.bind(null, MessageTarget.VisiblePageOnly),
        sendToFocusedPage: send.bind(null, MessageTarget.FocusedPageOnly),
        sendByBroadcast: send.bind(null, MessageTarget.Broadcast),
        sendToAll: send.bind(null, MessageTarget.All),
        bind(target) {
            if (typeof binder === 'undefined') {
                binder = { on, off, send: (data) => send(target, data), pause }
            }
            return binder
        },
        on,
        off,
        pause,
        async *[Symbol.asyncIterator]() {
            yield* new EventIterator<T>(({ push }) => this.on(push))
        },
    }
    return self
}
type EventRegistry = Emitter<Record<string, [unknown]>>
type BoundTarget =
    | { kind: 'tab'; id: number }
    | { kind: 'target'; target: MessageTarget | Environment }
    | { kind: 'port'; port: browser.runtime.Port }

function backgroundPageMessageHandler(this: browser.runtime.Port | undefined, data: unknown) {
    // receive payload from the other side
    if (!isInternalMessageType(data)) return
    if (data.target.kind === 'tab') {
        for (const [port, { sender }] of backgroundOnlyLivingPorts) {
            if (data.target.id !== sender?.tab?.id) continue
            return port.postMessage(data)
        }
    } else if (data.target.kind === 'port') {
        data.target.port.postMessage(data)
    } else {
        const flag = data.target.target
        // Also dispatch this message to background page itself. shouldAcceptThisMessage will help us to filter the message
        domainRegistry.emit(data.domain, data)
        if (flag & MessageTarget.LocalOnly) return
        for (const [port, { environment }] of backgroundOnlyLivingPorts) {
            if (port === this) continue // Not sending to the source.
            if (environment === undefined) continue
            try {
                if (environment & flag) port.postMessage(data)
                // they will handle this by thyself
                else if (flag & (MessageTarget.FocusedPageOnly | MessageTarget.VisiblePageOnly)) port.postMessage(data)
            } catch (e) {
                console.error(e)
            }
        }
    }
}

function otherEnvMessageHandler(this: browser.runtime.Port, payload: number | InternalMessageType) {
    if (typeof payload !== 'object') return this.postMessage(payload)

    const bound = payload.target
    if (bound.kind === 'tab') return this.postMessage(payload)
    if (bound.kind === 'port') throw new Error('Unreachable case: bound type = port in non-background script')
    const target = bound.target
    if (target & (MessageTarget.IncludeLocal | MessageTarget.LocalOnly)) {
        domainRegistry.emit(payload.domain, payload)
        if (target & MessageTarget.LocalOnly) return
        bound.target &= ~MessageTarget.IncludeLocal // unset IncludeLocal
    }
    this.postMessage(payload)
}
/** The port need to be initialized before use. */
function backgroundPortBoarding(port: browser.runtime.Port, sender: undefined | browser.runtime.MessageSender) {
    // let the client know it's tab id
    // sender.tab might be undefined if it is a popup
    port.postMessage(sender?.tab?.id ?? -1)
    // Client will report it's environment flag on connection
    port.onMessage.addListener(function environmentListener(x) {
        const obj = backgroundOnlyLivingPorts.get(port)!
        if (typeof obj.environment === "undefined") obj.environment = Number(x)
        port.onMessage.removeListener(environmentListener)
    })
    port.onMessage.addListener(backgroundPageMessageHandler.bind(port))
    port.onDisconnect.addListener(() => backgroundOnlyLivingPorts.delete(port))
}

function otherEnvPortBoarding(port: browser.runtime.Port, reconnect: () => void) {
    // report self environment
    port.postMessage(getEnvironment())
    // server will send self tab ID on connected
    port.onMessage.addListener(function tabIDListener(x) {
        currentTabID = Number(x)
        port.onMessage.removeListener(tabIDListener)
    })
    port.onMessage.addListener((data) => {
        if (!isInternalMessageType(data)) return
        domainRegistry.emit(data.domain, data)
    })
    // ? Will it cause infinite loop?
    port.onDisconnect.addListener(reconnect)
}
