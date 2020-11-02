Object.assign(globalThis, HoloflowsKit)
try {
    chrome.devtools.panels.create('Holoflows kit test', '', 'index.html', function (panel) {})
} catch {}
document.write(printExtensionEnvironment() + (chrome.devtools ? '|devtoolsAPI' : ''))
