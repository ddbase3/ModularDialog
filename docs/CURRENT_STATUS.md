# Current status

ModularDialog 0.1.0 is implemented as an ES module package with no runtime dependencies.

Implemented:

- Slot-first `ModularDialog` core.
- Event bus with cancelable lifecycle events.
- Command registry.
- State store.
- Plugin manager.
- Slot registry.
- Stack manager with modal z-index order and body scroll lock.
- Standard dialog shell as plugin, not as core assumption.
- Title, close button, status and action buttons as plugins.
- Behavior plugins for backdrop click, Escape key and focus trap.
- Optional dirty guard, async action, draggable and resizable plugins.
- CSS theme based on custom properties.
- Basic, async and custom-slot demos.
- Node smoke test and browser smoke test.

The package intentionally has no dependency on MissionBay, ModularGrid or a specific PHP template.
