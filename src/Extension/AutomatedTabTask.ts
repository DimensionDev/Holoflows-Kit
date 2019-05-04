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
    AsyncCallKey = browser.runtime.getURL('@holoflows/kit:AutomatedTabTask'),
) {
    const REGISTER = AsyncCallKey + ':ping'
    const getTaskNameByTabId = (task: string, tabId: number) => `${task}:${tabId}`
    if (GetContext() === 'content') {
        // If run in content script
        // Register this tab
        browser.runtime.sendMessage({ type: REGISTER }).then(
            (sender: browser.runtime.MessageSender) => {
                const tabId = sender.tab!.id!
                if (!tabId) return
                // Transform `methodA` to `methodA:233` (if tabId = 233)
                const tasksWithId: any = {}
                for (const [taskName, value] of Object.entries(taskImplements)) {
                    tasksWithId[getTaskNameByTabId(taskName, tabId)] = value
                }
                // Register AsyncCall
                AsyncCall(tasksWithId, { key: AsyncCallKey })
            },
            () => {},
        )
        return null
    } else if (GetContext() === 'background' || GetContext() === 'options') {
        type tabId = number
        /** If `tab` is ready */
        const readyMap: Record<tabId, boolean> = {}
        // Listen to tab REGISTER event
        browser.runtime.onMessage.addListener(((message, sender) => {
            if ((message as any).type === REGISTER) {
                readyMap[sender.tab!.id!] = true
                // response its tab id
                return Promise.resolve(sender)
            }
            return undefined
        }) as browser.runtime.onMessageVoid)
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
                            new Promise(async (resolve, reject) => {
                                if (typeof taskName !== 'string') return reject('Key must be a string')
                                // Create a new tab
                                const tab = await browser.tabs.create({
                                    active: false,
                                    pinned: true,
                                    url: url,
                                })
                                const tabId = tab.id!
                                // Wait for the tab register
                                while (readyMap[tabId] !== true) await sleep(50)
                                // Run the async call
                                const task: Promise<any> = asyncCall[getTaskNameByTabId(taskName, tabId)](...args)
                                try {
                                    resolve(await timeout(task, timeoutTime))
                                } catch (e) {
                                    reject(e)
                                } finally {
                                    browser.tabs.remove(tabId)
                                    delete readyMap[tabId]
                                }
                            })
                    },
                },
            ) as T
    } else {
        return null
    }
}
