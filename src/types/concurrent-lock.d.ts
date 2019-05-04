declare module 'concurrent-lock' {
    export default class Lock {
        constructor(limit: number)
        isLocked(): boolean
        lock(timeout: number): Promise<void>
        unlock(): void
    }
}
