type HeadshotProps =
  & { className?: string }
  & (
    | { name: string; decorative?: false }
    | { name?: undefined; decorative: true }
  );

export function Headshot({ name, decorative, className }: HeadshotProps) {
  const a11y = decorative
    ? { "aria-hidden": true as const }
    : { role: "img" as const, "aria-label": `Headshot of ${name}` };

  return (
    <svg
      viewBox="0 0 64 64"
      xmlns="http://www.w3.org/2000/svg"
      className={className}
      {...a11y}
    >
      <circle cx="32" cy="22" r="12" fill="currentColor" />
      <path
        d="M8 60c0-12 10.75-20 24-20s24 8 24 20z"
        fill="currentColor"
      />
    </svg>
  );
}
