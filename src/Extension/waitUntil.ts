export async function waitUntil(promise: Promise<any>) {
    const keepAlive = setInterval(browser.runtime.getPlatformInfo, 25 * 1000)
    try {
        await promise
    } finally {
        clearInterval(keepAlive)
    }
}
