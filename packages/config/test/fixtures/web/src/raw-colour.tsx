const ACCENT_RING = `0 0 0 2px oklch(55% 0.12 252)`;

export function RawColourBadge() {
  return (
    <span className="bg-[#2D6BAB]" style={{ color: '#2D6BAB', boxShadow: ACCENT_RING }}>
      Офер
    </span>
  );
}
