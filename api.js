var {classes: Cc, interfaces: Ci, results: Cr, utils: Cu} = Components;

Cu.import("resource://gre/modules/ExtensionUtils.jsm");
var {
  runSafeSync,
  SingletonEventManager
} = ExtensionUtils;

// Design:
//      addEventListener("keydown") to each window as it's opened
//              Only listens on the first window for now.
//      Expose a SingletonEventManager as onKeydown
//              This is buggy, see readme.md
//      Call listeners synchronously with each keyevent, if any listener returns truthy, suppress the event.
//              If keyevent can't be sent, send a simpler copy of the keyevent.
//
// Observations:
//      Unclear on how SEM works: I can't receive a function as a parameter normally - so how does SEM do it?
//      In what contexts are the various SEM calls made?

// windowWatcher lets us get the window objects we need to addEventListeners to.
//
// lydell's experiment used a different approach. Remember to check it out.
this.windowWatcher = Cc['@mozilla.org/embedcomp/window-watcher;1'].
                       getService(Ci.nsIWindowWatcher);

this.keydownListeners = new Set();

// Passed to window.addEventListener, calls each keydownListener.
this.dispatcher = (ke) => {
  console.log("Listeners: ", this.keydownListeners);
  for (let listener of this.keydownListeners) {
    requests_suppression = listener(ke2);
    console.log("Wants suppression? ", requests_suppression);
    // TODO: Don't preventDefault on search/urlbar, etc. - or maybe leave that up to callers.
    // TODO: Does it matter if I call this more than once?
    if (requests_suppression) {
      ke.preventDefault();
    }
  }
}

this.debug_listener = (ke) => {
  console.log("debug_listener: ", ke);
  return false 
}

// TODO: Get all windows.
mainWindow = windowWatcher.getWindowEnumerator().getNext();
// TODO: Clean up event listeners when keyboard API code gets reloaded.
mainWindow.addEventListener("keydown", dispatcher);

// DEBUG
// I don't have a console normally. This gives me some way to output.
// Probably more idiomatic to import Console.jsm
this.console = mainWindow.console;

// My global scope is called "Sandbox" by firefox. Make it available in the browser console for debugging.
let sandbox = this;
mainWindow.keyboard = sandbox;

class API extends ExtensionAPI {
  getAPI(context) {
    // DEBUG
    sandbox.context = context;

    // Testing this here because of the "desc is undefined" bug.
    let SEM = sandbox.SEM = new SingletonEventManager(context, "keyboard.debug_onKeydown", (fire) => {
      console.log("keyboard.onKeydown: registering a listener.");
      let listener = (keyevent) => {
        // Apparently fire.sync isn't a real function (but I've seen it used in the source).
        // return fire.sync(keyevent)
        return runSafeSync(context, fire, keyevent);
      }
      keydownListeners.add(listener);
      return () => { keydownListeners.delete(listener) };
    });
    SEM.addListener(debug_listener);

    // This is buggy.
    return {
      keyboard: {
        listen(cb) {
          // This doesn't work because I can't pass a function as an argument: not cloneable.
          cb("Hello world");
          cb("Goodbye!");
          callbacks.push(cb);
        },

        // Assigning a SEM to this API attribute causes other .addListeners to
        // break for extensions that use this API (tested with
        // browserAction.onClicked). Firefox says "desc is undefined".
        onKeydown: SEM
      },
    };
  }
}
