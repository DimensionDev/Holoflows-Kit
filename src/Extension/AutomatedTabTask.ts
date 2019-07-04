import { sleep, timeout as timeoutFn } from '../util/sleep'
import { AsyncCall } from './Async-Call'
import { GetContext } from './Context'
import Lock from 'concurrent-lock'
import { memorize } from 'memorize-decorator'

/**
 * Shared options for AutomatedTabTask between the define-time and the runtime.
 */
export interface AutomatedTabTaskSharedOptions {
    /**
     * If the task is memorable.
     * - true: Memorize by url and all options
     * - false: Does not use Memory
     * @defaultValue false
     */
    memorable: boolean
    /**
     * Task timeout.
     * @defaultValue 30000
     */
    timeout: number
    /**
     * Should the new tab pinned?
     * @defaultValue true
     *
     * !TODO: make it false on Vavaldi.
     */
    pinned: boolean
    /**
     * Should the new tab to be closed automatically?
     * @defaultValue true
     */
    autoClose: boolean
    /**
     * Should the new tab to be active?
     * @defaultValue false
     */
    active: boolean
}
/**
 * Define-time options for {@link AutomatedTabTask}
 */
export interface AutomatedTabTaskDefineTimeOptions extends AutomatedTabTaskSharedOptions {
    /**
     * At most run `concurrent` tasks.
     * Prevents open too many tabs at the same time.
     * @defaultValue 3
     */
    concurrent: number
    /**
     * A unique key
     * @defaultValue `a extension specific url.`
     */
    key: string
    /**
     * TTL for memorize
     * @defaultValue 30 * 60 * 1000
     */
    memorizeTTL: number
}
/**
 * Runtime options for {@link AutomatedTabTask}
 */
export interface AutomatedTabTaskRuntimeOptions extends AutomatedTabTaskSharedOptions {
    /**
     * This task is important, need to start now without queue.
     */
    important: boolean
    /**
     * Instead of start a new tab, run the script at the existing tab.
     */
    runAtTabID: number
    /**
     * Use with runAtTabID, tell AutomatedTabTask if you need to redirect the tab to the url provided
     *
     * defaults: false
     */
    needRedirect: boolean
}
/**
 * Open a new page in the background, execute some task, then close it automatically.
 *
 * @example
 *
 * In content script: (You must run this in the page you wanted to run task in!)
 * ```ts
 * export const task = AutomatedTabTask({
 *   async taskA() {
 *       return 'Done!'
 *   },
 * })
 * ```
 *
 * In background script:
 *
 * Open https://example.com/ then run taskA() on that page, which will return 'Done!'
 * ```ts
 * import { task } from '...'
 * task('https://example.com/').taskA()
 * ```
 *
 * @param taskImplements - All tasks that background page can call.
 * @param options - Options
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
        active: defaultActive,
    } = {
        ...({
            timeout: 30 * 1000,
            key: (context => {
                switch (context) {
                    case 'background':
                    case 'content':
                    case 'options':
                        return browser.runtime.getURL('@holoflows/kit:AutomatedTabTask')
                    case 'debugging':
                        return 'debug'
                    case 'unknown':
                    default:
                        throw new TypeError('Unknown running context')
                }
            })(GetContext()),
            concurrent: 3,
            memorizeTTL: 30 * 60 * 1000,
            memorable: false,
            autoClose: true,
            pinned: true,
            active: false,
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
            important: boolean,
            pinned: boolean,
            autoClose: boolean,
            active: boolean,
            runAtTabID: number | undefined,
            needRedirect: boolean,
            args: any[],
        ) {
            /**
             * does it need a lock to avoid too many open at the same time?
             */
            const withoutLock = important || autoClose === false || active || runAtTabID
            if (!withoutLock) await lock.lock(timeout)

            async function getTabOrCreate(openInCurrentTab: number | undefined) {
                if (openInCurrentTab) {
                    if (needRedirect) {
                        // TODO: read the api
                        browser.tabs.executeScript(tabId, { code: 'location.href = ' + url })
                    }
                    return openInCurrentTab
                }
                // Create a new tab
                const tab = await browser.tabs.create({ active, pinned, url })
                return tab.id!
            }
            const tabId = await getTabOrCreate(runAtTabID)

            // Wait for the tab register
            while (readyMap[tabId] !== true) await sleep(50)

            // Run the async call
            const task: Promise<any> = asyncCall[getTaskNameByTabId(taskName, tabId)](...args)
            try {
                // ! DO NOT Remove `await`, or finally block will run before the promise resolved
                return await timeoutFn(task, timeout)
            } finally {
                if (!withoutLock) lock.unlock()
                delete readyMap[tabId]
                autoClose && browser.tabs.remove(tabId)
            }
        }
        const memoRunTask = memorize(runTask, { ttl: memorizeTTL })
        return (
            /** URL you want to execute the task ok */ url: string,
            options: Partial<AutomatedTabTaskRuntimeOptions> = {},
        ) => {
            const { memorable, timeout, important, autoClose, pinned, active, runAtTabID, needRedirect } = {
                ...({
                    memorable: defaultMemorable,
                    important: false,
                    timeout: defaultTimeout,
                    autoClose: typeof options.runAtTabID === 'number' ? false : defaultAutoClose,
                    pinned: defaultPinned,
                    active: defaultActive,
                    needRedirect: false,
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
                        active,
                        runAtTabID,
                        needRedirect,
                        args,
                    )
                }
            }
            return new Proxy({}, { get: runner }) as T
        }
    } else if (GetContext() === 'debugging') {
        return (...args1: any[]) =>
            new Proxy(
                {},
                {
                    get(_, key) {
                        return async (...args2: any) => {
                            console.log(
                                `AutomatedTabTask.${AsyncCallKey}.${String(key)} called with `,
                                ...args1,
                                ...args2,
                            )
                            await sleep(2000)
                        }
                    },
                },
            ) as T
    } else {
        return null
    }
}
