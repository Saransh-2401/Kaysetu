/** The display serif's ampersand is a swash glyph that reads oddly inside
 *  headings - render "&" in the sans face instead, keeping the serif words. */
export default function Amp({ text }: { text: React.ReactNode }) {
  if (typeof text !== "string") return <>{text}</>;
  const parts = text.split(" & ");
  if (parts.length === 1) return <>{text}</>;
  return (
    <>
      {parts.map((t, i) => (
        <span key={`${t}-${i}`}>
          {i > 0 && <span className="font-sans"> &amp; </span>}
          {t}
        </span>
      ))}
    </>
  );
}
