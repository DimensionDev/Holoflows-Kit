Object.assign(globalThis, HoloflowsKit)
globalThis.sleep = (ms) => new Promise((r) => setTimeout(r, ms))
const output = document.body.appendChild(document.createElement('textarea'))
output.readOnly = true
output.style.display = 'display'
const input = document.body.appendChild(document.createElement('input'))
input.style.display = 'display'
const msg = new WebExtensionMessage()

msg.events.hello.on((msg) => {
    output.value = msg + '\n' + output.value
    console.log(msg)
})
function send(value, target = MessageTarget.All) {
    msg.events.hello.send(target, value)
}
input.addEventListener('keydown', (e) => {
    if (e.key === 'Enter') {
        e.preventDefault()
        send(
            input.value,
            [...select.selectedOptions].reduce((p, x) => p | x.value, 0),
        )
        input.value = ''
    }
})
const select = document.body.appendChild(document.createElement('select'))
select.multiple = true
select.style.display = 'block'
select.style.height = '28em'
for (const key in Environment) {
    if (!Number.isNaN(parseFloat(key))) continue
    const value = select.appendChild(document.createElement('option'))
    value.innerText = key
    value.value = Environment[key]
}
for (const key in MessageTarget) {
    if (!Number.isNaN(parseFloat(key))) continue
    const value = select.appendChild(document.createElement('option'))
    value.innerText = key
    value.value = MessageTarget[key]
}
