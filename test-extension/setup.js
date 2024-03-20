Object.assign(globalThis, HoloflowsKit)
globalThis.sleep = (ms) => new Promise((r) => setTimeout(r, ms))
const message = new WebExtensionMessage()
message.enableLog = true

Object.assign(globalThis, { msg: message })

if (globalThis.document) {
    document.body.innerHTML = Math.random()
}
