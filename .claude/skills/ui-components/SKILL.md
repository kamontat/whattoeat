---
name: ui-components
description: Use when writing or editing a Lit component in src/components/, using a custom element from a page, styling with src/styles/ or the CSS reset, writing a component test, or debugging a component that renders nothing, loses events, or looks unstyled.
---

# Components

## Shape of a component

Every component is a `LitElement` in `src/components/<tag-name>.ts`, with its own shadow
root carrying its own styles:

```ts
import { css, html, LitElement } from "lit";
import { customElement, property } from "lit/decorators.js";

@customElement("my-greeting")
export class MyGreeting extends LitElement {
	static override styles = css`
		:host {
			display: block;
		}
	`;

	@property()
	name = "World";

	override render() {
		return html`<p>Hello, ${this.name}!</p>`;
	}
}
```

- Reactive properties are **plain class fields** with `@property()` / `@state()`, not the
  `accessor` keyword the Lit docs lead with. `accessor` does not survive Bun's transpiler
  while `tsconfig.json` sets `experimentalDecorators: true` (FIXME, oven-sh/bun#43097).
- `noImplicitOverride` is on, so `static styles`, `render` and every overridden lifecycle
  method (`connectedCallback`, `willUpdate`, `updated`) need `override` — and so does a
  property whose name collides with a DOM member (`title`, `hidden`, `prefix`).
- Register the tag in `src/types/global.d.ts` (`HTMLElementTagNameMap`) so
  `document.createElement("my-greeting")` and `querySelector` return the class type.
- A page loads the module with `<script type="module" src="../components/my-greeting.ts">`;
  other TypeScript imports it as `#components/my-greeting`.
- `src/components/` may import from `src/lib/` and `src/styles/`, never from
  `src/routes/`. Keeping the arrow one way is what lets a component be read alone.

## Styles and the shadow boundary

A page-level rule does not cross a shadow root, so `src/styles/global.css` (the reset and
anything global) styles the light DOM only. Styles a component needs live in its own
`static styles`. Shared chunks go in `src/styles/<name>.ts` as exported `css` values,
imported via `#styles/<name>` and composed into each component's `styles` array; Lit
shares one `CSSStyleSheet` per `css` value, so ten importers cost one sheet.

What *does* cross the boundary is inheritance — custom properties, `color`, `font`. So
theme values belong in custom properties defined once on `:root` in global CSS and read in
components with `var(--…)`. A component that hardcodes a colour also hardcodes a theme.

`@kcstyles/reset.css` makes every bare `div` `display: flex; flex-direction: column`
(opt out with `<div row>` for a row or `<div block>` for block). A `div` that wants a row
must say so even after `display: flex`, or it silently stacks — that is not a redundancy
for a reviewer to delete. The reset applies only where it is loaded: the light DOM via
`global.css`, not inside shadow roots.

A CSS comment inside a `css` tagged template must not contain a backtick: it closes the
template literal, and the failure surfaces as a bundler parse error rather than from the
typechecker or Biome.

## Attributes, properties, events

Attributes carry markup-authored configuration (strings, booleans); properties carry
structured data a script hands over (`.items=${list}`). An attribute name maps to a
lower-cased property by default — set `attribute: "foo-bar"` for anything multi-word.

A component reports changes by dispatching its own event from the host. Native `input`
and `click` are `composed: true` and escape the shadow root on their own; native `change`
is not composed and dies at the boundary. A component wrapping a native control should
stop the native event and dispatch its own (`new CustomEvent("value-change", { detail,
bubbles: true, composed: true })`), or the page hears a stale echo of the inner control.

## Testing

Tests live in `tests/`, mirroring `src/`. `bunfig.toml` preloads `tests/setup-happydom.ts`,
which registers happy-dom's `window` and `document` and treats external script loads as
successful, so no test fetches the network.

- Create the element, append it to `document.body`, then `await el.updateComplete` before
  every assertion — Lit renders in a microtask, not synchronously. Reach inside through
  `el.shadowRoot`.
- Clear `document.body.innerHTML` in `afterEach`.
- One `bun test` process shares one `customElements` registry across every test file.
  `@customElement` throws if a tag is defined twice, which only happens if two modules
  define the same tag — keep one definition per tag.
- happy-dom does not resolve inherited custom properties or compute layout, so no test
  proves a component is styled. The browser is the only check for colour, spacing and
  layout; list those as preview checks in the PR.
- happy-dom does not replay an attribute already present when an element upgrades. Markup
  set with `innerHTML` *before* the component module is imported loses its attributes;
  import the component first, or set properties directly in the test.
