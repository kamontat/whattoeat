import { afterEach, expect, test } from "bun:test";
import { LitElement } from "lit";
import { MediaController, WIDE, WIDER } from "#lib/media";

type HappyWindow = Window & {
	happyDOM: { setViewport(viewport: { width: number; height: number }): void };
};
const setWidth = (width: number) => {
	(window as unknown as HappyWindow).happyDOM.setViewport({
		width,
		height: 900,
	});
	window.dispatchEvent(new Event("resize"));
};

class Probe extends LitElement {
	readonly media = new MediaController(this, WIDE);
	renders = 0;
	override render() {
		this.renders++;
		return null;
	}
}
customElements.define("media-probe", Probe);

afterEach(() => {
	document.body.innerHTML = "";
	setWidth(1024);
});

const mount = async () => {
	const el = document.createElement("media-probe") as Probe;
	document.body.append(el);
	await el.updateComplete;
	return el;
};

test("wide is 48rem and up", () => {
	expect(WIDE).toBe("(min-width: 48rem)");
});

test("WIDER is the 64rem query", () => {
	expect(WIDER).toBe("(min-width: 64rem)");
});

test("reports whether the query matches", async () => {
	setWidth(1024);
	expect((await mount()).media.matches).toBe(true);
	document.body.innerHTML = "";
	setWidth(390);
	expect((await mount()).media.matches).toBe(false);
});

test("re-renders the host when the width crosses the query", async () => {
	setWidth(1024);
	const el = await mount();
	const before = el.renders;
	setWidth(390);
	await el.updateComplete;
	expect(el.media.matches).toBe(false);
	expect(el.renders).toBe(before + 1);
});

test("a resize that keeps the same answer does not re-render", async () => {
	setWidth(1024);
	const el = await mount();
	const before = el.renders;
	setWidth(1200);
	await el.updateComplete;
	expect(el.renders).toBe(before);
});

test("stops listening when the host disconnects", async () => {
	setWidth(1024);
	const el = await mount();
	el.remove();
	const before = el.renders;
	setWidth(390);
	await el.updateComplete;
	expect(el.renders).toBe(before);
});
