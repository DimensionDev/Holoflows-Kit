Object.assign(globalThis, HoloflowsKit)
WebExtensionMessage.acceptExternalConnect((x) => {
    console.log(x)
    return { acceptAs: Environment.ExtensionProtocol | Environment.HasBrowserAPI }
})
