import { sleep, timeout as timeoutFn } from '../util/sleep'
import { AsyncCall } from './Async-Call'
import { GetContext } from './Context'
import Lock from 'concurrent-lock'
import { memorize } from 'memorize-decorator'

interface AutomatedTabTaskSharedOptions {
    /**
     * If the task is memorable.
     * - true: Memorize by url and all options
     * - false: Does not use Memory
     * @default false
     */
    memorable: boolean
    /**
     * Task timeout.
     * @default 30000
     */
    timeout: number
    /**
     * Should the new tab pinned?
     * @default true
     *
     * !TODO: make it false on Vavaldi.
     */
    pinned: boolean
    /**
     * Should the new tab to be closed automatically?
     * @default true
     */
    autoClose: boolean
}
export interface AutomatedTabTaskDefineTimeOptions extends AutomatedTabTaskSharedOptions {
    /**
     * At most run `concurrent` tasks.
     * Prevents open too many tabs at the same time.
     * @default 3
     */
    concurrent: number
    /**
     * A unique key
     * @default `a extension specific url.`
     */
    key: string
    /**
     * TTL for memorize
     * @default 30 * 60 * 1000
     */
    memorizeTTL: number
}
export interface AutomatedTabTaskRuntimeOptions extends AutomatedTabTaskSharedOptions {
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
    const {
        timeout: defaultTimeout,
        key: AsyncCallKey,
        concurrent,
        memorable: defaultMemorable,
        memorizeTTL,
        autoClose: defaultAutoClose,
        pinned: defaultPinned,
    } = {
        ...({
            timeout: 30 * 1000,
            key: browser.runtime.getURL('@holoflows/kit:AutomatedTabTask'),
            concurrent: 3,
            memorizeTTL: 30 * 60 * 1000,
            memorable: false,
            autoClose: true,
            pinned: true,
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
        const lock = new Lock(concurrent)
        async function runTask(
            url: string,
            taskName: string,
            timeout: number,
            withoutLock: boolean,
            pinned: boolean,
            autoClose: boolean,
            args: any[],
        ) {
            if (!withoutLock) await lock.lock(timeout)
            // Create a new tab
            const tab = await browser.tabs.create({
                active: false,
                pinned: pinned,
                url: url,
            })
            const tabId = tab.id!
            // Wait for the tab register
            while (readyMap[tabId] !== true) await sleep(50)
            // Run the async call
            const task: Promise<any> = asyncCall[getTaskNameByTabId(taskName, tabId)](...args)
            try {
                // ! DO NOT Remove `await`, or finally block will run before the promise resolved
                return await timeoutFn(task, timeout)
            } finally {
                if (!withoutLock) lock.unlock()
                autoClose && browser.tabs.remove(tabId)
                delete readyMap[tabId]
            }
        }
        const memoRunTask = memorize(runTask, { ttl: memorizeTTL })
        return (
            /** URL you want to execute the task ok */ url: string,
            options: Partial<AutomatedTabTaskRuntimeOptions> = {},
        ) => {
            const { memorable, timeout, important, autoClose, pinned } = {
                ...({
                    memorable: defaultMemorable,
                    important: false,
                    timeout: defaultTimeout,
                    autoClose: defaultAutoClose,
                    pinned: defaultPinned,
                } as AutomatedTabTaskRuntimeOptions),
                ...options,
            }
            function runner(_: unknown, taskName: string | number | symbol) {
                return (...args: any[]) => {
                    if (typeof taskName !== 'string') throw new TypeError('Key must be a string')
                    return (memorable ? memoRunTask : runTask)(
                        url,
                        taskName,
                        timeout,
                        important,
                        pinned,
                        autoClose,
                        args,
                    )
                }
            }
            return new Proxy({}, { get: runner }) as T
        }
    } else {
        return null
    }
}
