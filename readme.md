Difficulties:

 - If I provide a SingletonEventManager for onKeydown, my test extension fails with "desc is undefined" when calling addListener for onKeydown or for browserAction.onClicked (and probably others). I have no idea why this is so.

    ```
    // On 54.0a2 (2017-04-04)
    desc is undefined

    copy resource://gre/modules/ExtensionCommon.jsm:659:13
    copy resource://gre/modules/ExtensionCommon.jsm:663:11
    copy resource://gre/modules/ExtensionCommon.jsm:663:11
    copy resource://gre/modules/ExtensionCommon.jsm:663:11
    copy resource://gre/modules/ExtensionCommon.jsm:663:11
    copy resource://gre/modules/ExtensionCommon.jsm:663:11
    generateAPIs resource://gre/modules/ExtensionCommon.jsm:673:9
    injectInObject resource://gre/modules/ExtensionParent.jsm:279:5
    <anonymous> resource://gre/modules/ExtensionParent.jsm:338:3
    get resource://gre/modules/ExtensionUtils.jsm:959:29
    addListener resource://gre/modules/ExtensionParent.jsm:643:5
    receiveMessage resource://gre/modules/ExtensionParent.jsm:510:11
    ```

 - KeyboardEvent objects can't be cloned. Can I do better than passing a custom object that just contains the attributes I'm interested in?

Not yet addressed:

 - Testing what scope/context listeners added to onKeydown.addListener run in
 - Testing that this will override browser.commands
 - Should I try to suppress matching keyup events if the keydown event is suppressed?
    - Probably not.

Tangentially:

 - How would I return a Port object to a caller? I can't see how to instantiate one.
     - Why does ext-c-runtime.js have a context.extension.messenger attribute, but I don't?
