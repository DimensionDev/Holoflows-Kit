import { sleep, timeout } from '../util/sleep'
import { AsyncCall } from './Async-Call'
import { GetContext } from './Context'

/**
 * Based on AsyncCall. Open a new page in the background, execute some task, then close it automatically.
 *
 * Usage:
 *
 * > In content script: (You must run this in the page you wanted to run task in!)
 *
 * ```ts
 * export const task = AutomatedTabTask({
 *   async taskA() {
 *       return 'Done!'
 *   },
 * })
 * ```
 *
 * > In background script:
 *
 * ```ts
 * import { task } from '...'
 * task('https://example.com/').taskA()
 * // Open https://example.com/ then run taskA() on that page, which will return 'Done!'
 * ```
 * @param taskImplements All tasks that background page can call.
 * @param AsyncCallKey A unique key, defaults to a extension specific url.
 */
export function AutomatedTabTask<T extends Record<string, (...args: any[]) => Promise<any>>>(
    taskImplements: T,
    AsyncCallKey = chrome.runtime.getURL('@holoflows/kit:AutomatedTabTask'),
) {
    const REGISTER = AsyncCallKey + ':ping'
    const getTaskNameByTabId = (task: string, tabId: number) => `${task}:${tabId}`
    if (GetContext() === 'content') {
        // If run in content script
        // Register this tab
        chrome.runtime.sendMessage(REGISTER, (sender: chrome.runtime.MessageSender) => {
            const tabId = sender.tab!.id!
            if (!tabId) return
            // Transform `methodA` to `methodA - 233` (if tabId = 233)
            const tasksWithId: any = {}
            for (const [taskName, value] of Object.entries(taskImplements)) {
                tasksWithId[getTaskNameByTabId(taskName, tabId)] = value
            }
            // Register AsyncCall
            AsyncCall(tasksWithId, { key: AsyncCallKey })
        })
        return null
    } else if (GetContext() === 'background') {
        type tabId = number
        /** If `tab` is ready */
        const readyMap: Record<tabId, boolean> = {}
        // Listen to tab REGISTER event
        chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
            if (message === REGISTER) {
                // response its tab id
                sendResponse(sender)
                readyMap[sender.tab!.id!] = true
            }
        })
        // Register a empty AsyncCall for runtime-generated call
        const asyncCall = AsyncCall<any>({}, { key: AsyncCallKey })
        return (
            /** URL you want to execute the task ok */ url: string,
            /** When will the task timed out */ timeoutTime = 30 * 1000,
        ) =>
            new Proxy(
                {},
                {
                    get(_, taskName) {
                        return (...args: any[]) =>
                            new Promise((resolve, reject) => {
                                if (typeof taskName !== 'string') return reject('Key must be a string')
                                // Create a new tab
                                chrome.tabs.create(
                                    {
                                        active: false,
                                        pinned: true,
                                        url: url,
                                    },
                                    async tab => {
                                        const tabId = tab.id!
                                        // Wait for the tab register
                                        while (readyMap[tabId] !== true) await sleep(50)
                                        // Run the async call
                                        const task: Promise<any> = asyncCall[getTaskNameByTabId(taskName, tabId)](
                                            ...args,
                                        )
                                        timeout(task, timeoutTime)
                                            .then(resolve, reject)
                                            .finally(() => {
                                                chrome.tabs.remove(tabId)
                                                delete readyMap[tabId]
                                            })
                                    },
                                )
                            })
                    },
                },
            ) as T
    } else {
        return null
    }
}
