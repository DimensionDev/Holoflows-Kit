/**
 * This is a light implementation of JSON RPC 2.0
 *
 * https://www.jsonrpc.org/specification
 *
 * ! Not implemented:
 * - Send Notification (receive Notification is okay)
 * - Batch invocation (defined in the section 6 of the spec)
 */
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
    /**
     * @param strictJSONRPC - strict mode.
     * Open this option, `undefined` and `null` will all becomes `null`
     * When receive unknown message on the message channel, will response an error response
     */
    strictJSONRPC: boolean
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
    const { writeToConsole, serializer, dontThrowOnNotImplemented, MessageCenter, key, strictJSONRPC } = {
        MessageCenter: HoloflowsMessageCenter,
        dontThrowOnNotImplemented: true,
        serializer: NoSerialization,
        writeToConsole: true,
        key: 'default',
        strictJSONRPC: false,
        ...options,
    } as Required<typeof options>
    const message = new MessageCenter()
    const CALL = `${key}-jsonrpc`
    type PromiseParam = Parameters<(ConstructorParameters<typeof Promise>)[0]>
    const map = new Map<string | number, PromiseParam>()
    async function onRequest(data: Request): Promise<Response | undefined> {
        try {
            const executor = implementation[data.method as keyof typeof implementation]
            if (!executor) {
                if (dontThrowOnNotImplemented) {
                    console.debug('Receive remote call, but not implemented.', key, data)
                    return
                } else return ErrorResponse.MethodNotFound(data.id)
            }
            const args: any[] = data.params
            const promise = executor(...args)
            if (writeToConsole)
                console.log(
                    `${key}.%c${data.method}%c(${args.map(() => '%o').join(', ')}%c)\n%o %c@${data.id}`,
                    'color: #d2c057',
                    '',
                    ...args,
                    '',
                    promise,
                    'color: gray; font-style: italic;',
                )
            return new SuccessResponse(data.id, await promise)
        } catch (e) {
            return new ErrorResponse(data.id, -1, e.message, e.stack)
        }
    }
    async function onResponse(data: Response): Promise<void> {
        if ('error' in data && writeToConsole)
            console.error(
                `${data.error.message}(${data.error.code}) %c@${data.id}\n%c${data.error.data.stack}`,
                'color: gray',
                '',
            )
        if (data.id === null) return
        const [resolve, reject] = map.get(data.id) || (([null, null] as any) as PromiseParam)
        if (!resolve) return // drop this response
        map.delete(data.id)
        if ('error' in data) {
            const err = new Error(data.error.message)
            err.stack = data.error.data.stack
            reject(err)
        } else {
            resolve(data.result)
        }
    }
    message.on(CALL, async _ => {
        try {
            const data: unknown = await serializer.deserialization(_)
            if (isJSONRPCObject(data)) {
                if ('method' in data) {
                    await send(await onRequest(data))
                } else if ('error' in data || 'result' in data) {
                    if ('resultIsUndefined' in data && data.result === null) {
                        data.result = undefined
                    }
                    onResponse(data)
                } else {
                    await send(ErrorResponse.InvalidRequest((data as any).id || null))
                }
            } else if (Array.isArray(data) && data.every(isJSONRPCObject)) {
                await send(ErrorResponse.InternalError(null, ": Async-Call isn't implement patch jsonrpc yet."))
            } else {
                if (strictJSONRPC) {
                    await send(ErrorResponse.InvalidRequest(null))
                } else {
                    // ? Ignore this message. The message channel maybe also used to transfer other message too.
                }
            }
        } catch (e) {
            console.error(e)
            send(ErrorResponse.ParseError(e.stack))
        }
        async function send(res?: Response) {
            if (!res) return
            message.send(CALL, await serializer.serialization(res))
        }
    })
    return new Proxy(
        {},
        {
            get(target, method, receiver) {
                return (...params: any[]) =>
                    new Promise((resolve, reject) => {
                        if (typeof method !== 'string') return reject('Only string can be keys')
                        const id = Math.random()
                            .toString(36)
                            .slice(2)
                        const req = new Request(id, method, params)
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
const jsonrpc = '2.0'
class Request {
    readonly jsonrpc = '2.0'
    constructor(public id: string, public method: string, public params: any[]) {
        return { id, method, params, jsonrpc }
    }
}
class SuccessResponse {
    readonly jsonrpc = '2.0'
    // ? This is not in the spec !
    resultIsUndefined?: boolean
    constructor(public id: string | number | null, public result: any) {
        const obj = { id, jsonrpc, result: result === undefined ? null : result } as this
        return obj
    }
}
class ErrorResponse {
    readonly jsonrpc = '2.0'
    error: { code: number; message: string; data: { stack: string } }
    constructor(public id: string | number | null, code: number, message: string, stack: string) {
        const error = (this.error = { code, message, data: { stack } })
        return { error, id, jsonrpc }
    }
    // Pre defined error in section 5.1
    static readonly ParseError = (stack = '') => new ErrorResponse(null, -32700, 'Parse error', stack)
    static readonly InvalidRequest = (id: string | number | null) =>
        new ErrorResponse(id, -32600, 'Invalid Request', '')
    static readonly MethodNotFound = (id: string | number) => new ErrorResponse(id, -32601, 'Method not found', '')
    static readonly InvalidParams = (id: string | number) => new ErrorResponse(id, -32602, 'Invalid params', '')
    static readonly InternalError = (id: string | number | null, message: string = '') =>
        new ErrorResponse(id, -32603, 'Internal error' + message, '')
}
type Response = SuccessResponse | ErrorResponse
function isJSONRPCObject(data: any): data is Response | Request {
    return typeof data === 'object' && data !== null && 'jsonrpc' in data && data.jsonrpc === '2.0'
}
