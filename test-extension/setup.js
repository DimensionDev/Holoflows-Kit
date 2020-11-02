Object.assign(globalThis, HoloflowsKit)
globalThis.sleep = (ms) => new Promise((r) => setTimeout(r, ms))
