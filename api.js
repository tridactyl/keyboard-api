/* {{{ api.js - Webextension Keyboard API
 *
 * A low level keyboard interface for bold webextensions. 
 *
 * Design:
 *    Receiving and redistributing keyevents:
 *
 *    addEventListener("keydown") to each window and tab frame as it's opened
 *            Only listens on the first window for now.
 *    Expose an InputEventManager as onKeydown
 *    Call listeners with each keyevent
 *            If the event target is in the chrome, the chrome window handler
 *            handles it, otherwise the framescripts do it (so that the
 *            real event.target can be found).
 *
 *    Suppressing events:
 *
 *    Extensions may provide reasonably complicated rules encoded in a
 *    restricted, keymap-like language that specify whether a given event
 *    should be suppressed or not.
 *
 *    Default policy is to not suppress events.
 *
 * [Want more?](readme.md)
 *
 * Read the webextensions experiments documentation to understand the structure of this project.
 *
 */
// }}}

// {{{ Imports

// Traditional Firefox shortcut names for common elements of Components.
var {classes: Cc, interfaces: Ci, utils: Cu} = Components

// An InputEventManager is an object that provides *Listener methods. In
// particular, addListener allows a caller to register a callback to an event.
// The callback stays in the caller, but IEM provides a `fire` object here
// whose methods can be called to asynchronously invoke the callback in the
// extension's process.
//
// There's no online documentation, so you need to read examples to see how to
// use it. I used ext-download.js and so on.
//
// A particularly weird bug is that if the IEM is returned directly in the API,
// rather than the result of its .api() call, then all other IEM seem to break.
Cu.import('resource://gre/modules/ExtensionCommon.jsm')
var InputEventManager = class extends ExtensionCommon.EventManager {
  constructor (...args) {
    super(...args)
    this.inputHandling = true
  }
}

// windowWatcher lets us get the window objects we need to addEventListeners to.
// TODO: lydell's experiment used a different approach. Remember to check it out.
var windowWatcher = Cc['@mozilla.org/embedcomp/window-watcher;1']
  .getService(Ci.nsIWindowWatcher)
// TODO: Get all windows.
var mainWindow = windowWatcher.getWindowEnumerator().getNext()

// Global Message Manager: mechanism for loading and communicating with framescripts
var globalMM = Cc['@mozilla.org/globalmessagemanager;1']
  .getService(Ci.nsIMessageListenerManager)
// }}}

// {{{ Debugging crap

var DEBUG = true

// My global scope is called "Sandbox" by firefox. Make it available in the browser console for debugging.
if (DEBUG) {
  Cu.import('resource://gre/modules/Console.jsm')
  var sandbox = this
  mainWindow.keyboard = sandbox
} else {
  console = {}
  console.log = () => {}
} // }}}

// {{{ Helper functions - not used yet

function pick (o, ...props) {
  return Object.assign({}, ...props.map(prop => ({[prop]: o[prop]})))
}

// Shallow copy of keyevent.
function shallowKe (ke) {
  let shallow = pick(
    ke,
    'key', 'code', 'location', 'locale',
    'shiftKey', 'metaKey', 'altKey', 'ctrlKey', 'repeat',
    'bubbles', 'composed', 'defaultPrevented', 'eventPhase',
    'timeStamp', 'type', 'isTrusted', 'isComposing'
  )
  shallow.target = pick(ke.target, 'tagName')
  shallow.target.ownerDocument = pick(ke.target.ownerDocument, 'URL')
  return shallow
}

// }}}

// {{{ Listeners

function frameKeydownListener (message) {
  dispatch(message.data.event)
}

// All real input events travel through the chrome, but we should only keep
// those whose final destination is a chrome object.
//
// No framescript is started for the chrome:// frame, so events targetting
// that need to be captured through another method. I just add an
// eventListener to each browser window object.
//
// As of FF 56, about:* pages get framescripts and are run in the chrome
// process. For consistency, and because I think they might move out of the
// chrome process, I'll let the framescripts send the events for those
// pages.
function chromeListener (keyevent) {
  let target = keyevent.target
  if (target.baseURI.startsWith('chrome://') && target.tagName !== 'tabbrowser') {
    // Suppress events, if requested
    if (preventDefault) {
      keyevent.preventDefault()
    }
    if (stopPropagation) {
      keyevent.stopPropagation()
    }
    // TODO: Eventually this will need to be replaced by a shallow copy. Left for now for debugging reasons.
    dispatch(keyevent)
  }
}

// Call each listener with a keyevent.
//   I can't be bothered to fix the schema with all the attributes I need, so for now just return a string, ke.key.
function dispatch (ke) {
  console.log('dispatch', ke)
  for (let listener of keydownListeners) {
    listener(ke.key)
  }
}

// Frame scripts can't write to the console on their own, so help them out.
function frameConsoleListener (message) {
  console.log('frame:', message.data)
}

// }}}

// {{{ API functions

// Called by the addListener method of an InputEventManager, fire is an
// encapsulation of the callback given to addListener.
function onKeydownRegistrar (fire) {
  console.log('keyboard.onKeydown: registering a listener.')

  // Firefox won't let you make a blocking call to an extension.
  // Tried and failed: runSafeSync, fire.sync
  keydownListeners.add(fire.async)

  // Interface is to return a callback for removing the listener just added.
  return () => { keydownListeners.delete(fire.async) }
}

// Set the global preventDefault and stopPropagation states.
//
// e.g. If message.preventDefault, then all future keyevents will have
// preventDefault() called, until this is called again with {preventDefault:
// false}
//
// This is not an implementation of the more complicated proposals :)
function suppress (message) {
  // Schema ensures that message.* can only be of type bool.
  if ('preventDefault' in message) {
    preventDefault = message.preventDefault
  }
  if ('stopPropagation' in message) {
    stopPropagation = message.stopPropagation
  }
  globalMM.broadcastAsyncMessage('keyboard@cmcaine.co.uk:to_frame_scripts', {command: 'suppress', preventDefault, stopPropagation})
}

// }}}

// {{{ Load and unload this API

function load () {
  mainWindow.addEventListener('keydown', chromeListener, true)
  globalMM.addMessageListener('keyboard@cmcaine.co.uk:keydown', frameKeydownListener)
  globalMM.addMessageListener('keyboard@cmcaine.co.uk:console', frameConsoleListener)
  globalMM.loadFrameScript(framescriptURL, true)
}

function unload () {
  console.log('Unload keyboard API')
  mainWindow.removeEventListener('keydown', chromeListener, true)
  globalMM.broadcastAsyncMessage('keyboard@cmcaine.co.uk:to_frame_scripts', {command: 'unload'})
  globalMM.removeMessageListener('keyboard@cmcaine.co.uk:console', frameConsoleListener)
  globalMM.removeMessageListener('keyboard@cmcaine.co.uk:keydown', frameKeydownListener)
  globalMM.removeDelayedFrameScript(framescriptURL)
}

// }}}

// {{{ class API

class API extends ExtensionAPI {
  getAPI (context) {
    load()
    DEBUG ? sandbox.context = context : null
    let IEM = new InputEventManager(
      context,
      'keyboard.onKeydown',
      onKeydownRegistrar
    ).api()
    return {
      keyboard: {
        onKeydown: IEM,
        /* TODO: Suppression rule API here */
        suppress: suppress
      }
    }
  }
  // unload event listeners. destroy() is another candidate. I don't know which one I should be using.
  onShutdown () {
    unload()
  }
}

// }}}

// {{{ API state

// Save framescript URL so we can disable it.
// Date.now() is to get around a caching issue with frame scripts:
// https://developer.mozilla.org/en-US/Firefox/Multiprocess_Firefox/Message_Manager/Frame_script_loading_and_lifetime#Note_about_unload_during_uninstallationupgrade
let framescriptURL = 'resource://extension-keyboard-api/frame.js?' + Date.now()

// Used by chromeListener
let preventDefault = false
let stopPropagation = false

// Set of all registered listeners
var keydownListeners = new Set()

// }}}
