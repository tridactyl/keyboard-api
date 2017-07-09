# Keyboard API

## Quickstart

Clone this repo, load it as a temporary addon from about:debugging in Firefox nightly, load the example addon in test-webextension subdirectory too.

All keydown events in your first browser window will now be logged to the browser console and the test-webextension will toggle suppression of all keydown events if you press it's browseraction or press `Insert`.

For debugging, the API's `this` is made available as `this.keyboard` in the browser console of your first window.

All the files in the repo is suitable for initial review.

## Questions for reviewers

Hi, and thanks for reviewing! Here are some particular questions I would like answered, please also give comments on other topics :)

 - What is best practice for sharing code between api.js and the frame script?
 - Events are sent to at least the web console of a frame/window before or at the same time as they get processed by my frame script. How do I stop that? (If I call preventDefault() and stopPropagation() in my frame script, the event is still logged by the web console)
 - Are my conditions in chromeListener (:122) sensible?
 - Why does TAB not emit a keydown event?
 - I'm using a frame script to listen for the events, that will mean duplicating the state of the suppression state machines, unless I make a synchronous call to the chrome process and let that keep the state. Which is preferred?
 - Why does using sendSyncMessage in frame.js:log() cause more frame scripts to appear when I broadcast the "suppress" message? 

Pre-empting some questions:

 - What to review? api.js, frame.js are the main ones, but all files in the repo is suitable for initial review.
 - Why do you use `var` in api.js? Debugging: I can't work out how to start a REPL in the context of the API, so I just attach the APIs scope to the main window and use the browser console.
 - Why no tests? I don't understand how Mozilla's testing framework works yet and TDD doesn't fit very well when most of my issues are with understanding how the existing APIs and systems work.

## Motivation

Firefox wants to continue to support addons that essentially replace the Firefox UX, such as Vimperator, VimFx and Pentadactyl. If they are to be reimplemented these addons require new webextension APIs to be developed. This is one of them.

This API allows callers to listen to keydown events that occur anywhere in the browser, including in the two places that content scripts cannot be injected: the browser chrome and on restricted frames (about:\*, addons.mozilla.org). If you don't need that, you'll probably be better served by injecting content scripts or using `browser.commands`.

Because synchronous interprocess messaging is mostly banned, keydown events cannot be suppressed (stopPropagation(), preventDefault()) in the way that most developers are used to: by the time the API sends you the keydown event, it is too late to cancel it.

Suppression of events is an important feature, so this API offers two methods for suppressing events:

 1. You can suppress or unsuppress all future events with `.suppress()`
 2. You can declare rules in advance that the API will use to determine whether to suppress each event (this is not implemented yet)

Warning: It is quite possible for two extensions using this API to conflict or interfere with one another. This is considered acceptable: users should not install more than one extension at a time that use this API.

## Design

This is subject to change.

Original design was by lydell of vimFx. This turned out to be unworkable because the return value of event listeners cannot be synchronously recovered (Firefox prefers interprocess communication to be asynchronous, and is particularly concerned about the chrome process (where the API lives) making any blocking calls to other processes).

New design is this:

 - `.onKeydown` is an InputEventManager. Listeners receive an object that contains the important properties of each keyevent (real keyevents can't be copied between processes).
 - `.suppress()` suppresses or unsuppresses all future events.
    - `.suppress({stopPropagation: true, preventDefault: false})`
 - (Not implemented) Some more sophisticated method of expressing what should be suppressed, see [#suppression-rules].
    - Could use the same syntax to express which keyevents you want to be sent at all

KeyboardEvents are seen, processed and optionally suppressed by this API before Firefox shortcuts, browser.onCommand shortcuts or event listeners defined on DOMWindow objects handle the event.

### Suppression rules

I haven't decided how to do this yet, I'm considering a kind of pushdown automata defined by syntax similar to the below.

I'm using a frame script to listen for the events, that will probably mean duplicating the state of the suppression machines, unless I make a synchronous call to the chrome process and let that keep the state, which might be better?

Desired behaviour:

 - In vim-likes: change mode based on key or target (insert mode)
    - In most modes, suppress all keys, in ignore or insert, react to only a whitelist of keys.
 - In emacs-likes: change mode based on key, mostly, but there are more modes
    - In most modes, react to only a whitelist of keys, in some modes (like when accepting an argument) suppress most keys.
 - Properties of keyevent that people might want to test on:
    - target
    - repeat
    - Shift, Meta, Alt, Ctrl, key, code? (provide the deprecated keyCode as well?)

An FSM with transitions on keyevent and attached white/black lists might be good? `i` in VimFx or `<s-esc>` in Vimperator could move the FSM into a mostly don't suppress state, and then `<s-esc>` could move back to normal.

As well as white/black list, will need rules based on target and maybe transitions based on time?

Maybe iptables-like rules, with transitions?

Remember to version the DSL.

Emacs style:

```js
global_key_map = {
  'Ctrl-X': suppress,
  'Ctrl-U': [suppress, undo_key_map],
  '*': incite
};
undo_key_map = {
  'Enter': suppress,
  'Ctrl-G': [suppress, global_key_map],
  '*': suppress
};
```

Vim style:

```js
normal = {
  target is input: insert_map,
  '<s-esc>': suppress, ignore_map,
  '*': suppress
};
insert_map = {
  'esc': normal_map,
  '*': incite
};
// ...
```

## Concepts

 - keyevent:
    - For now, we'll only deal with keydown, though a suppressed keydown will also suppress the corresponding keypress.
 - Event suppression:
    - An event is considered suppressed if it is provided to each of the listeners of the keyboard API, but has all further propagation to Firefox or to tabs halted.
      - suppression now split into preventDefault and stopPropagation.
    - For example, a suppressed PageDown key would not invoke Firefox's scroll down function.


## Difficulties:

Current:

 - keydown.key isn't correct for accented keys produced by compose key (e.g. shift+altgr, ', e => é), possibly other unicode-type inputs.
    - Maybe look into composition events if this turns out to be important?

Not yet addressed:

 - Don't know how to suppress \<c-tab\> (and what other firefox binds are handled differently but I didn't notice?)
 - Testing that this will override browser.commands
 - Should I try to suppress matching keyup events if the keydown event is suppressed?
    - Probably not.

Tangential:

 - How would I return a Port object to a caller? I can't see how to instantiate one.
     - Why does ext-c-runtime.js have a context.extension.messenger attribute, but I don't?

Resolved:

 - If I provide a SingletonEventManager for onKeydown, my test extension fails with "desc is undefined" when calling addListener for onKeydown or for browserAction.onClicked (and probably others). I have no idea why this is so.
    - Thanks to rpl. This was because I didn't call `.api()` on the event manager. Why that affects other extensions, I don't know.
 - KeyboardEvent objects can't be cloned. Can I do better than passing a custom object that just contains the attributes I'm interested in?
    - Thanks to kmag. No.
 - Testing what scope/context listeners added to onKeydown.addListener run in
    - They don't move scope.

## Acknowledgements

The denizens of #webextensions, especially zombie, kmag, aswan, The_8472, and rpl.
