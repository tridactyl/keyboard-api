# Errors

Without child script:

```

[Exception... "Could not convert JavaScript argument"  nsresult: "0x80570009 (NS_ERROR_XPC_BAD_CONVERT_JS)"  location: "JS frame :: file:///home/olie/projects/keyboard-api/src/experiments/keyboard/api.js :: <TOP_LEVEL> :: line 64"  data: no] 2 api.js:64:4

1559164948236   addons.xpi  WARN    Exception running bootstrap method startup on dummy@cmcaine.co.uk: [Exception... "Could not convert JavaScript argument"  nsresult: "0x80570009 (NS_ERROR_XPC_BAD_CONVERT_JS)"  location: "JS frame :: file:///home/olie/projects/keyboard-api/src/experiments/keyboard/api.js :: <TOP_LEVEL> :: line 64"  data: no] Stack trace: api.js:64

asyncLoadModule/module.asyncLoaded<()@resource://gre/modules/ExtensionCommon.jsm:1540

Error: An unexpected error occurred main.js:7:34

NS_ERROR_XPC_BAD_CONVERT_JS: Could not convert JavaScript argument api.js:64

Key event not available on some keyboard layouts: key=“r” modifiers=“accel,alt” id=“key_toggleReaderMode” browser.xul

Key event not available on some keyboard layouts: key=“i” modifiers=“accel,alt,shift” id=“key_browserToolbox” browser.xul

update.locale file doesn't exist in either the application or GRE directories UpdateUtils.jsm:138

```

With child script (denizens of #web-extensions say they probably aren't supported):

```
... invalid input stream... can't find frame.js // get a different error if frame.js is actually not present
```


# The plan

- Kill the frame script
- Move everything into `api.js`
