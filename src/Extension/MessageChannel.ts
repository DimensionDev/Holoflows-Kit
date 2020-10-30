export enum MessageTarget {
    /** Current execution context */
    Local = 1 << 1,
    /** Page that starts with chrome-extension:// or browser-extension:// but not BackgroundPage */
    ExtensionPage = 1 << 2,
    /** Page that specified in manifest.background */
    BackgroundPage = 1 << 3,
    /** Content Script that runs in normal web page */
    ContentScript = 1 << 4,
    /** The page that user current browsing. Might be ExtensionPage or ContentScript. */
    CurrentActivePage = 1 << 5,
    UserVisible = ExtensionPage | ContentScript,
    Broadcast = ExtensionPage | BackgroundPage | ContentScript,
    All = Broadcast | Local,
}
// export interface WebExtensionMessageChannelEventTarget<T> extends EventTarget {}
// export interface WebExtensionMessageChannelNodeEventEmitter<T> extends NodeJS.EventEmitter {}
export interface WebExtensionMessageChannelBasic<T> {
    /** @returns A function to remove the listener */
    on(callback: (data: T) => void): () => void
    off(callback: (data: T) => void): void
    send(data: T): void
}
export interface WebExtensionMessageChannelListenerObject<T> extends Omit<WebExtensionMessageChannelBasic<T>, 'send'> {
    // For different send targets
    send_raw(target: MessageTarget, data: T): void
    send_local(data: T): void
    send_extension_page(data: T): void
    send_background_page(data: T): void
    send_content_script(data: T): void
    send_current_active_page(data: T): void
    send_user_visible(data: T): void
    send_broadcast(data: T): void
    send_all(data: T): void
    // There is no default *send* to prevent misuse. You must know where do you want to send to.

    // Or if you want to export the API for other usages
    /** You may create a bound version that have a clear interface. */
    bind(target: MessageTarget, style?: 'basic'): WebExtensionMessageChannelBasic<T>
    // Return a DOM EventTarget style object
    // bind(target: MessageTarget, style: 'EventTarget'): WebExtensionMessageChannelEventTarget<T>
    // Return a Node EventEmitter style object
    // bind(target: MessageTarget, style: 'EventEmitter'): WebExtensionMessageChannelNodeEventEmitter<T>
}
export interface WebExtensionMessageChannel<TypedMessages extends object> extends WebExtensionMessageChannelOptions {
    readonly events: {
        readonly [key in keyof TypedMessages]: WebExtensionMessageChannelListenerObject<TypedMessages[key]>
    }
    readonly instanceBy?: string
}
export interface WebExtensionMessageChannelOptions {
    serialization?: Serialization
    log?: boolean
    instanceBy?: string
}
export function createWebExtensionMessageChannel<TypedMessages extends object>(
    options?: WebExtensionMessageChannelOptions,
): WebExtensionMessageChannel<TypedMessages> {
    // TODO:
    return {} as any
}
import { AsyncCall } from 'async-call-rpc'
import { Serialization } from './MessageCenter'
{
    // Example:
    interface Messages {
        // Note: You can use "Find All Reference" on it!
        approved: string
    }
    const myChannel = createWebExtensionMessageChannel<Messages>()
    myChannel.events.approved.send_raw(MessageTarget.BackgroundPage | MessageTarget.CurrentActivePage, 'data')
    const bind = myChannel.events.approved.bind(MessageTarget.Broadcast)
    AsyncCall({}, { channel: bind })
}
