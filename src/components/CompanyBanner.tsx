/**
 * A company's 3:1 cover banner — the uploaded image, or (most companies, at
 * first) a flat soft grey with a faint dot pattern, so a card or page
 * header never shows a flat empty box. Fills its parent; the parent sets
 * the height/aspect and rounding.
 */
export default function CompanyBanner({
  url,
  className = "",
  eager = false,
}: {
  url: string | null | undefined;
  className?: string;
  // For a banner at the top of the page (the company page header), where
  // lazy-loading would only delay the largest image on screen.
  eager?: boolean;
}) {
  if (url) {
    return (
      // eslint-disable-next-line @next/next/no-img-element
      <img src={url} alt="" loading={eager ? "eager" : "lazy"} className={`h-full w-full object-cover ${className}`} />
    );
  }
  return (
    <div
      aria-hidden
      className={`h-full w-full ${className}`}
      style={{
        backgroundImage:
          "radial-gradient(rgba(255,255,255,0.8) 1px, transparent 1px)",
        backgroundColor: "#ECEEF2",
        backgroundSize: "14px 14px",
      }}
    />
  );
}
