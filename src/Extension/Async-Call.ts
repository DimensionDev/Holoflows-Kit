import { MessageCenter as HoloflowsMessageCenter } from './MessageCenter'

//#region Serialization
/**
 * Define how to do serialization and deserialization of remote procedure call
 */
export interface Serialization {
    serialization(from: any): Promise<unknown>
    deserialization(serialized: unknown): Promise<any>
}
/**
 * Serialization implementation that do nothing
 */
export const NoSerialization: Serialization = {
    async serialization(from) {
        return from
    },
    async deserialization(serialized) {
        return serialized
    },
}
/**
 * Serialization implementation by JSON.parse/stringify
 *
 * @param replacer - Replacer of JSON.parse/stringify
 */
export const JSONSerialization = (replacer: Parameters<JSON['parse']>[1] = undefined) =>
    ({
        async serialization(from) {
            return JSON.stringify(from, replacer)
        },
        async deserialization(serialized) {
            return JSON.parse(serialized as string, replacer)
        },
    } as Serialization)
//#endregion
/**
 * Options of {@link AsyncCall}
 * @alpha
 */
export interface AsyncCallExecutorOptions
    extends Partial<{
        /**
         * Allow this function to be memorized for `memorable` ms.
         */
        memorable: number
    }> {}
type Default = Record<string, ((...args: any[]) => Promise<any>) & AsyncCallExecutorOptions>
type GeneratorDefault = Record<string, ((...args: any[]) => AsyncIterableIterator<any>) & AsyncCallExecutorOptions>
/**
 * Options for {@link AsyncCall}
 */
export interface AsyncCallOptions {
    /**
     * @param key -
     * A key to prevent collision with other AsyncCalls. Can be anything, but need to be the same on the both side.
     */
    key: string
    /**
     * @param serializer -
     * How to serialization and deserialization parameters and return values
     *
     * We offer some built-in serializer:
     * - NoSerialization (Do not do any serialization)
     * - JSONSerialization (Use JSON.parse/stringify)
     */
    serializer: Serialization
    /**
     * @param MessageCenter - A class that can let you transfer messages between two sides
     */
    MessageCenter: {
        new (): {
            on(event: string, cb: (data: any) => void): void
            send(event: string, data: any): void
        }
    }
    /**
     * @param dontThrowOnNotImplemented -
     * If this side receive messages that we didn't implemented, throw an error
     */
    dontThrowOnNotImplemented: boolean
    /**
     * @param writeToConsole - Write all calls to console.
     */
    writeToConsole: boolean
}
/**
 * Async call between different context.
 *
 * @remarks
 * Async call is a high level abstraction of MessageCenter.
 *
 * # Shared code
 *
 * - How to stringify/parse parameters/returns should be shared, defaults to NoSerialization.
 *
 * - `key` should be shared.
 *
 * # One side
 *
 * - Should provide some functions then export its type (for example, `BackgroundCalls`)
 *
 * - `const call = AsyncCall<ForegroundCalls>(backgroundCalls)`
 *
 * - Then you can `call` any method on `ForegroundCalls`
 *
 * # Other side
 *
 * - Should provide some functions then export its type (for example, `ForegroundCalls`)
 *
 * - `const call = AsyncCall<BackgroundCalls>(foregroundCalls)`
 *
 * - Then you can `call` any method on `BackgroundCalls`
 *
 * Note: Two sides can implement the same function
 *
 * @example
 * For example, here is a mono repo.
 *
 * Code for UI part:
 * ```ts
 * const UI = {
 *      async dialog(text: string) {
 *          alert(text)
 *      },
 * }
 * export type UI = typeof UI
 * const callsClient = AsyncCall<Server>(UI)
 * callsClient.sendMail('hello world', 'what')
 * ```
 *
 * Code for server part
 * ```ts
 * const Server = {
 *      async sendMail(text: string, to: string) {
 *          return true
 *      }
 * }
 * export type Server = typeof Server
 * const calls = AsyncCall<UI>(Server)
 * calls.dialog('hello')
 * ```
 *
 * @param implementation - Implementation of this side.
 * @param options - Define your own serializer, MessageCenter or other options.
 *
 */
export function AsyncCall<OtherSideImplementedFunctions = {}>(
    implementation: Default,
    options: Partial<AsyncCallOptions> = {},
): OtherSideImplementedFunctions {
    const { writeToConsole, serializer, dontThrowOnNotImplemented, MessageCenter, key } = {
        MessageCenter: HoloflowsMessageCenter,
        dontThrowOnNotImplemented: true,
        serializer: NoSerialization,
        writeToConsole: true,
        key: 'default',
        ...options,
    } as Required<typeof options>
    const message = new MessageCenter()
    const CALL = `${key}-call`
    const RESPONSE = `${key}-return`
    type PromiseParam = Parameters<(ConstructorParameters<typeof Promise>)[0]>
    const map = new Map<string, PromiseParam>()
    message.on(CALL, async (_data: unknown) => {
        const data: Request = await serializer.deserialization(_data)
        try {
            const executor = implementation[data.method as keyof typeof implementation]
            if (!executor) {
                if (dontThrowOnNotImplemented) {
                    return console.debug('Receive remote call, but not implemented.', key, data)
                } else {
                    throw new Error(`Remote-call: ${data.method}() not implemented!`)
                }
            }
            const args: any[] = data.args
            const promise = executor(...args)
            if (writeToConsole)
                console.log(
                    `${key}.%c${data.method}%c(${args.map(() => '%o').join(', ')}%c)\n%o %c@${data.callId}`,
                    'color: #d2c057',
                    '',
                    ...args,
                    '',
                    promise,
                    'color: gray; font-style: italic;',
                )
            const result = await promise
            const response: Response = {
                method: data.method,
                return: result,
                callId: data.callId,
            }
            message.send(RESPONSE, await serializer.serialization(response))
        } catch (err) {
            if (writeToConsole) console.error(`${err.message} %c@${data.callId}\n%c${err.stack}`, 'color: gray', '')
            const response = await serializer.serialization({
                method: data.method,
                error: err instanceof Error ? { message: err.message, stack: err.stack } : err,
                return: undefined,
                callId: data.callId,
            })
            message.send(RESPONSE, response)
        }
    })
    message.on(RESPONSE, async (_data: unknown) => {
        const data: Response = await serializer.deserialization(_data)
        const [resolve, reject] = map.get(data.callId) || (([null, null] as any) as PromiseParam)
        if (!resolve) return // drop this response
        map.delete(data.callId)
        if (data.error) {
            const err = new Error(data.error.message)
            err.stack = data.error.stack
            reject(err)
            if (writeToConsole)
                console.error(`${data.error.message} %c@${data.callId}\n%c${data.error.stack}`, 'color: gray', '')
        } else {
            resolve(data.return)
        }
    })
    interface Request {
        method: string
        args: any[]
        callId: string
    }
    interface Response {
        return: any
        callId: string
        method: string
        error?: { message: string; stack: string }
    }
    return new Proxy(
        {},
        {
            get(target, method, receiver) {
                return (...args: any[]) =>
                    new Promise((resolve, reject) => {
                        if (typeof method !== 'string') return reject('Only string can be keys')
                        const id = Math.random()
                            .toString(36)
                            .slice(2)
                        const req: Request = { method: method, args: args, callId: id }
                        serializer.serialization(req).then(data => {
                            message.send(CALL, data)
                            map.set(id, [resolve, reject])
                        }, reject)
                    })
            },
        },
    ) as OtherSideImplementedFunctions
}

// Generator version for AsyncCall seems not quite useful.
// If someone need it, open an issue.
// export const AsyncGeneratorCall = <OtherSideImplementedFunctions extends GeneratorDefault = {}>(
//     /**
//      * @param implementation
//      * Implementation of this side.
//      */
//     implementation: GeneratorDefault,
//     /**
//      * @param options
//      * You can define your own serializer, MessageCenter and other options.
//      */
//     options: Partial<AsyncCallOptions> = {},
// ) => {
//     return {} as OtherSideImplementedFunctions
// }
