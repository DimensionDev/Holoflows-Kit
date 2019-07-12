/**
 * This is a light implementation of JSON RPC 2.0
 *
 * https://www.jsonrpc.org/specification
 */
import { MessageCenter } from '../Extension/MessageCenter'

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
 * @param replacerAndReceiver - Replacer of JSON.parse/stringify
 */
export const JSONSerialization = (
    [replacer, receiver]: [Parameters<JSON['stringify']>[1], Parameters<JSON['parse']>[1]] = [undefined, undefined],
    space?: string | number | undefined,
) =>
    ({
        async serialization(from) {
            return JSON.stringify(from, replacer, space)
        },
        async deserialization(serialized) {
            return JSON.parse(serialized as string, receiver)
        },
    } as Serialization)

//#endregion
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
    messageChannel: {
        on(event: string, callback: (data: unknown) => void): void
        send(event: string, data: unknown): void
    }
    /** Log what to console */
    log:
        | {
              beCalled?: boolean
              localError?: boolean
              remoteError?: boolean
              type?: 'basic' | 'pretty'
          }
        | boolean
    /** Strict options */
    strict:
        | {
              /** if method not found, return an error */
              methodNotFound?: boolean
              /** do not try to keep `undefined` during transfer (if true, undefined will become null) */
              noUndefined?: boolean
              /** send an error when receive unknown message on the channel */
              unknownMessage?: boolean
          }
        | boolean
    /**
     * How parameters passed to remote
     * @see https://www.jsonrpc.org/specification#parameter_structures
     * @defaults "by-position"
     */
    parameterStructures: 'by-position' | 'by-name'
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
    implementation: Record<string, (...args: any[]) => any> = {},
    options: Partial<AsyncCallOptions> = {},
): OtherSideImplementedFunctions {
    const { serializer, key, strict, log, parameterStructures } = {
        serializer: NoSerialization,
        key: 'default-jsonrpc',
        strict: false,
        log: true,
        parameterStructures: 'by-position' as const,
        ...options,
    }
    const message = options.messageChannel || new MessageCenter()
    const {
        methodNotFound: banMethodNotFound = false,
        noUndefined: noUndefinedKeeping = false,
        unknownMessage: banUnknownMessage = false,
    } =
        typeof strict === 'boolean'
            ? strict
                ? { methodNotFound: true, unknownMessage: true, noUndefined: true }
                : { methodNotFound: false, unknownMessage: false, noUndefined: false }
            : strict
    const {
        beCalled: logBeCalled = true,
        localError: logLocalError = true,
        remoteError: logRemoteError = true,
        type: logType = 'pretty',
    } =
        typeof log === 'boolean'
            ? log
                ? ({ beCalled: true, localError: true, remoteError: true, type: 'pretty' } as const)
                : ({ beCalled: false, localError: false, remoteError: false, type: 'basic' } as const)
            : log
    type PromiseParam = Parameters<(ConstructorParameters<typeof Promise>)[0]>
    const requestContext = new Map<string | number, { f: PromiseParam; stack: string }>()
    async function onRequest(data: Request): Promise<Response | undefined> {
        let frameworkStack: string = ''
        try {
            const executor = implementation[data.method as keyof typeof implementation]
            if (!executor) {
                if (!banMethodNotFound) {
                    if (logLocalError) console.debug('Receive remote call, but not implemented.', key, data)
                    return
                } else return ErrorResponse.MethodNotFound(data.id)
            }
            const params: unknown = data.params
            if (Array.isArray(params) || (typeof params === 'object' && params !== null)) {
                const args = Array.isArray(params) ? params : [params]
                frameworkStack = removeStackHeader(new Error().stack)
                const promise = executor(...args)
                if (logBeCalled)
                    logType === 'basic'
                        ? console.log(`${key}.${data.method}(${[...args].toString()}) @${data.id}`)
                        : console.log(
                              `${key}.%c${data.method}%c(${args.map(() => '%o').join(', ')}%c)\n%o %c@${data.id}`,
                              'color: #d2c057',
                              '',
                              ...args,
                              '',
                              promise,
                              'color: gray; font-style: italic;',
                          )
                return new SuccessResponse(data.id, await promise, !!noUndefinedKeeping)
            } else {
                return ErrorResponse.InvalidRequest(data.id)
            }
        } catch (e) {
            e.stack = frameworkStack
                .split('\n')
                .reduce((stack, fstack) => stack.replace(fstack + '\n', ''), e.stack || '')
            if (logLocalError) console.error(e)
            let name = 'Error'
            name = e.constructor.name
            if (typeof DOMException === 'function' && e instanceof DOMException) name = 'DOMException:' + e.name
            return new ErrorResponse(data.id, -1, e.message, e.stack, name)
        }
    }
    async function onResponse(data: Response): Promise<void> {
        let errorMessage = '',
            remoteErrorStack = '',
            errorCode = 0,
            errorType = 'Error'
        if (hasKey(data, 'error')) {
            errorMessage = data.error.message
            errorCode = data.error.code
            remoteErrorStack = (data.error.data && data.error.data.stack) || '<remote stack not available>'
            errorType = (data.error.data && data.error.data.type) || 'Error'
            if (logRemoteError)
                logType === 'basic'
                    ? console.error(`${errorType}: ${errorMessage}(${errorCode}) @${data.id}\n${remoteErrorStack}`)
                    : console.error(
                          `${errorType}: ${errorMessage}(${errorCode}) %c@${data.id}\n%c${remoteErrorStack}`,
                          'color: gray',
                          '',
                      )
        }
        if (data.id === null || data.id === undefined) return
        const {
            f: [resolve, reject],
            stack: localErrorStack,
        } = requestContext.get(data.id) || { stack: '', f: ([null, null] as any) as PromiseParam }
        if (!resolve) return // drop this response
        requestContext.delete(data.id)
        if (hasKey(data, 'error')) {
            reject(
                RecoverError(
                    errorType,
                    errorMessage,
                    errorCode,
                    // ? We use \u0430 which looks like "a" to prevent browser think "at AsyncCall" is a real stack
                    remoteErrorStack + '\n    \u0430t AsyncCall (rpc) \n' + localErrorStack,
                ),
            )
        } else {
            resolve(data.result)
        }
    }
    message.on(key, async _ => {
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
                if (banUnknownMessage) {
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
                message.send(key, await serializer.serialization(reply))
            } else {
                if (!res) return
                // ? This is a Notification, we MUST not return it.
                if (res.id === undefined) return
                message.send(key, await serializer.serialization(res))
            }
        }
    })
    return new Proxy(
        {},
        {
            get(target, method, receiver) {
                let stack = removeStackHeader(new Error().stack)
                return (...params: any[]) =>
                    new Promise((resolve, reject) => {
                        if (typeof method !== 'string') return reject('Only string can be keys')
                        const id = Math.random()
                            .toString(36)
                            .slice(2)
                        const req =
                            parameterStructures === 'by-name' && params.length === 1 && isObject(params[0])
                                ? new Request(id, method, params[0])
                                : new Request(id, method, params)
                        serializer.serialization(req).then(data => {
                            message.send(key, data)
                            requestContext.set(id, {
                                f: [resolve, reject],
                                stack,
                            })
                        }, reject)
                    })
            },
        },
    ) as OtherSideImplementedFunctions

    async function handleSingleMessage(data: SuccessResponse | ErrorResponse | Request) {
        if (hasKey(data, 'method')) {
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
    constructor(public id: ID, public method: string, public params: any[] | object) {
        return { id, method, params, jsonrpc }
    }
}
class SuccessResponse {
    readonly jsonrpc = '2.0'
    // ? This is not in the spec !
    resultIsUndefined?: boolean
    constructor(public id: ID, public result: any, noUndefinedKeeping: boolean) {
        const obj = { id, jsonrpc, result: result || null } as this
        if (!noUndefinedKeeping && result === undefined) obj.resultIsUndefined = true
        return obj
    }
}
class ErrorResponse {
    readonly jsonrpc = '2.0'
    error: { code: number; message: string; data?: { stack?: string; type?: string } }
    constructor(public id: ID, code: number, message: string, stack: string, type: string = 'Error') {
        if (id === undefined) id = null
        code = Math.floor(code)
        const error = (this.error = { code, message, data: { stack, type } })
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
    if (!isObject(data)) return false
    if (!hasKey(data, 'jsonrpc')) return false
    if (data.jsonrpc !== '2.0') return false
    if (hasKey(data, 'params')) {
        const params = (data as Request).params
        if (!Array.isArray(params) && !isObject(params)) return false
    }
    return true
}
function isObject(params: any) {
    return typeof params === 'object' && params !== null
}
function hasKey<T, Q extends string>(obj: T, key: Q): obj is T & { [key in Q]: unknown } {
    return key in obj
}
class CustomError extends Error {
    constructor(public name: string, message: string, public code: number, public stack: string) {
        super(message)
    }
}
/** These Error is defined in ECMAScript spec */
const errors: Record<string, typeof EvalError> = {
    Error,
    EvalError,
    RangeError,
    ReferenceError,
    SyntaxError,
    TypeError,
    URIError,
}
/**
 * AsyncCall support somehow transfer ECMAScript Error
 */
function RecoverError(type: string, message: string, code: number, stack: string) {
    try {
        if (type.startsWith('DOMException:')) {
            const [_, name] = type.split('DOMException:')
            return new DOMException(message, name)
        } else if (type in errors) {
            const e = new errors[type](message)
            e.stack = stack
            Object.assign(e, { code })
            return e
        } else {
            return new CustomError(type, message, code, stack)
        }
    } catch {
        return new Error(`E${code} ${type}: ${message}\n${stack}`)
    }
}
function removeStackHeader(stack: string = '') {
    return stack.replace(/^.+\n.+\n/, '')
}
