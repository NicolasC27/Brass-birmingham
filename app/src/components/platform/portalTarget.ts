/* ------------------------------------------------------------------ */
/* Portal target for platform overlays (Modal, Toast). Portaling to   */
/* document.body would escape .platform-root — and with it every      */
/* theme-driven CSS variable — so overlays mount inside the platform  */
/* root instead (falls back to body outside the platform shell).      */
/* ------------------------------------------------------------------ */

export function platformPortalTarget(): HTMLElement {
  return document.querySelector<HTMLElement>('.platform-root') ?? document.body;
}
