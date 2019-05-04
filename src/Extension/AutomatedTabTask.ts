import { sleep, timeout as timeoutFn } from '../util/sleep'
import { AsyncCall } from './Async-Call'
import { GetContext } from './Context'
import Lock from 'concurrent-lock'

interface AutomatedTabTaskSharedOptions {
    /**
     * Task timeout.
     * @default 30000
     */
    timeout: number
}
export interface AutomatedTabTaskDefineTimeOptions extends AutomatedTabTaskSharedOptions {
    /**
     * At most run `limitSize` tasks.
     * Prevents open too many tabs at the same time.
     * @default 3
     */
    limitSize: number
    /**
     * A unique key
     * @default `a extension specific url.`
     */
    key: string
}
export interface AutomatedTabTaskRuntimeOptions extends AutomatedTabTaskSharedOptions {
    /**
     * If the task is memorable.
     * Memory will keep for 30 mins.
     * - true: Memorize by url and all options
     * - false: Does not use Memory
     * - 'url': Memorize by url only
     * @default false
     */
    memorable: boolean | 'url'
    /**
     * This task is important, need to start now without queue.
     */
    important: boolean
}
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
 * @param options Options
 */
export function AutomatedTabTask<T extends Record<string, (...args: any[]) => Promise<any>>>(
    taskImplements: T,
    options: Partial<AutomatedTabTaskDefineTimeOptions> = {},
) {
    const { timeout: defaultTimeout, key: AsyncCallKey, limitSize } = {
        ...({
            timeout: 30 * 1000,
            key: browser.runtime.getURL('@holoflows/kit:AutomatedTabTask'),
            limitSize: 3,
        } as AutomatedTabTaskDefineTimeOptions),
        ...options,
    }
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
        const lock = new Lock(limitSize)
        async function runTask(url: string, taskName: string, timeout: number, args: any[]) {
            await lock.lock(timeout || defaultTimeout)
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
                return await timeoutFn(task, timeout || defaultTimeout)
            } finally {
                lock.unlock()
                browser.tabs.remove(tabId)
                delete readyMap[tabId]
            }
        }
        return (
            /** URL you want to execute the task ok */ url: string,
            options: Partial<AutomatedTabTaskRuntimeOptions> = {},
        ) => {
            const { memorable, timeout: timeout } = {
                ...({
                    memorable: false,
                } as AutomatedTabTaskRuntimeOptions),
                ...options,
            }

            return new Proxy(
                {},
                {
                    get(_, taskName) {
                        return (...args: any[]) => {
                            if (typeof taskName !== 'string') throw new TypeError('Key must be a string')
                            return runTask(url, taskName, timeout, args)
                        }
                    },
                },
            ) as T
        }
    } else {
        return null
    }
}
