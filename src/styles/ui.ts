import { css } from "lit";

/** Shared look for buttons, form fields, grouped lists, segmented controls and chips inside component shadow roots. */
export const uiStyles = css`
	:host {
		display: block;
	}

	h1,
	h2,
	h3,
	p {
		margin: 0;
	}

	a {
		color: var(--color-link);
	}

	:focus-visible {
		outline: 3px solid var(--color-focus);
		outline-offset: 2px;
	}

	.page-title {
		font-size: var(--title-size);
		line-height: 1.15;
		font-weight: 700;
		letter-spacing: -0.01em;
	}

	.page-sub {
		color: var(--color-muted);
		font-size: 0.9375rem;
	}

	button {
		display: inline-flex;
		align-items: center;
		justify-content: center;
		gap: 0.5rem;
		min-height: var(--tap);
		padding: 0 var(--pad-x);
		font: inherit;
		font-weight: 600;
		cursor: pointer;
		border: 1.5px solid var(--color-control);
		border-radius: var(--radius-pill);
		background: var(--color-surface);
		color: var(--color-text);
	}

	button:disabled {
		cursor: not-allowed;
		opacity: 0.55;
	}

	button.primary {
		background: var(--color-primary);
		border-color: var(--color-primary);
		color: var(--color-primary-text);
	}

	button.accent {
		background: var(--color-accent);
		border-color: var(--color-accent);
		color: var(--color-accent-text);
	}

	button.danger {
		background: transparent;
		border-color: var(--color-danger);
		color: var(--color-danger);
	}

	button.quiet {
		border-color: transparent;
		background: transparent;
		color: var(--color-link);
	}

	label {
		display: grid;
		gap: 0.375rem;
		font-weight: 600;
	}

	input,
	select,
	textarea {
		font: inherit;
		font-size: 1rem;
		box-sizing: border-box;
		width: 100%;
		min-height: var(--tap);
		padding: 0.5rem 0.75rem;
		border: 1.5px solid var(--color-control);
		border-radius: var(--radius-sm);
		background: var(--color-surface);
		color: inherit;
	}

	input[type="checkbox"],
	input[type="radio"] {
		width: auto;
		min-height: 0;
		accent-color: var(--color-primary);
	}

	.card {
		display: grid;
		gap: 0.75rem;
		padding: var(--pad-x);
		border-radius: var(--radius);
		background: var(--color-surface);
		box-shadow: var(--shadow);
		overflow-wrap: anywhere;
	}

	.card > * {
		min-width: 0;
	}

	.actions {
		display: flex;
		flex-wrap: wrap;
		gap: 0.625rem;
	}

	/* Grouped list: rounded surface, one row per item, dividers between rows. */
	.group-label {
		padding: 0.375rem var(--pad-x) 0;
		color: var(--color-muted);
		font-size: 0.8125rem;
		font-weight: 600;
		letter-spacing: 0.06em;
		text-transform: uppercase;
	}

	.group {
		display: grid;
		margin: 0;
		padding: 0;
		list-style: none;
		border-radius: var(--radius);
		background: var(--color-surface);
		box-shadow: var(--shadow);
		overflow: hidden;
	}

	.item {
		display: flex;
		align-items: center;
		gap: 0.75rem;
		box-sizing: border-box;
		width: 100%;
		min-height: var(--tap);
		padding: var(--row-pad-y) 0.875rem var(--row-pad-y) var(--pad-x);
		border: 0;
		border-radius: 0;
		background: transparent;
		color: var(--color-text);
		font: inherit;
		font-weight: 400;
		text-align: start;
		text-decoration: none;
	}

	.item + .item,
	.group > * + * > .item {
		border-top: 1px solid var(--color-border);
	}

	.item:focus-visible {
		outline-offset: -3px;
	}

	.item .lead,
	.item .trail {
		display: flex;
		flex: none;
		color: var(--color-muted);
	}

	.item .grow {
		display: grid;
		flex: 1;
		min-width: 0;
	}

	.item b {
		font-weight: 600;
		font-size: var(--row-text);
	}

	.item small {
		color: var(--color-muted);
		font-size: 0.875rem;
	}

	.item.danger,
	.item.danger .lead {
		color: var(--color-danger);
	}

	/* Segmented control: native radios, the checked one in ink. */
	.seg {
		display: grid;
		grid-auto-flow: column;
		grid-auto-columns: minmax(0, 1fr);
		gap: 2px;
		padding: 3px;
		border: 1px solid var(--color-control);
		border-radius: var(--radius-sm);
		background: var(--color-surface-2);
	}

	.seg label {
		display: block;
		position: relative;
		font-weight: 600;
	}

	.seg input {
		position: absolute;
		inset: 0;
		margin: 0;
		opacity: 0;
		cursor: pointer;
	}

	.seg input + span {
		display: flex;
		align-items: center;
		justify-content: center;
		gap: 0.375rem;
		min-height: var(--tap);
		padding: 0 0.75rem;
		border-radius: calc(var(--radius-sm) - 3px);
		font-size: 0.875rem;
	}

	.seg input:checked + span {
		background: var(--color-text);
		color: var(--color-bg);
	}

	.seg input:focus-visible + span {
		outline: 3px solid var(--color-focus);
		outline-offset: 1px;
	}

	.chips {
		display: flex;
		flex-wrap: wrap;
		gap: 0.375rem;
		margin: 0;
		padding: 0;
		list-style: none;
	}

	.chip {
		padding: 0.125rem 0.625rem;
		border-radius: var(--radius-pill);
		background: var(--color-surface-2);
		font-size: 0.8125rem;
	}

	.muted,
	.hint {
		color: var(--color-muted);
		font-size: 0.875rem;
		font-weight: 400;
	}

	.error {
		color: var(--color-danger);
	}

	.success {
		color: var(--color-success);
	}

	.warning {
		margin: 0;
		padding: 0.75rem 1rem;
		border: 1.5px solid var(--color-danger);
		border-radius: var(--radius-sm);
		color: var(--color-danger);
	}

	.visually-hidden {
		position: absolute;
		width: 1px;
		height: 1px;
		margin: -1px;
		padding: 0;
		overflow: hidden;
		clip: rect(0 0 0 0);
		white-space: nowrap;
		border: 0;
	}

	@media (forced-colors: active) {
		.seg input:checked + span {
			outline: 2px solid CanvasText;
		}
	}
`;
