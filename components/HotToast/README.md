# HotToast

1. Import the solution ZIP.
2. Add the HotToast component to the screen.
3. Set only `message` and bind `triggerKey` to a value that always changes.

Button (OnSelect):

```powerfx
Set(varToastKey, GUID())
Set(varToastMsg, "Test toast")
```

HotToast properties:

- `triggerKey` = `varToastKey`
- `message` = `varToastMsg`

Other options (what they change):

- `variant`: toast type (`info` | `success` | `warning` | `error` | `danger`)
- `durationMs`: display time (ms)
- `position`: placement (`top-right` | `top-left` | `bottom-right` | `bottom-left`)
- `maxToasts`: max number of stacked toasts
- `size`: size (`sm` | `md` | `lg`)
- `bgColor`: background color
- `textColor`: text color
- `accentColor`: accent + progress bar color
- `radiusPx`: corner radius
- `minWidthPx` / `maxWidthPx`: width
- `iconPosition`: icon side (`left` | `right`)
- `iconSet`: icon preset (`emoji` | `minimal` | `bold`)
