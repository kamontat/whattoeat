import { css, html, LitElement, nothing } from "lit";
import { customElement, property, state } from "lit/decorators.js";
import { live } from "lit/directives/live.js";
import { LangController, t } from "#lib/i18n";
import { normalizeTag, parseTags } from "#lib/restaurant";
import { uiStyles } from "#styles/ui";

const MAX_SUGGESTIONS = 8;

/**
 * Tag chips plus a text box that suggests known tags. Fires `change` with the new tag list
 * whenever the user adds or removes a tag.
 */
@customElement("tag-input")
export class TagInput extends LitElement {
	static override styles = [
		uiStyles,
		css`
			/* A grid cell may stretch the host; keep label, box and hint together at the top. */
			:host {
				position: relative;
				display: grid;
				align-content: start;
				gap: 0.25rem;
			}

			.field {
				display: flex;
				flex-wrap: wrap;
				align-items: center;
				gap: 0.25rem;
				padding: 0.25rem;
				border: 1px solid var(--color-control);
				border-radius: var(--radius);
				background: var(--color-surface);
			}

			.field:focus-within {
				outline: 2px solid var(--color-primary);
				outline-offset: 1px;
			}

			.field input {
				flex: 1 1 8rem;
				width: auto;
				min-width: 0;
				padding: 0.25rem 0.5rem;
				border: 0;
			}

			.field input:focus {
				outline: none;
			}

			.chip {
				display: inline-flex;
				align-items: center;
				gap: 0.25rem;
			}

			button.remove {
				padding: 0 0.25rem;
				border: 0;
				background: none;
				line-height: 1;
			}

			[role="listbox"] {
				position: absolute;
				z-index: 1;
				top: 100%;
				right: 0;
				left: 0;
				margin: 0.25rem 0 0;
				padding: 0.25rem;
				list-style: none;
				border: 1px solid var(--color-border);
				border-radius: var(--radius);
				background: var(--color-surface);
				box-shadow: 0 4px 12px rgb(0 0 0 / 0.12);
			}

			[role="option"] {
				padding: 0.375rem 0.75rem;
				border-radius: var(--radius);
				cursor: pointer;
				font-weight: 400;
			}

			[role="option"]:hover,
			[role="option"][aria-selected="true"] {
				background: var(--color-bg);
			}
		`,
	];

	protected readonly langController = new LangController(this);

	@property({ attribute: false })
	value: string[] = [];

	@property({ attribute: false })
	suggestions: string[] = [];

	@property()
	label = "";

	@property()
	hint = "";

	@state()
	private text = "";

	@state()
	private open = false;

	/** Index of the highlighted suggestion, or -1 for none. */
	@state()
	private active = -1;

	/** Add text still in the box; call before reading the tags on submit. Returns the tag list. */
	commit(): string[] {
		if (this.text !== "") this.add(this.text);
		return this.value;
	}

	clearText(): void {
		this.text = "";
		this.close();
	}

	private visibleSuggestions(): string[] {
		const needle = normalizeTag(this.text);
		if (needle === "") return [];
		return this.suggestions
			.filter((tag) => tag.includes(needle) && !this.value.includes(tag))
			.slice(0, MAX_SUGGESTIONS);
	}

	private close(): void {
		this.open = false;
		this.active = -1;
	}

	private setValue(next: string[]): void {
		this.value = next;
		this.dispatchEvent(new CustomEvent<string[]>("change", { detail: next }));
	}

	private add(text: string): void {
		this.text = "";
		this.close();
		const added = parseTags(text).filter((tag) => !this.value.includes(tag));
		if (added.length > 0) this.setValue([...this.value, ...added]);
	}

	private removeTag(tag: string): void {
		this.setValue(this.value.filter((item) => item !== tag));
		// The focused × button is gone after render; keep keyboard users in the field.
		void this.updateComplete.then(() =>
			this.renderRoot.querySelector<HTMLInputElement>("input")?.focus(),
		);
	}

	private readonly onInput = (event: Event): void => {
		const text = (event.target as HTMLInputElement).value;
		if ((event as InputEvent).inputType === "insertFromPaste") {
			this.add(text);
			return;
		}
		const cut = text.lastIndexOf(",");
		if (cut >= 0) this.add(text.slice(0, cut));
		this.text = cut >= 0 ? text.slice(cut + 1) : text;
		this.open = true;
		this.active = -1;
	};

	private readonly onKeyDown = (event: KeyboardEvent): void => {
		// Enter also confirms a character in Thai and other input methods; leave that alone.
		// Safari sends that Enter after composition ends, marked only by keyCode 229.
		if (event.isComposing || event.keyCode === 229) return;
		const matches = this.visibleSuggestions();
		switch (event.key) {
			case "Enter": {
				const choice = this.open ? matches[this.active] : undefined;
				if (choice === undefined && this.text.trim() === "") return;
				event.preventDefault();
				this.add(choice ?? this.text);
				return;
			}
			case "ArrowDown":
			case "ArrowUp": {
				if (matches.length === 0) return;
				event.preventDefault();
				const step = event.key === "ArrowDown" ? 1 : -1;
				const from = this.open ? this.active : -1;
				this.open = true;
				this.active =
					from === -1 && step === -1
						? matches.length - 1
						: (from + step + matches.length) % matches.length;
				return;
			}
			case "Escape":
				if (!this.open || matches.length === 0) return;
				event.preventDefault();
				this.close();
				return;
			case "Backspace":
				if (this.text === "" && this.value.length > 0) {
					this.setValue(this.value.slice(0, -1));
				}
				return;
		}
	};

	override render() {
		const matches = this.open ? this.visibleSuggestions() : [];
		const expanded = matches.length > 0;
		const active = expanded && this.active >= 0 ? this.active : -1;
		return html`
			<label for="input">${this.label}</label>
			<div class="field">
				${
					this.value.length > 0
						? html`<ul class="chips">
								${this.value.map(
									(tag) => html`<li class="chip">
										<span class="chip-text">${tag}</span>
										<button
											type="button"
											class="remove"
											aria-label=${t("tagInput.remove", { tag })}
											@click=${() => this.removeTag(tag)}
										>×</button>
									</li>`,
								)}
							</ul>`
						: nothing
				}
				<input
					id="input"
					role="combobox"
					autocomplete="off"
					aria-autocomplete="list"
					aria-expanded=${expanded ? "true" : "false"}
					aria-controls="listbox"
					aria-activedescendant=${active >= 0 ? `option-${active}` : nothing}
					aria-describedby=${this.hint ? "hint" : nothing}
					.value=${live(this.text)}
					@input=${this.onInput}
					@keydown=${this.onKeyDown}
					@focus=${() => {
						this.open = true;
					}}
					@blur=${() => this.close()}
				/>
			</div>
			<ul id="listbox" role="listbox" ?hidden=${!expanded}>
				${matches.map(
					(tag, index) => html`<li
						id="option-${index}"
						role="option"
						aria-selected=${index === active ? "true" : "false"}
						@mousedown=${(event: Event) => event.preventDefault()}
						@click=${() => this.add(tag)}
					>
						${tag}
					</li>`,
				)}
			</ul>
			${this.hint ? html`<span id="hint" class="hint">${this.hint}</span>` : nothing}
		`;
	}
}
