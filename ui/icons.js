const PATHS = {
  sparkles: '<path d="M10 3.5 11.6 8.4 16.5 10l-4.9 1.6L10 16.5l-1.6-4.9L3.5 10l4.9-1.6Z" fill="currentColor"/><path d="M16 2.5l.6 1.9 1.9.6-1.9.6-.6 1.9-.6-1.9-1.9-.6 1.9-.6Z" fill="currentColor"/>',
  doc: '<path d="M5.5 2.5h6l4 4v10.5a1 1 0 0 1-1 1h-9a1 1 0 0 1-1-1v-13.5a1 1 0 0 1 1-1Z"/><path d="M11.5 2.5v4h4M7.5 10.5h5M7.5 13.5h5"/>',
  person: '<circle cx="10" cy="7" r="3.2"/><path d="M3.8 17c.8-3.2 3.3-5 6.2-5s5.4 1.8 6.2 5"/>',
  briefcase: '<rect x="2.5" y="6" width="15" height="10.5" rx="2"/><path d="M7 6V4.5a1 1 0 0 1 1-1h4a1 1 0 0 1 1 1V6M2.5 10.5h15"/>',
  graduationcap: '<path d="M10 4 18 8l-8 4-8-4Z"/><path d="M5.5 10v3.5c1.2 1.3 2.7 2 4.5 2s3.3-.7 4.5-2V10M18 8v4.5"/>',
  checklist: '<path d="M3 5.5l1.5 1.5L7 4.5M3 11.5l1.5 1.5L7 10.5M10 6h7M10 12h7M10 16h7"/>',
  bubble: '<path d="M4 4.5h12a1.5 1.5 0 0 1 1.5 1.5v7a1.5 1.5 0 0 1-1.5 1.5H9l-4 3v-3H4A1.5 1.5 0 0 1 2.5 13V6A1.5 1.5 0 0 1 4 4.5Z"/>',
  folder: '<path d="M2.5 6V15a1.5 1.5 0 0 0 1.5 1.5h12a1.5 1.5 0 0 0 1.5-1.5V7.5A1.5 1.5 0 0 0 16 6H9.5L8 4H4A1.5 1.5 0 0 0 2.5 5.5Z"/>',
  lock: '<rect x="4" y="9" width="12" height="8.5" rx="2"/><path d="M6.8 9V6.5a3.2 3.2 0 0 1 6.4 0V9"/>',
  ladybug: '<ellipse cx="10" cy="11.5" rx="5.5" ry="6"/><path d="M10 5.5v12M7.5 4l1 1.6M12.5 4l-1 1.6M4.5 10H2.5M17.5 10h-2M4.8 14H3M16.9 14h-1.7"/>',
  plus: '<circle cx="10" cy="10" r="8" fill="currentColor" stroke="none"/><path d="M10 6.5v7M6.5 10h7" stroke="#fff" stroke-width="1.8"/>',
  minus: '<circle cx="10" cy="10" r="8" fill="currentColor" stroke="none"/><path d="M6.5 10h7" stroke="#fff" stroke-width="1.8"/>',
  xmark: '<path d="M5.5 5.5l9 9M14.5 5.5l-9 9" stroke-width="2"/>',
  chevron: '<path d="M7.5 4.5 13 10l-5.5 5.5" stroke-width="2"/>',
  check: '<circle cx="10" cy="10" r="8" fill="currentColor" stroke="none"/><path d="M6.5 10.2 8.9 12.5 13.5 7.5" stroke="#fff" stroke-width="1.8"/>',
  warning: '<path d="M10 2.8 18 16.5H2Z" fill="currentColor" stroke="currentColor" stroke-linejoin="round"/><path d="M10 7.5v4M10 14v.1" stroke="#fff" stroke-width="1.8"/>',
  spinner: Array.from({ length: 8 }, (_, i) => `<path d="M10 2.2v3.6" stroke-width="2" opacity="${(i + 1) / 8}" transform="rotate(${i * 45} 10 10)"/>`).join(""),
  magnifier: '<circle cx="8.5" cy="8.5" r="5"/><path d="M12.3 12.3 17 17"/>',
};

export function icon(name, className = "") {
  const wrap = document.createElement("span");
  wrap.innerHTML = `<svg viewBox="0 0 20 20" class="${className}" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${PATHS[name]}</svg>`;
  return wrap.firstChild;
}
