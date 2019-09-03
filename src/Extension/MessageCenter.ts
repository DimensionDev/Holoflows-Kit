import mitt from 'mitt'
import { NoSerialization } from '../util/AsyncCall'
type InternalMessageType = {
    key: Key
    data: any
    instanceKey: string
}
type Key = string | number | symbol
const MessageCenterEvent = 'Holoflows-Kit MessageCenter'
const noop = () => {}
/**
 * Send and receive messages in different contexts.
 */
export class MessageCenter<ITypedMessages> {
    /**
     * How should MessageCenter serialization the message
     * @defaultValue NoSerialization
     */
    public serialization = NoSerialization
    private eventEmitter = new mitt()
    private listener = async (request: InternalMessageType | Event) => {
        let { key, data, instanceKey } = await this.serialization.deserialization(
            (request as CustomEvent).detail || request,
        )
        // Message is not for us
        if (this.instanceKey !== (instanceKey || '')) return
        if (this.writeToConsole) {
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
     * @param instanceKey - Use this instanceKey to distinguish your messages and others.
     * This option cannot make your message safe!
     */
    constructor(private instanceKey = '') {
        if (typeof browser !== 'undefined' && browser.runtime && browser.runtime.onMessage) {
            // Fired when a message is sent from either an extension process (by runtime.sendMessage)
            // or a content script (by tabs.sendMessage).
            browser.runtime.onMessage.addListener(this.listener)
        }
        if (typeof document !== 'undefined' && document.addEventListener) {
            document.addEventListener(MessageCenterEvent, this.listener)
        }
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
     * @param alsoSendToDocument - ! Send message to document. This may leaks secret! Only open in localhost!
     */
    public async emit<Key extends keyof ITypedMessages>(
        key: Key,
        data: ITypedMessages[Key],
        alsoSendToDocument = location.hostname === 'localhost',
    ): Promise<void> {
        if (this.writeToConsole) {
            console.log(
                `%cSend%c %c${key.toString()}`,
                'background: rgba(0, 255, 255, 0.6); color: black; padding: 0px 6px; border-radius: 4px;',
                '',
                'text-decoration: underline',
                data,
            )
        }
        const msg: InternalMessageType = { data, key, instanceKey: this.instanceKey || '' }
        const serialized = await this.serialization.serialization(msg)
        if (typeof browser !== 'undefined') {
            if (browser.runtime && browser.runtime.sendMessage) {
                browser.runtime.sendMessage(serialized).catch(noop)
            }
            if (browser.tabs) {
                // Send message to Content Script
                browser.tabs.query({ discarded: false }).then(tabs => {
                    for (const tab of tabs) {
                        if (tab.id) browser.tabs.sendMessage(tab.id, serialized).catch(noop)
                    }
                })
            }
        }
        if (alsoSendToDocument && typeof document !== 'undefined' && document.dispatchEvent) {
            const event = new CustomEvent(MessageCenterEvent, {
                detail: await this.serialization.serialization({ data, key }),
            })
            document.dispatchEvent(event)
        }
    }
    /**
     * {@inheritdoc MessageCenter.emit}
     */
    public send(
        ...args: Parameters<MessageCenter<ITypedMessages>['emit']>
    ): ReturnType<MessageCenter<ITypedMessages>['emit']> {
        return Reflect.apply(this.emit, this, args)
    }
    /**
     * Should MessageCenter prints all messages to console?
     */
    writeToConsole = false
}
