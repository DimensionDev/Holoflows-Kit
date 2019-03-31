export const sleep = (time: number) =>
    new Promise<void>(resolve => (Number.isFinite(time) ? setTimeout(resolve, time) : void 0))
export const timeout = <T>(promise: Promise<T>, time: number, rejectReason?: string) =>
    Number.isFinite(time)
        ? Promise.race([
              promise,
              new Promise<T>((r, reject) => setTimeout(() => reject(new Error(rejectReason || 'timeout')), time)),
          ])
        : promise
