# Slot model

Slots are named zones. The core knows how to register, fill and render slots; it does not assign business meaning to a slot name.

The standard shell plugin registers these slots:

- `header.start`
- `header.end`
- `body.before`
- `main`
- `body.after`
- `footer.start`
- `footer.end`

The standard specialization maps the originally requested dialog areas like this:

| Area | Slot |
| --- | --- |
| top left headline | `header.start` |
| top right close button | `header.end` |
| content area | `main` |
| bottom left status info | `footer.start` |
| bottom right action buttons | `footer.end` |

Plugins may add more slots, for example:

- `sidebar.left`
- `toolbar.top`
- `wizard.steps`
- `body.before`
- `body.after`

Slot content can be text, DOM nodes, arrays, render functions or plugin contributions.
