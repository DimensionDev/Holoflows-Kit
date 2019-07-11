/**
 * This is a light implementation of JSON RPC 2.0
 *
 * https://www.jsonrpc.org/specification
 */
import { MessageCenter as HoloflowsMessageCenter } from '../Extension/MessageCenter'

//#region Serialization
/**
 * Define how to do serialization and deserialization of remote procedure call
 */
export interface Serialization {
    /**
     * Do serialization
     * @param from - original data
     */
    serialization(from: any): PromiseLike<unknown>
    /**
     * Do deserialization
     * @param serialized - Serialized data
     */
    deserialization(serialized: unknown): PromiseLike<any>
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
 * todo: Not implemented yet.
 *
 * @alpha
 */
interface AsyncCallExecutorOptions
    extends Partial<{
        /**
         * Allow this function to be memorized for `memorable` ms.
         */
        memorable: number
    }> {}
/**
 * Options for {@link AsyncCall}
 */
export interface AsyncCallOptions {
    /**
     * A key to prevent collision with other AsyncCalls. Can be anything, but need to be the same on the both side.
     */
    key: string
    /**
     * How to serialization and deserialization parameters and return values
     *
     * @remarks
     * We offer some built-in serializer:
     * - NoSerialization (Do not do any serialization)
     * - JSONSerialization (Use JSON.parse/stringify)
     */
    serializer: Serialization
    /**
     * A class that can let you transfer messages between two sides
     */
    MessageCenter:
        | {
              new (): {
                  on(event: string, callback: (data: any) => void): void
                  send(event: string, data: any): void
              }
          }
        | {
              on(event: string, callback: (data: any) => void): void
              send(event: string, data: any): void
          }
    /**
     * If this side receive messages that we didn't implemented, throw an error
     */
    dontThrowOnNotImplemented: boolean
    /**
     * Write all calls to console.
     */
    writeToConsole: boolean
    /**
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
    implementation: Record<string, (...args: any[]) => PromiseLike<any>>,
    options: Partial<AsyncCallOptions> = {},
): OtherSideImplementedFunctions {
    const { writeToConsole, serializer, dontThrowOnNotImplemented, MessageCenter, key, strictJSONRPC } = {
        MessageCenter: HoloflowsMessageCenter,
        dontThrowOnNotImplemented: true,
        serializer: NoSerialization,
        writeToConsole: true,
        key: 'default-jsonrpc',
        strictJSONRPC: false,
        ...options,
    } as Required<typeof options>
    const message = typeof MessageCenter === 'function' ? new MessageCenter() : MessageCenter
    const CALL = `${key}`
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
            return new SuccessResponse(data.id, await promise, strictJSONRPC)
        } catch (e) {
            console.error(e)
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
        if (data.id === null || data.id === undefined) return
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
        let data: unknown
        let result: Response | undefined = undefined
        try {
            data = await serializer.deserialization(_)
            if (isJSONRPCObject(data)) {
                result = await handleSingleMessage(data)
                if (result) await send(result)
            } else if (Array.isArray(data) && data.every(isJSONRPCObject) && data.length !== 0) {
                const result = await Promise.all(data.map(handleSingleMessage))
                // ? Response
                if (data.every(x => x === undefined)) return
                await send(result.filter(x => x))
            } else {
                if (strictJSONRPC) {
                    await send(ErrorResponse.InvalidRequest((data as any).id || null))
                } else {
                    // ? Ignore this message. The message channel maybe also used to transfer other message too.
                }
            }
        } catch (e) {
            console.error(e, data, result)
            send(ErrorResponse.ParseError(e.stack))
        }
        async function send(res?: Response | (Response | undefined)[]) {
            if (Array.isArray(res)) {
                const reply = res.map(x => x).filter(x => x!.id !== undefined)
                if (reply.length === 0) return
                message.send(CALL, await serializer.serialization(reply))
            } else {
                if (!res) return
                // ? This is a Notification, we MUST not return it.
                if (res.id === undefined) return
                message.send(CALL, await serializer.serialization(res))
            }
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

    async function handleSingleMessage(data: SuccessResponse | ErrorResponse | Request) {
        if ('method' in data) {
            return onRequest(data)
        } else if ('error' in data || 'result' in data) {
            onResponse(data)
        } else {
            if ('resultIsUndefined' in data) {
                ;(data as any).result = undefined
                onResponse(data)
            } else return ErrorResponse.InvalidRequest((data as any).id)
        }
        return undefined
    }
}

const jsonrpc = '2.0'
type ID = string | number | null | undefined
class Request {
    readonly jsonrpc = '2.0'
    constructor(public id: ID, public method: string, public params: any[]) {
        return { id, method, params, jsonrpc }
    }
}
class SuccessResponse {
    readonly jsonrpc = '2.0'
    // ? This is not in the spec !
    resultIsUndefined?: boolean
    constructor(public id: ID, public result: any, strictMode: boolean) {
        const obj = { id, jsonrpc, result: result || null } as this
        if (!strictMode && result === undefined) obj.resultIsUndefined = true
        return obj
    }
}
class ErrorResponse {
    readonly jsonrpc = '2.0'
    error: { code: number; message: string; data: { stack: string } }
    constructor(public id: ID, code: number, message: string, stack: string) {
        if (id === undefined) id = null
        code = Math.floor(code)
        const error = (this.error = { code, message, data: { stack } })
        return { error, id, jsonrpc }
    }
    // Pre defined error in section 5.1
    static readonly ParseError = (stack = '') => new ErrorResponse(null, -32700, 'Parse error', stack)
    static readonly InvalidRequest = (id: ID) => new ErrorResponse(id, -32600, 'Invalid Request', '')
    static readonly MethodNotFound = (id: ID) => new ErrorResponse(id, -32601, 'Method not found', '')
    static readonly InvalidParams = (id: ID) => new ErrorResponse(id, -32602, 'Invalid params', '')
    static readonly InternalError = (id: ID, message: string = '') =>
        new ErrorResponse(id, -32603, 'Internal error' + message, '')
}
type Response = SuccessResponse | ErrorResponse
function isJSONRPCObject(data: any): data is Response | Request {
    return typeof data === 'object' && data !== null && 'jsonrpc' in data && data.jsonrpc === '2.0'
}
