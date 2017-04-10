/* api.js - Webextension Keyboard API
 *
 * A low level keyboard interface for bold webextensions. [More](readme.md)
 *
 * Read the webextensions experiments documentation to understand the structure of this project.
 *
 */

// Design:
//      Receiving and redistributing keyevents:
//
//      addEventListener("keydown") to each window and tab frame as it's opened
//              Only listens on the first window for now.
//      Expose a SingletonEventManager as onKeydown
//              This is buggy, see readme.md
//      Call listeners synchronously with each keyevent
//              If the event target is in the chrome, the chrome window handler
//              handles it, otherwise the frame handlers do it (so that the
//              real event.target can be preserved).
//
//      Suppressing events:
//
//      Extensions may provide reasonably complicated rules encoded in a
//      restricted, keymap-like language that specify whether a given event
//      should be suppressed or not.
//
//      Default policy is to not suppress events.

/* Imports and setup */

// Traditional Firefox shortcut names for common elements of Components.
var {classes: Cc, interfaces: Ci, results: Cr, utils: Cu} = Components;

// A SingletonEventManager is an object that provides *Listener methods. In
// particular, addListener allows a caller to register a callback to an event.
// The callback stays in the caller, but SEM provides a `fire` object here
// whose methods can be called to asynchronously invoke the callback in the
// extension's process.
//
// There's no online documentation, so you need to read examples to see how to
// use it. I used ext-download.js and so on.
//
// A particularly weird bug is that if the SEM is returned directly in the API,
// rather than the result of its .api() call, then all other SEM seem to break.
Cu.import("resource://gre/modules/ExtensionUtils.jsm");
var {
  SingletonEventManager
} = ExtensionUtils;

// windowWatcher lets us get the window objects we need to addEventListeners to.
// TODO: lydell's experiment used a different approach. Remember to check it out.
var windowWatcher = Cc['@mozilla.org/embedcomp/window-watcher;1'].
                       getService(Ci.nsIWindowWatcher);

// set of all registered listeners.
var keydownListeners = new Set();

/* Helper functions */

// Passed to window.addEventListener, calls each keydownListener.
var dispatcher = (ke) => {
  for (let listener of this.keydownListeners) {
    // There's no easy way to make listener return anything but a Promise, so this doesn't work.
    requests_suppression = listener(ke.key);
    if (requests_suppression) {
      ke.preventDefault();
    }
  }
}

var debug_listener = (ke) => {
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
var console = mainWindow.console;

// My global scope is called "Sandbox" by firefox. Make it available in the browser console for debugging.
// let sandbox = this;
// mainWindow.keyboard = sandbox;

/* Main API definition */

class API extends ExtensionAPI {
  getAPI(context) {
    // DEBUG
    // sandbox.context = context;

    // // Testing this here because of the "desc is undefined" bug.
    // let SEM = sandbox.SEM = new SingletonEventManager(context, "keyboard.debug_onKeydown", (fire) => {
    //   console.log("keyboard.onKeydown: registering a listener.");
    //   let listener = (keyevent) => {
    //     // Apparently fire.sync isn't a real function (but I've seen it used in the source).
    //     // return fire.sync(keyevent)
    //     return runSafeSync(context, fire, keyevent);
    //   }
    //   keydownListeners.add(listener);
    //   return () => { keydownListeners.delete(listener) };
    // });

    // This is buggy.
        let SEM = new SingletonEventManager(context, "keyboard.debug_onKeydown", (fire) => {
          // console.log("keyboard.onKeydown: registering a listener.");
          let listener = (keyevent) => {
            // Still returns a promise if called on a function provided by a webextension - How's that synchronous?
            return fire.sync(keyevent)
            // runSafeSync doesn't work if .api() is called *sometime in the future*!?
            // return runSafeSync(context, fire, keyevent);
            // Doesn't do what I want.
            // return fire.async(keyevent)
          }
          keydownListeners.add(listener);
          return () => { keydownListeners.delete(listener) };
        });
    SEM.addListener(debug_listener);
    // let dummyevent = {};
    // dummyevent.key = 'a';
    // dispatcher(dummyevent);
    return {
      keyboard: {
        listen(cb) {
          // This doesn't work because I can't pass a function as an argument: not cloneable.
          cb("Hello world");
          cb("Goodbye!");
          callbacks.push(cb);
        },

        onKeydown: SEM.api()
      },
    };
  }
}
