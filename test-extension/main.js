// browser.browserAction.onClicked.addListener(() => {
//   console.log("Browser Action.");
//   browser.keyboard.onKeydown.addListener((ev) => { console.log("webext"); console.log(ev)
//   })
// });

function handleBrowserAction() {
  console.log("BA")
}

// This breaks if browser.keyboard is loaded...
browser.browserAction.onClicked.addListener(handleBrowserAction);

console.log("Dummy inserted.");
