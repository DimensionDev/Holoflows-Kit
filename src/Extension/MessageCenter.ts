type InternalMessageType = {
    key: Key
    data: any
    instanceKey: string
}
type Key = string | number | symbol
const MessageCenterEvent = 'Holoflows-Kit MessageCenter'
const newMessage = (key: InternalMessageType['key'], data: InternalMessageType['data']) =>
    new CustomEvent(MessageCenterEvent, { detail: { data, key } })
const noop = () => {}
/**
 * Send and receive messages in different contexts.
 */
export class MessageCenter<ITypedMessages> {
    private listeners: Array<{ key: Key; handler: (data: any) => void }> = []
    private listener = (request: InternalMessageType | Event) => {
        let { key, data, instanceKey } = (request as CustomEvent).detail || request
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
        this.listeners.filter(it => it.key === key).forEach(it => it.handler(data))
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
     */
    public on<Key extends keyof ITypedMessages>(event: Key, handler: (data: ITypedMessages[Key]) => void): void {
        this.listeners.push({
            handler: data => handler(data),
            key: event,
        })
    }

    /**
     * Send message to local or other instance of extension
     * @param key - Key of the message
     * @param data - Data of the message
     * @param alsoSendToDocument - ! Send message to document. This may leaks secret! Only open in localhost!
     */
    public send<Key extends keyof ITypedMessages>(
        key: Key,
        data: ITypedMessages[Key],
        alsoSendToDocument = location.hostname === 'localhost',
    ): void {
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
        if (typeof browser !== 'undefined') {
            if (browser.runtime && browser.runtime.sendMessage) {
                browser.runtime.sendMessage(msg).catch(noop)
            }
            if (browser.tabs) {
                // Send message to Content Script
                browser.tabs.query({ discarded: false }).then(tabs => {
                    for (const tab of tabs) {
                        if (tab.id) browser.tabs.sendMessage(tab.id, msg).catch(noop)
                    }
                })
            }
        }
        if (alsoSendToDocument && typeof document !== 'undefined' && document.dispatchEvent) {
            document.dispatchEvent(newMessage(key, data))
        }
    }
    writeToConsole = false
}
