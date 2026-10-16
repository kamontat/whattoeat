/** Whether Home's wide filter panel is hidden; stored only while hidden. */
export const PANEL_KEY = "whattoeat:filter-panel";

export const isFilterPanelHidden = (): boolean => {
	try {
		return localStorage.getItem(PANEL_KEY) === "hidden";
	} catch {
		// Storage blocked: show the panel.
		return false;
	}
};

export const setFilterPanelHidden = (hidden: boolean): void => {
	try {
		if (hidden) localStorage.setItem(PANEL_KEY, "hidden");
		else localStorage.removeItem(PANEL_KEY);
	} catch {
		// Storage blocked: the choice lasts for this page only.
	}
};
