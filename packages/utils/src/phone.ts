// Dialable part of a display phone number. Extensions can't be dialed via tel:,
// so "119 ext 8" dials 119 (the caller then asks for ext 8), not 1198.
export const toDialable = (display: string): string =>
  display.split(/\s*(?:ext\.?|ext|x)\s*\d/i)[0].replace(/[^\d+]/g, '');

export const extensionOf = (display: string): string | null =>
  display.match(/(?:ext\.?|x)\s*(\d+)/i)?.[1] ?? null;
