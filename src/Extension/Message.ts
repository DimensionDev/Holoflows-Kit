/* eslint-disable @typescript-eslint/strict-boolean-expressions */
/* eslint-disable no-bitwise */

// TODO: multiple stage serialization
// TODO: pause receiving messages
// TODO: allow dispose instance
// TODO: WebExtensionEventTargetUnbound.sendToTab
import type { Runtime } from 'webextension-polyfill'
import { Environment, getEnvironment, isEnvironment } from './Context.js'

/**
 * Define the encoding of messages
 */
export interface Encoder {
    encode(data: unknown): unknown | PromiseLike<unknown>
    decode(encoded: unknown): unknown | PromiseLike<unknown>
}
export enum MessageTarget {
    /** Unconditionally match local. (local might receive the message even without this flag if other condition met.) */ IncludeLocal = 1 <<
        20,
    /** Unconditionally exclude local from receiving the message. */ ExcludeLocal = 1 << 25,
    /** Do not send the message over channel. */ LocalOnly = 1 << 21,
    /** Visible page, maybe have more than 1 page. */ VisiblePageOnly = 1 << 22,
    /** Page that has focus (devtools not included), 0 or 1 page. */ FocusedPageOnly = 1 << 23,
    /** Send to all environments (exclude local). */ Broadcast = Environment.HasBrowserAPI | ExcludeLocal,
    /** Send to all environments (include local) */ All = Environment.HasBrowserAPI,
}
export interface WebExtensionTargetBoundEventTarget<T> {
    /** @returns A function to remove the listener */
    on(callback: (data: T, senderUUID: string) => void, options?: AddEventListenerOptions): () => void
    off(callback: (data: T, senderUUID: string) => void): void
    send(data: T): void
    /**
     * Pausing the dispatch of this event. Collect all new incoming events.
     * @param reducer - When resuming the dispatch of events, all pausing data will be passed into this function. Return value of the reducer will be used as the final result for dispatching. Every target will have a unique call to the reducer.
     * @returns A function that resume the dispatching
     */
    pause(): (reducer?: (data: T[]) => T[]) => Promise<void>
}
export interface WebExtensionEventTarget<EventMap> extends EventTarget {
    addEventListener<K extends keyof EventMap>(
        type: K,
        listener: (ev: MessageEvent<EventMap[K]>) => any,
        options?: boolean | AddEventListenerOptions,
    ): void
    addEventListener(
        type: string,
        listener: EventListenerOrEventListenerObject,
        options?: boolean | AddEventListenerOptions,
    ): void
    removeEventListener<K extends keyof EventMap>(
        type: K,
        listener: (ev: MessageEvent<EventMap[K]>) => any,
        options?: boolean | EventListenerOptions,
    ): void
    removeEventListener(
        type: string,
        listener: EventListenerOrEventListenerObject,
        options?: boolean | EventListenerOptions,
    ): void
    dispatchEvent(event: MessageEvent<EventMap[keyof EventMap]>): boolean
}
export interface WebExtensionEventTargetUnbound<T> extends Omit<WebExtensionTargetBoundEventTarget<T>, 'send'> {
    // For different send targets
    send(target: MessageTarget | Environment, data: T): void
    // sendToTab(tabID: number, data: T): void
    sendToLocal(data: T): void
    sendToBackgroundPage(data: T): void
    sendToContentScripts(data: T): void
    sendToVisiblePages(data: T): void
    sendToFocusedPage(data: T): void
    sendByBroadcast(data: T): void
    sendToAll(data: T): void
    /** You may create a bound version that have a clear interface. */
    bind(target: MessageTarget | Environment, signal?: AbortSignal): WebExtensionTargetBoundEventTarget<T>
}
export interface WebExtensionMessageOptions {
    /** The "domain" of the message. Messages within different domain won't affect each other. */
    readonly domain?: string
}

const debugLog = false
export class WebExtensionMessage<Message> extends EventTarget implements WebExtensionEventTarget<Message> {
    declare addEventListener: WebExtensionEventTarget<Message>['addEventListener']
    declare removeEventListener: WebExtensionEventTarget<Message>['addEventListener']
    declare dispatchEvent: WebExtensionEventTarget<Message>['dispatchEvent']

    #domain: string
    get domain() {
        return this.#domain
    }
    /**
     * @param options - WebExtensionMessage options
     */
    constructor(options?: WebExtensionMessageOptions) {
        super()
        // invoke the warning if needed
        getEnvironment()
        try {
            typeof browser === 'object' && browser && WebExtensionMessage.#Onboard?.()
        } catch (err) {
            console.error('[WebExtensionMessage] initialize failed', err)
        }

        this.#domain = options?.domain ?? ''
        domainRegistry.addEventListener(this.#domain, async ({ data: [encoded, payload] }) => {
            const { e: event, t: target, o: origin } = payload
            if (!shouldAcceptThisMessage(target)) return
            let { d: data } = payload
            if (encoded && this.encoder) data = await this.encoder.decode(data)
            if (this.enableLog) {
                this.log(...this.logFormatter(this, event, data))
            }
            this.dispatchEvent(new MessageEvent(event, { data, origin } as any))
        })
    }

    static #Onboard: (() => void) | undefined = () => {
        WebExtensionMessage.#Onboard = undefined
        if (isEnvironment(Environment.ManifestBackground)) {
            backgroundUUID = crypto.randomUUID()
            postMessage = backgroundPageMessageHandler.bind(undefined, backgroundUUID)
            // Wait for other pages to connect
            browser.runtime.onConnect.addListener((port) => {
                if (port.name !== PORT_NAME) return // not for ours
                backgroundOnBoarding(port)
            })
        } else {
            pageOnBoarding(() => browser.runtime.connect({ name: PORT_NAME }))
        }
    }
    #EventTargetExoticGetter: any = {
        __proto__: new Proxy(
            {},
            {
                get: (_target, eventName) => {
                    if (typeof eventName === 'symbol') return undefined
                    return this.#installEventTarget(eventName)
                },
            },
        ),
    }
    #EventTarget = new Proxy(this.#EventTargetExoticGetter, {
        setPrototypeOf: (target, prototype) => prototype === null,
        getPrototypeOf: () => null,
        getOwnPropertyDescriptor: (_target, eventName) => {
            if (typeof eventName === 'symbol') return undefined
            if (!(eventName in this.#EventTargetExoticGetter)) this.#installEventTarget(eventName)
            return Object.getOwnPropertyDescriptor(this.#EventTargetExoticGetter, eventName)
        },
    })
    /** Event listeners */
    get events(): { readonly [K in keyof Message]: WebExtensionEventTargetUnbound<Message[K]> } {
        return this.#EventTarget
    }

    public encoder: Encoder | undefined
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

    #installEventTarget(event: string) {
        const value = this.#createEventTargetUnbound(event)
        Object.defineProperty(this.#EventTargetExoticGetter, event, {
            configurable: true,
            value,
        })
        return value
    }
    #createEventTargetUnbound<T>(eventName: string): WebExtensionEventTargetUnbound<T> {
        let pausing = false
        const pausingMap = new Map<Environment | MessageTarget, T[]>()

        const send = async (target: MessageTarget | Environment, data: T) => {
            if (typeof target !== 'number')
                throw new TypeError('target must be a bit flag of MessageTarget | Environment')
            if (
                target & MessageTarget.ExcludeLocal &&
                target & (MessageTarget.IncludeLocal | MessageTarget.LocalOnly)
            ) {
                throw new TypeError('[@holoflows/kit] Invalid flag: ExcludeLocal with (IncludeLocal | LocalOnly)')
            }
            if (pausing) {
                const list = pausingMap.get(target) || []
                pausingMap.set(target, list)
                list.push(data)
                return
            }
            if (!postMessage) {
                if (getEnvironment() & Environment.NONE)
                    throw new Error('[@holoflows/kit] MessageChannel is designed for WebExtension.')
                throw new Error('[@holoflows/kit] MessageChannel is not setup properly.')
            }
            if (
                target & ~MessageTarget.ExcludeLocal &&
                shouldAcceptThisMessage({ k: BoundTargetKind.Target, t: target })
            ) {
                const internalEvent: InternalEvent = [
                    false,
                    {
                        d: data,
                        s: this.#domain,
                        e: eventName,
                        t: { k: BoundTargetKind.Target, t: target },
                        // only background can have a value. in other cases it is undefined, and will be set in the background.
                        o: backgroundUUID,
                    },
                ]
                domainRegistry.dispatchEvent(new MessageEvent(this.#domain, { data: internalEvent }))
            }
            if (target & MessageTarget.LocalOnly) return
            postMessage({
                d: this.encoder ? await this.encoder.encode(data) : data,
                s: this.#domain,
                e: eventName,
                t: {
                    k: BoundTargetKind.Target,
                    t: target & ~(MessageTarget.IncludeLocal | MessageTarget.ExcludeLocal),
                } as const,
                // same as above
                o: backgroundUUID,
            })
        }
        const eventMappedMap = new WeakMap<(data: T, senderUUID: string) => void, (data: Event) => void>()
        const on = (cb: (data: T, senderUUID: string) => void, options?: AddEventListenerOptions) => {
            if (!eventMappedMap.has(cb))
                eventMappedMap.set(cb, (ev) => {
                    cb((ev as MessageEvent).data, (ev as MessageEvent).origin)
                })
            const mapped = eventMappedMap.get(cb)!
            this.addEventListener(eventName, mapped, options)
            return () => this.removeEventListener(eventName, mapped)
        }
        const off = (cb: (data: T, senderUUID: string) => void) => {
            const mapped = eventMappedMap.get(cb)
            mapped && this.removeEventListener(eventName, mapped)
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
        const self: WebExtensionEventTargetUnbound<T> = {
            send,
            sendToLocal: send.bind(null, MessageTarget.LocalOnly),
            sendToBackgroundPage: send.bind(null, Environment.ManifestBackground),
            sendToContentScripts: send.bind(null, Environment.ContentScript),
            sendToVisiblePages: send.bind(null, MessageTarget.VisiblePageOnly),
            sendToFocusedPage: send.bind(null, MessageTarget.FocusedPageOnly),
            sendByBroadcast: send.bind(null, MessageTarget.Broadcast),
            sendToAll: send.bind(null, MessageTarget.All),
            bind(target, signal) {
                return {
                    on: (callback, options) => {
                        const off = on(callback, options)
                        signal?.addEventListener('abort', off, { once: true })
                        return off
                    },
                    off,
                    send: send.bind(null, target),
                    pause,
                }
            },
            on,
            off,
            pause,
        }
        return self
    }
}

type PortInfoAtPage = {
    port: Runtime.Port | Promise<Runtime.Port>
    broadcastChannel?: BroadcastChannel
    tabID?: number
    uuid?: string
}
type PortInfoAtBackground = {
    sender?: Runtime.MessageSender
    uuid: string
    environment: Environment
    farwell?: boolean
    port: Runtime.Port | Promise<Runtime.Port>
    resolvePort?: (port: Runtime.Port) => void
    broadcastChannel?: BroadcastChannel
}
type OnBoardingMessageAtBackground = { tab: number; uuid: string }
type OnBoardingMessageFromPage = { environment: Environment; uuid?: string }
type InternalEvent = [encoded: boolean, data: InternalMessageType]
type InternalMessageType = {
    /** scope */
    s: string
    /** event name */
    e: string
    /** data */
    d: unknown
    /** target */
    t: BoundTarget
    /** origin */
    o: string
}
const enum BoundTargetKind {
    Tab,
    Target,
    Connection,
}
type BoundTarget =
    | { /** kind */ k: BoundTargetKind.Tab; /** id */ i: number }
    | { /** kind */ k: BoundTargetKind.Target; /** target */ t: MessageTarget | Environment }
    | { /** kind */ k: BoundTargetKind.Connection; /** connection uuid */ u: string }

function shouldAcceptThisMessage(target: BoundTarget) {
    if (target.k === BoundTargetKind.Tab) return target.i === pageLocal.tabID && pageLocal.tabID !== -1
    if (target.k === BoundTargetKind.Connection) return true
    const flag = target.t
    if (flag & (MessageTarget.IncludeLocal | MessageTarget.LocalOnly)) return true
    const here = getEnvironment()
    if (here & flag) return true
    if (flag & MessageTarget.FocusedPageOnly) return typeof document === 'object' && document?.hasFocus?.()
    if (flag & MessageTarget.VisiblePageOnly) {
        // background page has document.visibilityState === 'visible' for reason I don't know why
        if (here & Environment.ManifestBackground) return false
        return typeof document === 'object' && document?.visibilityState === 'visible'
    }
    return false
}

const domainRegistry = new EventTarget() as WebExtensionEventTarget<Record<string, InternalEvent>>
const backgroundLocal = new Map<string, PortInfoAtBackground>()
let backgroundUUID: string
const pageLocal: PortInfoAtPage = { port: null! }
let postMessage: (message: InternalMessageType | typeof FARWELL) => void
const PORT_NAME = '@holoflows/kit/WebExtensionMessage/setup'
const FARWELL = 'farwell'

function postMessageInner(connection: PortInfoAtBackground | PortInfoAtPage, data: unknown) {
    try {
        // port is a Promise: the page has been disconnected and is reconnecting
        if (connection.port instanceof Promise) connection.port.then((port) => port.postMessage(data))
        // port has a broadcastChannel: the page is ExtensionProtocol and can use more efficient API
        else if (connection.broadcastChannel) connection.broadcastChannel.postMessage(data)
        // port is connected to a normal page
        else connection.port.postMessage(data)
    } catch (error) {
        console.error(error)
    }
}

function backgroundOnBoarding(port: Runtime.Port) {
    port.onMessage.addListener(function clientOnboardMessageListener({ environment, uuid }: OnBoardingMessageFromPage) {
        // if uuid is not undefined, it is a reconnect
        uuid ||= crypto.randomUUID()

        const onMessageHandler = backgroundPageMessageHandler.bind(undefined, uuid)
        port.onMessage.removeListener(clientOnboardMessageListener)
        port.onMessage.addListener(onMessageHandler)

        if (!backgroundLocal.has(uuid)) {
            const info: PortInfoAtBackground = { port, environment, sender: port.sender, uuid }
            if (info.environment & Environment.ExtensionProtocol) {
                info.broadcastChannel = new BroadcastChannel(uuid)
                info.broadcastChannel.addEventListener('message', onMessageHandler)
            }
            backgroundLocal.set(uuid, info)
            if (debugLog) console.debug('[WebExtensionMessage] Background: New client', info)
        } else {
            if (debugLog)
                console.debug('[WebExtensionMessage] Background: Old client reconnecting', backgroundLocal.get(uuid))
        }

        const info = backgroundLocal.get(uuid)!

        if (info.port instanceof Promise) {
            // previously disconnected
            info.port = port
            info.resolvePort!(port)
            info.resolvePort = undefined
        }

        // sender.tab might be undefined if it is a popup
        const serverOnboardingMessage: OnBoardingMessageAtBackground = { tab: port.sender?.tab?.id ?? -1, uuid }
        port.postMessage(serverOnboardingMessage)

        port.onDisconnect.addListener(function disconnectedListener() {
            port.onDisconnect.removeListener(disconnectedListener)
            port.onMessage.removeListener(onMessageHandler)
            function farwell() {
                info.broadcastChannel?.removeEventListener('message', onMessageHandler)
                info.broadcastChannel?.close()
                backgroundLocal.delete(uuid!)
            }
            if (info.farwell) {
                if (debugLog) console.debug('[WebExtensionMessage] Background: Client disconnected', info)
                farwell()
            } else {
                info.port = new Promise((resolve, reject) => {
                    info.resolvePort = resolve
                    setTimeout(() => reject(), 1000)
                })
                // we hold the port for a while and hope it will reconnect.
                info.port.catch(() => {
                    if (debugLog)
                        console.debug('[WebExtensionMessage] Background: Client disconnected without say goodbye', info)
                    farwell()
                })
            }
        })
    })
}
function backgroundPageMessageHandler(
    origin: string,
    data: typeof FARWELL | InternalMessageType | MessageEvent<InternalMessageType>,
) {
    if (data instanceof MessageEvent) data = data.data
    if (data === FARWELL) {
        const connection = backgroundLocal.get(origin)
        if (connection) connection.farwell = true
        return
    }
    data.o = origin

    if (data.t.k === BoundTargetKind.Tab) {
        for (const connection of backgroundLocal.values()) {
            if (data.t.i !== connection.sender?.tab?.id) continue
            postMessageInner(connection, data)
        }
    } else if (data.t.k === BoundTargetKind.Connection) {
        if (data.t.u === backgroundUUID) {
            domainRegistry.dispatchEvent(new MessageEvent(data.s, { data: [true, data] satisfies InternalEvent }))
        } else {
            const connection = backgroundLocal.get(data.t.u)
            if (!connection) return
            postMessageInner(connection, data)
        }
    } else {
        const flag = data.t.t
        if (origin !== backgroundUUID && shouldAcceptThisMessage({ k: BoundTargetKind.Target, t: flag })) {
            domainRegistry.dispatchEvent(new MessageEvent(data.s, { data: [true, data] satisfies InternalEvent }))
        }
        // broadcast this message to all pages that meet the condition
        for (const connection of backgroundLocal.values()) {
            if (origin === connection.uuid) continue // Not sending to the source.
            if (
                connection.environment & flag ||
                // further handled by shouldAcceptThisMessage
                flag & (MessageTarget.FocusedPageOnly | MessageTarget.VisiblePageOnly)
            ) {
                postMessageInner(connection, data)
            }
        }
    }
}

function pageOnBoarding(connect: () => Runtime.Port) {
    if (!pageLocal.port) {
        postMessage = postMessageInner.bind(null, pageLocal)
        self.addEventListener('unload', () => {
            postMessage(FARWELL)
            pageLocal.broadcastChannel?.removeEventListener('message', pageMessageListener)
            pageLocal.broadcastChannel?.close()
        })
    }
    if (debugLog)
        console.debug(
            pageLocal.uuid
                ? '[WebExtensionMessage] Client reconnecting ' + pageLocal.uuid
                : '[WebExtensionMessage] Client onboarding',
        )
    pageLocal.port = new Promise((resolve) => {
        const port = connect()
        const onboard: OnBoardingMessageFromPage = { environment: getEnvironment(), uuid: pageLocal.uuid }
        port.postMessage(onboard)
        port.onMessage.addListener(function tabIDListener({ tab, uuid }: OnBoardingMessageAtBackground) {
            if (debugLog)
                console.debug(
                    pageLocal.uuid
                        ? '[WebExtensionMessage] Client reconnected '
                        : '[WebExtensionMessage] Client onboard',
                    uuid,
                )
            port.onMessage.removeListener(tabIDListener)
            port.onMessage.addListener(pageMessageListener)
            pageLocal.port = port
            pageLocal.tabID = tab
            pageLocal.uuid ??= uuid
            if (getEnvironment() & Environment.ExtensionProtocol) {
                pageLocal.broadcastChannel ??= new BroadcastChannel(uuid)
                pageLocal.broadcastChannel.addEventListener('message', pageMessageListener)
            }
            resolve(port)
        })
        port.onDisconnect.addListener(function disconnectedListener() {
            port.onMessage.removeListener(pageMessageListener)
            port.onDisconnect.removeListener(disconnectedListener)
            pageOnBoarding(connect)
        })
    })
}
function pageMessageListener(data: InternalMessageType | MessageEvent<InternalMessageType>) {
    if (data instanceof MessageEvent) data = data.data
    domainRegistry.dispatchEvent(new MessageEvent(data.s, { data: [true, data] satisfies InternalEvent }))
}
