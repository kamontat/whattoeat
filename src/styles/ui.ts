import { css } from "lit";

/** Shared look for buttons, form fields, cards and tag chips inside component shadow roots. */
export const uiStyles = css`
	:host {
		display: block;
	}

	h1,
	h2,
	p {
		margin: 0;
	}

	a {
		color: var(--color-primary);
	}

	button {
		font: inherit;
		cursor: pointer;
		padding: 0.5rem 1rem;
		border: 1px solid var(--color-border);
		border-radius: var(--radius);
		background: var(--color-surface);
		color: var(--color-text);
	}

	button.primary {
		background: var(--color-primary);
		border-color: var(--color-primary);
		color: var(--color-primary-text);
	}

	button.danger {
		border-color: var(--color-danger);
		color: var(--color-danger);
	}

	label {
		display: grid;
		gap: 0.25rem;
		font-weight: 600;
	}

	input,
	textarea {
		font: inherit;
		box-sizing: border-box;
		width: 100%;
		padding: 0.5rem 0.75rem;
		border: 1px solid var(--color-border);
		border-radius: var(--radius);
		background: var(--color-surface);
		color: inherit;
	}

	.card {
		display: grid;
		gap: 0.75rem;
		padding: 1rem;
		border: 1px solid var(--color-border);
		border-radius: var(--radius);
		background: var(--color-surface);
	}

	.actions {
		display: flex;
		flex-wrap: wrap;
		gap: 0.5rem;
	}

	.chips {
		display: flex;
		flex-wrap: wrap;
		gap: 0.25rem;
		margin: 0;
		padding: 0;
		list-style: none;
	}

	.chip {
		padding: 0.125rem 0.625rem;
		border: 1px solid var(--color-border);
		border-radius: 999px;
		background: var(--color-bg);
		font-size: 0.875rem;
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
`;
