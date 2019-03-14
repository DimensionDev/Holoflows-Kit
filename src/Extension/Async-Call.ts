/** transform Parameters and return values between value and string */
export interface AsyncCallTransform<Param extends any[], Return> {
    stringifyParam?(...args: Param): Promise<string>
    parseParam?(result: string): Promise<Param>
    stringifyReturn?(data: Return): Promise<string>
    parseReturn?(result: string): Promise<Return>
}
type Fn<T> = T extends (...args: any[]) => any ? T : never
type PromiseOf<T> = T extends PromiseLike<infer U> ? U : never

function defaultParse(x: string): any {
    return x
}
function defaultStringify(x: any) {
    return x
}
/**
 * Async call between different context.
 *
 * High level abstraction of MessageCenter.
 *
 * > Shared code
 * - How to stringify/parse parameters/returns should be shared, defaults to JSON.stringify/parse. (`protocol`)
 * - The superset of all calls should be shared. (`AllCalls`)
 * - `key` should be shared.
 *
 * > One side
 * - Should implement a subset of `AllCalls` and export its type (for example, `BackgroundCalls`)
 * - `const call = AsyncCall<AllCalls, ForegroundCalls>('my-app', backgroundCalls, protocol)`
 * - Then you can `call` any method on `ForegroundCalls`
 *
 * > Other side
 * - Should implement a subset of `AllCalls` and export its type (for example, `ForegroundCalls`)
 * - `const call = AsyncCall<AllCalls, BackgroundCalls>('my-app', foregroundCalls, protocol)`
 * - Then you can `call` any method on `BackgroundCalls`
 *
 * Note: Two sides can implement the same function
 *
 * Example:
 * ```typescript
 * 
 // Mono repo
 // UI part
 const UI = {
     async dialog(text: string) {
         alert(text)
     },
 }
 export type UI = typeof UI
 const callsClient = AsyncCall<UI & Server, Server>('my-app', UI, {}, MessageCenter)
 callsClient.sendMail('hello world', 'what')
 
 // On server
 const Server = {
     async sendMail(text: string, to: string) {
         return 1
     },
 }
 export type Server = typeof Server
 const calls = AsyncCall<UI & Server, UI>('my-app', Server, {}, MessageCenter)
 calls.dialog('hello')
 * ```
 */
export const AsyncCall = <AllCalls, OtherSide extends Partial<AllCalls>>(
    key: string,
    implementation: Partial<AllCalls>,
    protocol: {
        [key in keyof AllCalls]?: AsyncCallTransform<
            Parameters<Fn<AllCalls[key]>>,
            PromiseOf<ReturnType<Fn<AllCalls[key]>>>
        >
    } = {},
    messageCenter: {
        new (key: string): {
            on(event: string, cb: (data: any) => void): void
            send(event: string, data: any): void
        }
    },
    dontThrowOnNotImplemented = false,
): OtherSide => {
    const mc = new messageCenter(`${key}-async-call`)
    Object.assign(mc, { writeToConsole: true })
    const map = new Map<number, [any, any]>()
    function transform(type: 'stringify', subject: 'param' | 'return', method: string, data: any[]): Promise<string>
    function transform(type: 'parse', subject: 'param' | 'return', method: string, data: string): Promise<any[]>
    async function transform(
        type: 'stringify' | 'parse',
        subject: 'param' | 'return',
        method: string,
        data: any,
    ): Promise<any> {
        const prot = (protocol[method as keyof typeof protocol] || {}) as AsyncCallTransform<any, any>
        const f = {
            parse: {
                param: () => (prot.parseParam ? prot.parseParam(data) : Promise.resolve(defaultParse(data))),
                return: () => (prot.parseReturn ? prot.parseReturn(data) : Promise.resolve(defaultParse(data))),
            },
            stringify: {
                param: () =>
                    prot.stringifyParam ? prot.stringifyParam(data) : Promise.resolve(defaultStringify(data)),
                return: () =>
                    prot.stringifyReturn ? prot.stringifyReturn(data) : Promise.resolve(defaultStringify(data)),
            },
        }
        return f[type][subject]()
    }
    mc.on('call', (data: Request) => {
        if (data.method in implementation) {
            const p = (implementation[data.method as keyof typeof implementation] as any) as ((
                ...args: any[]
            ) => Promise<any>)
            const e = (err: Error) => {
                console.error(err)
                mc.send('response', {
                    callId: data.callId,
                    return: undefined,
                    error: err && err.message,
                    method: data.method,
                })
            }
            if (!p) {
                if (dontThrowOnNotImplemented) {
                    console.debug('Receive remote call, but not implemented.', key, data)
                } else {
                    e(new Error(`Remote-call: ${data.method}() not implemented!`))
                }
                return
            }
            async function run() {
                const args = await transform('parse', 'param', data.method, data.args)
                const result = await p(...args)
                return await transform('stringify', 'return', data.method, result)
            }
            run().then(str => mc.send('response', { callId: data.callId, return: str, method: data.method }), e)
        }
    })
    mc.on('response', (data: Response) => {
        const [resolve, reject] = map.get(data.callId) || [false, false]
        if (!resolve) return // drop this response
        map.delete(data.callId)
        if (data.error) return reject(data.error)
        transform('parse', 'return', data.method, data.return).then(resolve, reject)
    })
    interface Request {
        method: string
        args: string
        callId: number
    }
    interface Response {
        return: any
        callId: number
        method: string
        error?: Error
    }
    return new Proxy(
        {},
        {
            get(target, method, receiver) {
                return (...args: any[]) =>
                    new Promise((resolve, reject) => {
                        if (typeof method !== 'string') return reject('Only string can be keys')
                        const id = Math.random()

                        transform('stringify', 'param', method, args).then(data => {
                            mc.send('call', { method: method, callId: id, args: data })
                            map.set(id, [resolve, reject])
                        }, reject)
                    })
            },
        },
    ) as any
}
