export const sleep = (time: number) => new Promise(resolve => setTimeout(resolve, time))
export const timeout = <T>(promise: Promise<T>, time: number) =>
    new Promise((resolve, reject) => {
        Promise.race<T>([
            promise,
            sleep(time).then<any>(() => {
                throw new Error('Timeout')
            }),
        ]).then(resolve, reject)
    })
