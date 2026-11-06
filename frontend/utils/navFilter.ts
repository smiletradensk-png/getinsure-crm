// One-shot hand-over of a status filter from Home to the Leads tab.
let pending: string | null = null;
export const setPendingStatus = (s: string | null) => { pending = s; };
export const takePendingStatus = (): string | null => { const s = pending; pending = null; return s; };
