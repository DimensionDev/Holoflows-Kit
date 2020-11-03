import { NoSerialization } from 'async-call-rpc'
import { Serialization } from './MessageCenter'
import { Emitter } from '@servie/events'
import { EventIterator } from 'event-iterator'
import { Environment, getExtensionEnvironment, isEnvironment, printExtensionEnvironment } from './Context'

export enum MessageTarget {
    /** Current execution context */ IncludeLocal = 1 << 20,
    LocalOnly = 1 << 21,
    /** Visible page, maybe have more than 1 page. */ VisiblePageOnly = 1 << 22,
    /** Page that has focus (devtools not included), 0 or 1 page. */ FocusedPageOnly = 1 << 23,
    Broadcast = Environment.HasBrowserAPI,
    All = Broadcast | IncludeLocal,
}
export interface TargetBoundEventRegistry<T> {
    /** @returns A function to remove the listener */
    on(callback: (data: T) => void): () => void
    off(callback: (data: T) => void): void
    send(data: T): void
}
// export interface EventTargetRegistry<T> extends EventTarget {}
// export interface EventEmitterRegistry<T> extends NodeJS.EventEmitter {}
export interface UnboundedRegistry<T, BindType> extends Omit<TargetBoundEventRegistry<T>, 'send'>, AsyncIterable<T> {
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
    bind(target: MessageTarget | Environment): BindType
}
export interface TabBoundedRegistry<T> {
    readonly tabId: string
    readonly url: string
    readonly events: { readonly [key in keyof T]: TargetBoundEventRegistry<T[key]> }
    // readonly eventTarget: { readonly [key in keyof T]: EventTargetRegister<T[key]> }
    // readonly eventEmitter: { readonly [key in keyof T]: EventEmitterRegister<T[key]> }
}
export interface WebExtensionMessageOptions {
    readonly domain?: string
}
const throwSetter = () => {
    throw new TypeError()
}
// Only available in background page
const backgroundOnlyLivingPorts = new Map<
    browser.runtime.Port,
    { sender?: browser.runtime.MessageSender; environment?: Environment }
>()
// Only be set in other pages
let currentTabID = -1
// Shared global
let postMessage: ((message: number | InternalMessageType) => void) | undefined = undefined
const domainRegistry = new Emitter<Record<string, [InternalMessageType]>>()
const constant = '@holoflows/kit/WebExtensionMessage/setupBroadcastBetweenContentScripts'
export class WebExtensionMessage<Message> {
    // Only execute once.
    private static setup() {
        if (isEnvironment(Environment.ManifestBackground)) {
            WebExtensionMessage.setup = () => {}
            // Wait for other pages to connect
            browser.runtime.onConnect.addListener((port) => {
                if (port.name !== constant) return // not for ours
                const sender = port.sender
                backgroundOnlyLivingPorts.set(port, { sender })
                // let the client know it's tab id
                // sender.tab might be undefined if it is a popup
                // TODO: check sender if same as ourself? Support external / cross-extension message?
                port.postMessage(sender?.tab?.id ?? -1)
                // Client will report it's environment flag on connection
                port.onMessage.addListener(function environmentListener(x) {
                    backgroundOnlyLivingPorts.get(port)!.environment = Number(x)
                    port.onMessage.removeListener(environmentListener)
                })
                port.onMessage.addListener(backgroundPageMessageHandler.bind(port))
                port.onDisconnect.addListener(() => backgroundOnlyLivingPorts.delete(port))
            })
            postMessage = backgroundPageMessageHandler
        } else {
            WebExtensionMessage.setup = () => {}
            function reconnect() {
                const port = browser.runtime.connect({ name: constant })
                postMessage = (payload) => {
                    if (typeof payload !== 'object') return port.postMessage(payload)

                    const bound = payload.target
                    if (bound.kind === 'tab') return port.postMessage(payload)
                    const target = bound.target
                    if (target & (MessageTarget.IncludeLocal | MessageTarget.LocalOnly)) {
                        domainRegistry.emit(payload.domain, payload)
                        if (target & MessageTarget.LocalOnly) return
                        bound.target &= ~MessageTarget.IncludeLocal // unset IncludeLocal
                    }
                    port.postMessage(payload)
                }
                // report self environment
                port.postMessage(getExtensionEnvironment())
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
            reconnect()
        }
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
        WebExtensionMessage.setup()
        this.#domain = options?.domain ?? ''
    }
    private __createEventObject__(event: string): any {
        return UnboundedRegistry(this, event, this.#eventRegistry, (target) =>
            TargetBoundEventRegisterImpl(
                this.#domain,
                event,
                this.#eventRegistry,
                { kind: 'target', target },
                this.serialization,
            ),
        )
    }
    #cache: any = { __proto__: null }
    //#region Simple API
    #events: any = new Proxy(this.#cache, {
        get: (cache, key) => {
            if (typeof key !== 'string') throw new Error('Only string can be event keys')
            if (cache[key]) return cache[key]
            const event = this.__createEventObject__(key)
            Object.defineProperty(this.#cache, key, { value: event })
            return event
        },
        defineProperty: () => false,
        setPrototypeOf: () => false,
        set: throwSetter,
    })
    /** Event listeners */
    get events(): { readonly [K in keyof Message]: UnboundedRegistry<Message[K], TargetBoundEventRegistry<Message>> } {
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
    public tabs(): AsyncIterableIterator<TabBoundedRegistry<Message>> {
        // TODO
        throw new Error('Not implemented yet')
    }
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
    if (target.kind === 'tab') return target.id === currentTabID
    const flag = target.target
    if (flag & (MessageTarget.IncludeLocal | MessageTarget.LocalOnly)) return true
    const here = getExtensionEnvironment()
    if (flag & MessageTarget.FocusedPageOnly) return typeof document === 'object' && document?.hasFocus?.()
    if (flag & MessageTarget.VisiblePageOnly) {
        // background page has document.visibilityState === 'visible' for reason I don't know why
        if (here & Environment.ManifestBackground) return false
        return typeof document === 'object' && document?.visibilityState === 'visible'
    }
    return Boolean(here & flag)
}
function UnboundedRegistry<T, Binder>(
    instance: WebExtensionMessage<T>,
    eventName: string,
    eventListener: Emitter<any>,
    createBind: (f: MessageTarget | Environment) => Binder,
): UnboundedRegistry<T, Binder> {
    domainRegistry.on(instance.domain, async function (payload: InternalMessageType) {
        if (!isInternalMessageType(payload)) return
        let { event, data, target } = payload
        if (!shouldAcceptThisMessage(target)) return
        data = await instance.serialization.deserialization(data)
        if (instance.enableLog) {
            instance.log(...instance.logFormatter(instance, event, data))
        }
        eventListener.emit(event, data)
    })
    async function send(target: MessageTarget | Environment, data: T) {
        if (typeof target !== 'number') throw new TypeError('target must be a bit flag of MessageTarget | Environment')
        postMessage!({
            data: await instance.serialization.serialization(data),
            domain: instance.domain,
            event: eventName,
            target: { kind: 'target', target },
        })
    }
    let binder: Binder
    return {
        send,
        sendToLocal: send.bind(null, MessageTarget.LocalOnly),
        sendToBackgroundPage: send.bind(null, Environment.ManifestBackground),
        sendToContentScripts: send.bind(null, Environment.ContentScript),
        sendToVisiblePages: send.bind(null, MessageTarget.VisiblePageOnly),
        sendToFocusedPage: send.bind(null, MessageTarget.FocusedPageOnly),
        sendByBroadcast: send.bind(null, MessageTarget.Broadcast),
        sendToAll: send.bind(null, MessageTarget.All),
        bind: (target) => {
            if (typeof binder === 'undefined') {
                binder = createBind(target)
                createBind = undefined!
            }
            return binder
        },
        on: (cb) => (eventListener.on(eventName, cb), () => eventListener.off(eventName, cb)),
        off: (cb) => void eventListener.off(eventName, cb),
        async *[Symbol.asyncIterator]() {
            yield* new EventIterator<T>(({ push }) => this.on(push))
        },
    }
}

type EventRegistry = Emitter<Record<string, [unknown]>>
type BoundTarget = { kind: 'tab'; id: number } | { kind: 'target'; target: MessageTarget | Environment }

function TargetBoundEventRegisterImpl(
    domain: string,
    event: string,
    eventRegistry: EventRegistry,
    boundTarget: BoundTarget,
    serialization: Serialization,
): TargetBoundEventRegistry<unknown> {
    return {
        on: (callback) => (eventRegistry.on(event, callback), () => eventRegistry.off(event, callback)),
        off: (callback) => eventRegistry.off(event, callback),
        send: async (data) =>
            postMessage!({
                data: await serialization.serialization(data),
                domain,
                event,
                target: boundTarget,
            }),
    }
}

function backgroundPageMessageHandler(this: browser.runtime.Port | undefined, data: unknown) {
    // receive payload from the other side
    if (!isInternalMessageType(data)) return
    if (data.target.kind === 'tab') {
        for (const [port, { sender }] of backgroundOnlyLivingPorts) {
            if (data.target.id !== sender?.tab?.id) continue
            return port.postMessage(data)
        }
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
