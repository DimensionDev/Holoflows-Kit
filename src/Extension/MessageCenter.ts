type InternalMessageType = {
    key: Key
    data: any
    instanceKey: string
}
type Key = string | number | symbol
const MessageCenterEvent = 'Holoflows-Kit MessageCenter'
const newMessage = (key: InternalMessageType['key'], data: InternalMessageType['data']) =>
    new CustomEvent(MessageCenterEvent, { detail: { data, key } })
/** Send and receive messages in different contexts. */
export class MessageCenter<ITypedMessages> {
    private listeners: Array<{ key: Key; handler: (data: any) => void }> = []
    // private id: any
    private listener = (request: InternalMessageType | Event) => {
        let key: Key, data: any, instanceKey: string
        if (request instanceof Event) ({ key, data, instanceKey } = (request as CustomEvent).detail)
        else ({ key, data, instanceKey } = request)
        // Message is not for us
        if (this.instanceKey !== instanceKey) return
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
    constructor(private instanceKey?: string) {
        if (chrome && chrome.runtime) {
            // Fired when a message is sent from either an extension process (by runtime.sendMessage)
            // or a content script (by tabs.sendMessage).
            if (chrome.runtime.onMessage) {
                chrome.runtime.onMessage.addListener(this.listener)
            }
            // Fired when a message is sent from another extension/app (by runtime.sendMessage).
            // Cannot be used in a content script.
            if (chrome.runtime.onMessageExternal) {
                chrome.runtime.onMessageExternal.addListener(this.listener)
            }
        }
        if (document && document.addEventListener) {
            document.addEventListener(MessageCenterEvent, this.listener)
        }
    }
    public on<Key extends keyof ITypedMessages>(event: Key, handler: (data: ITypedMessages[Key]) => void): void {
        this.listeners.push({
            handler: data => handler(data),
            key: event,
        })
    }

    /** Send message to local or other instance of extension */
    public send<Key extends keyof ITypedMessages>(key: Key, data: ITypedMessages[Key]): void {
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
        if (chrome && chrome.runtime) {
            if (chrome.runtime.sendMessage) {
                try {
                    chrome.runtime.sendMessage(msg)
                } catch (error) {
                    // if (this.id) {
                    //     chrome.runtime.sendMessage(this.id, msg)
                    // }
                }
            }
        }
        if (document && document.dispatchEvent) {
            document.dispatchEvent(newMessage(key, data))
        }
        // Send message to Content Script
        if (chrome && chrome.tabs) {
            chrome.tabs.query({ discarded: false }, tabs => {
                for (const tab of tabs) {
                    if (tab.id) chrome.tabs.sendMessage(tab.id, msg)
                }
            })
        }
    }
    writeToConsole = false
}
