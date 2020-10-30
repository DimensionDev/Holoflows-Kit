export enum MessageTarget {
    /** Current execution context */ Local = 1 << 1,
    /** All content script that runs in normal web page */ ContentScripts = 1 << 2,
    /** The page that user current browsing. */ CurrentActivatedPage = 1 << 3,
    /** Any *-extension: page besides BackgroundPage */ VisibleExtensionPage = 1 << 4,
    /** Page that specified in manifest.background */ BackgroundPage = 1 << 5,
    /** Page that specified in manifest.browser_action */ PopupPage = 1 << 6,
    /** Page that specified in manifest.options_ui */ OptionsPage = 1 << 7,
    ExtensionPage = VisibleExtensionPage | BackgroundPage,
    UserVisible = VisibleExtensionPage | ContentScripts,
    Broadcast = ExtensionPage | ContentScripts,
    All = Broadcast | Local,
}
export interface BasicEventRegister<T> {
    /** @returns A function to remove the listener */
    on(callback: (data: T) => void): () => void
    off(callback: (data: T) => void): void
    send(data: T): void
}
// export interface EventTargetRegister<T> extends EventTarget {}
// export interface EventEmitterRegister<T> extends NodeJS.EventEmitter {}
export interface UnboundedRegister<T, BindType> extends Omit<BasicEventRegister<T>, 'send'>, AsyncIterable<T> {
    // For different send targets
    send(target: MessageTarget, data: T): void
    sendToLocal(data: T): void
    sendToBackgroundPage(data: T): void
    sendToContentScripts(data: T): void
    sendToCurrentActivatedPage(data: T): void
    sendToUserVisible(data: T): void
    sendByBroadcast(data: T): void
    sendToAll(data: T): void
    /** You may create a bound version that have a clear interface. */
    bind(target: MessageTarget): BindType
}
export interface TabBoundedRegister<T> {
    readonly tabId: string
    readonly url: string
    readonly events: { readonly [key in keyof T]: BasicEventRegister<T[key]> }
    // readonly eventTarget: { readonly [key in keyof T]: EventTargetRegister<T[key]> }
    // readonly eventEmitter: { readonly [key in keyof T]: EventEmitterRegister<T[key]> }
}
export interface WebExtensionMessageOptions {
    readonly instanceBy?: string
}
export class WebExtensionMessage<Message> {
    /** Event listeners */
    declare readonly events: {
        readonly [key in keyof Message]: UnboundedRegister<Message[key], BasicEventRegister<Message>>
    }
    // declare readonly eventTarget: { readonly [key in keyof Message]: UnboundedRegister<Message[key], EventTargetRegister<Message>> }
    // declare readonly eventEmitter: { readonly [key in keyof Message]: UnboundedRegister<Message[key], EventEmitterRegister<Message>> }
    /**
     * Watch new tabs created and get event listener register of that tab.
     *
     * This API only works in the BackgroundPage.
     */
    tabs(): AsyncIterableIterator<TabBoundedRegister<Message>> {
        return {} as any
    }
    /** Same message name with different instanceBy won't collide with each other. */
    declare readonly instanceBy?: string
    declare serialization?: Serialization
    declare logFormatter?: <T extends keyof Message>(instance: this, key: T, data: Message[T]) => unknown
    public log: (...args: unknown[]) => void = console.log
    constructor(options?: WebExtensionMessageOptions) {
        this.instanceBy = options?.instanceBy
    }
}
import { AsyncCall } from 'async-call-rpc'
import { Serialization } from './MessageCenter'
{
    // Example:
    interface Messages {
        // Note: You can use "Find All Reference" on it!
        approved: string
    }
    const myChannel = new WebExtensionMessage<Messages>()
    myChannel.events.approved.send(MessageTarget.BackgroundPage | MessageTarget.CurrentActivatedPage, 'data')
    const bind = myChannel.events.approved.bind(MessageTarget.Broadcast)
    AsyncCall({}, { channel: bind })
    async function main() {
        for await (const tab of myChannel.tabs()) {
            if (tab.url !== 'http://example.com') continue
            // Listen on the event by this page.
            tab.events.approved.on(console.log)
            tab.events.approved.send('hello')
        }
    }
}
