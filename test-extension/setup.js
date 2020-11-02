Object.assign(globalThis, HoloflowsKit)
try {
    chrome.devtools.panels.create('Holoflows kit test', '', 'index.html', function (panel) {})
} catch {}
if (chrome.devtools) document.write(printExtensionEnvironment() + (chrome.devtools ? '|devtoolsAPI' : ''))
try {
    browser.tabs.onUpdated.addListener((tab) => {
        browser.pageAction.show(tab)
    })
} catch {}
