/**
 * Example webextension that demos keyboard API use.
 */

function toggleSuppression() {
    suppress = !suppress
    browser.experiments.keyboard.suppress({stopPropagation: suppress, preventDefault: suppress})
}

function handleBrowserAction(_) {
    toggleSuppression()
}

function keydownListener(ev) {
    if (ev == "Insert") {
        toggleSuppression()
    }
}

let suppress = true
toggleSuppression()
browser.browserAction.onClicked.addListener(handleBrowserAction)
browser.experiments.keyboard.onKeydown.addListener(keydownListener)
console.log("Dummy inserted.")
