/**
 * This file is copied from https://github.com/yusukeshibata/concurrent-lock
 *
 * It is licensed under the MIT license.
 * I copy it here because it is introducing @babel/runtime as a runtime dependency.
 */
class Signal {
    static instances: Signal[] = []
    private _fn: Function | undefined
    static async wait(timeout: number) {
        const signal = new Signal()
        this.instances.push(signal)
        await signal._wait(timeout)
    }
    static fire() {
        const signal = this.instances.shift()
        if (signal) signal._fire()
    }
    _fire(err?: Error) {
        const fn = this._fn
        delete this._fn
        if (fn) fn(err)
    }
    _wait(timeout: number | undefined) {
        return new Promise<void>((resolve, reject) => {
            this._fn = (err: any) => (err ? reject(err) : resolve())
            if (timeout !== undefined) setTimeout(() => this._fire(new Error('Timeout')), timeout)
        })
    }
}

export default class Lock {
    private _locked = 0
    constructor(private _limit = 1) {}
    isLocked() {
        return this._locked >= this._limit
    }
    async lock(timeout: any) {
        if (this.isLocked()) {
            await Signal.wait(timeout)
        }
        this._locked++
    }
    unlock() {
        if (this._locked <= 0) {
            throw new Error('Already unlocked')
        }
        this._locked--
        Signal.fire()
    }
}
