import { sleep, timeout as timeoutFn } from '../util/sleep'
import { AsyncCall, AsyncCallOptions } from '../util/AsyncCall'
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
     * TTL for memorize
     * @defaultValue 30 * 60 * 1000
     */
    memorizeTTL: number
    /**
     * Options when creating AsyncCall
     */
    AsyncCallOptions: Partial<AsyncCallOptions>
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
     * @defaultValue false
     */
    needRedirect: boolean
    /**
     * What URL you want to run the task on
     */
    url: string
}
const AutomatedTabTaskDefineTimeOptionsDefault: Readonly<AutomatedTabTaskDefineTimeOptions> = {
    timeout: 30 * 1000,
    concurrent: 3,
    memorizeTTL: 30 * 60 * 1000,
    memorable: false,
    autoClose: true,
    pinned: true,
    active: false,
    AsyncCallOptions: {},
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
export function AutomatedTabTask<T extends Record<string, (...args: any[]) => PromiseLike<any>>>(
    taskImplements: T,
    options: Partial<AutomatedTabTaskDefineTimeOptions> = {},
): ((urlOrTabID: string | number, options?: Partial<AutomatedTabTaskRuntimeOptions>) => T) | null {
    const {
        timeout: defaultTimeout,
        concurrent,
        memorable: defaultMemorable,
        memorizeTTL,
        autoClose: defaultAutoClose,
        pinned: defaultPinned,
        active: defaultActive,
        AsyncCallOptions,
    } = {
        ...AutomatedTabTaskDefineTimeOptionsDefault,
        ...options,
    }
    if (AsyncCallOptions.key === undefined) {
        AsyncCallOptions.key = GetDefaultKey()
    }
    const AsyncCallKey = AsyncCallOptions.key
    const REGISTER = AsyncCallKey + ':ping'
    if (GetContext() === 'content') {
        // If run in content script
        // Register this tab
        browser.runtime.sendMessage({ type: REGISTER }).then(
            (sender: browser.runtime.MessageSender) => {
                const tabId = sender.tab!.id!
                if (typeof tabId !== 'number') return
                // Transform `methodA` to `methodA:233` (if tabId = 233)
                const tasksWithId: any = {}
                for (const [taskName, value] of Object.entries(taskImplements)) {
                    tasksWithId[getTaskNameByTabId(taskName, tabId)] = value
                }
                // Register AsyncCall
                AsyncCall(tasksWithId, AsyncCallOptions)
            },
            () => {},
        )
        return null
    } else if (GetContext() === 'background' || GetContext() === 'options') {
        type tabId = number
        /** If `tab` is ready */
        const tabReadyMap: Set<tabId> = new Set()
        // Listen to tab REGISTER event
        browser.runtime.onMessage.addListener(((message, sender) => {
            if ((message as any).type === REGISTER) {
                tabReadyMap.add(sender.tab!.id!)
                // response its tab id
                return Promise.resolve(sender)
            }
            return undefined
        }) as browser.runtime.onMessageVoid)
        // Register a empty AsyncCall for runtime-generated call
        const asyncCall = AsyncCall<any>({}, AsyncCallOptions)
        const lock = new Lock(concurrent)
        const memoRunTask = memorize(createOrGetTheTabToExecuteTask, { ttl: memorizeTTL })
        /**
         * @param urlOrTabID - where to run the task
         * string: URL you want to execute the task
         * number: task id you want to execute the task
         * @param options - runtime options
         */
        function taskStarter(urlOrTabID: string | number, options: Partial<AutomatedTabTaskRuntimeOptions> = {}) {
            const {
                memorable,
                timeout,
                important: isImportant,
                autoClose,
                pinned,
                active,
                runAtTabID,
                needRedirect,
                url,
            } = {
                ...({
                    memorable: defaultMemorable,
                    important: false,
                    timeout: defaultTimeout,
                    autoClose: typeof urlOrTabID === 'number' || options.runAtTabID ? false : defaultAutoClose,
                    pinned: defaultPinned,
                    active: defaultActive,
                    needRedirect: false,
                } as AutomatedTabTaskRuntimeOptions),
                ...options,
            }
            let tabID: number | undefined
            if (typeof urlOrTabID === 'number') tabID = urlOrTabID
            else tabID = runAtTabID

            let finalURL: string
            if (typeof urlOrTabID === 'string') finalURL = urlOrTabID
            else finalURL = url || ''
            function proxyTrap(_target: unknown, taskName: string | number | symbol) {
                return (...taskArgs: any[]) => {
                    if (typeof taskName !== 'string') throw new TypeError('Key must be a string')
                    return (memorable ? memoRunTask : createOrGetTheTabToExecuteTask)({
                        active,
                        taskName,
                        timeout,
                        isImportant,
                        pinned,
                        autoClose,
                        needRedirect,
                        taskArgs,
                        asyncCall,
                        lock,
                        tabID,
                        tabReadyMap,
                        url: finalURL,
                    })
                }
            }
            return new Proxy({}, { get: proxyTrap }) as T
        }
        return taskStarter
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

interface createOrGetTheTabToExecuteTaskOptions {
    url: string
    taskName: string
    timeout: number
    isImportant: boolean
    pinned: boolean
    autoClose: boolean
    active: boolean
    tabID: number | undefined
    needRedirect: boolean
    taskArgs: any[]
    asyncCall: any
    tabReadyMap: Set<number>
    lock: Lock
}
async function createOrGetTheTabToExecuteTask(options: createOrGetTheTabToExecuteTaskOptions) {
    const { active, taskArgs, autoClose, isImportant, needRedirect, pinned, tabID: wantedTabID } = options
    const { asyncCall, tabReadyMap, lock, taskName, timeout, url } = options
    /**
     * does it need a lock to avoid too many open at the same time?
     */
    const withoutLock = Boolean(isImportant || autoClose === false || active || typeof wantedTabID !== 'number')
    if (!withoutLock) await lock.lock(timeout)

    const tabId = await getTabOrCreate(wantedTabID, url, needRedirect, active, pinned)

    // Wait for the tab register
    while (tabReadyMap.has(tabId) !== true) await sleep(50)

    // Run the async call
    const task: Promise<any> = asyncCall[getTaskNameByTabId(taskName, tabId)](...taskArgs)
    try {
        // ! DO NOT Remove `await`, or finally block will run before the promise resolved
        return await timeoutFn(task, timeout)
    } finally {
        if (!withoutLock) lock.unlock()
        autoClose && browser.tabs.remove(tabId)
    }
}

async function getTabOrCreate(
    openInCurrentTab: number | undefined,
    url: string,
    needRedirect: boolean,
    active: boolean,
    pinned: boolean,
) {
    if (typeof openInCurrentTab === 'number') {
        if (needRedirect) {
            // TODO: read the api
            browser.tabs.executeScript(openInCurrentTab, { code: 'location.href = ' + url })
        }
        return openInCurrentTab
    }
    // Create a new tab
    const tab = await browser.tabs.create({ active, pinned, url })
    return tab.id!
}

function getTaskNameByTabId(task: string, tabId: number) {
    return `${task}:${tabId}`
}

function GetDefaultKey() {
    const context = GetContext()
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
}
