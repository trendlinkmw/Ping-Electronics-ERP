// Decides whether "light" styling should be active for a given theme preference.
export function computeIsLight(mode) {
  if (mode === 'light') return true
  if (mode === 'dark') return false
  // 'system' — follow the OS/browser preference
  return typeof window !== 'undefined'
    && window.matchMedia
    && !window.matchMedia('(prefers-color-scheme: dark)').matches
}

// Applies the theme by toggling a class on <html> — every page picks this up
// automatically since colors are wired to CSS variables in tailwind.config.js.
export function applyTheme(mode) {
  const isLight = computeIsLight(mode)
  document.documentElement.classList.toggle('light', isLight)
}