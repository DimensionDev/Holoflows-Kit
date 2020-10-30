import { Emitter } from '@servie/events'
import { NoSerialization, EventBasedChannel } from 'async-call-rpc'
/**
 * Define how to do serialization and deserialization of remote procedure call
 */
export interface Serialization {
    /**
     * Do serialization
     * @param from - original data
     */
    serialization(from: any): unknown | PromiseLike<unknown>
    /**
     * Do deserialization
     * @param serialized - Serialized data
     */
    deserialization(serialized: unknown): unknown | PromiseLike<unknown>
}
type InternalMessageType = {
    key: string
    data: any
    instanceKey: string
}
const noop = () => {}
/**
 * Send and receive messages in different contexts.
 * @deprecated
 */
export class MessageCenter<ITypedMessages> {
    /**
     * How should MessageCenter serialization the message
     * @defaultValue NoSerialization
     */
    public serialization: Serialization = NoSerialization
    private eventEmitter = new Emitter<any>()
    private listener = async (request: unknown) => {
        const { key, data, instanceKey } = (await this.serialization.deserialization(request)) as InternalMessageType
        // Message is not for us
        if (this.instanceKey !== (instanceKey ?? '')) return
        if (key === undefined) return
        if (this.log) {
            console.log(
                `%cReceive%c %c${key.toString()}`,
                'background: rgba(0, 255, 255, 0.6); color: black; padding: 0px 6px; border-radius: 4px;',
                '',
                'text-decoration: underline',
                data,
            )
        }
        this.eventEmitter.emit(key, data)
    }
    /**
     * @param sendToSelf - If this MessageCenter will send message to this instance itself
     * @param instanceKey - Use this instanceKey to distinguish your messages and others.
     * This option cannot make your message safe!
     */
    constructor(private sendToSelf: boolean, private instanceKey = '') {
        try {
            // Fired when a message is sent from either an extension process (by runtime.sendMessage)
            // or a content script (by tabs.sendMessage).
            browser.runtime.onMessage.addListener((e: any) => {
                this.listener(e)
            })
        } catch {}
    }
    /**
     * Listen to an event
     * @param event - Name of the event
     * @param handler - Handler of the event
     * @returns a function, call it to remove this listener
     */
    public on<Key extends keyof ITypedMessages>(event: Key, handler: (data: ITypedMessages[Key]) => void) {
        this.eventEmitter.on(event as string, handler)
        return () => this.off(event, handler)
    }
    /**
     * Remove the listener of an event
     * @param event - Name of the event
     * @param handler - Handler of the event
     */
    public off<Key extends keyof ITypedMessages>(event: Key, handler: (data: ITypedMessages[Key]) => void): void {
        this.eventEmitter.off(event as string, handler)
    }
    /**
     * Send message to local or other instance of extension
     * @param key - Key of the message
     * @param data - Data of the message
     */
    public async emit<Key extends keyof ITypedMessages>(key: Key, data: ITypedMessages[Key]): Promise<void> {
        if (this.log) {
            console.log(
                `%cSend%c %c${key.toString()}`,
                'background: rgba(0, 255, 255, 0.6); color: black; padding: 0px 6px; border-radius: 4px;',
                '',
                'text-decoration: underline',
                data,
            )
        }
        const serialized = await this.serialization.serialization({
            data,
            key,
            instanceKey: this.instanceKey ?? '',
        } as InternalMessageType)
        if (typeof browser !== 'undefined') {
            browser.runtime?.sendMessage?.(serialized).catch(noop)
            // Send message to Content Script
            browser.tabs?.query({ discarded: false }).then((tabs) => {
                for (const tab of tabs) {
                    if (tab.id !== undefined) browser.tabs.sendMessage(tab.id, serialized).catch(noop)
                }
            })
        }
        if (this.sendToSelf) {
            this.listener(serialized as InternalMessageType)
        }
    }
    private log = false
    /**
     * Should MessageCenter prints all messages to console?
     */
    writeToConsole(on: boolean) {
        this.log = on
        return this
    }
    eventBasedChannel: EventBasedChannel = {
        on: (e) => this.on('__async-call' as any, e),
        send: (e) => this.emit('__async-call' as any, e as any),
    }
}
