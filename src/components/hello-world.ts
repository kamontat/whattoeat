import { css, html, LitElement } from "lit";
import { customElement, property } from "lit/decorators.js";

@customElement("hello-world")
export class HelloWorld extends LitElement {
	static override styles = css`
		:host {
			display: grid;
			place-items: center;
			min-height: 100vh;
		}
	`;

	@property()
	name = "World";

	override render() {
		return html`<h1>Hello, ${this.name}!</h1>`;
	}
}
