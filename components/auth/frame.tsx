import { Mark } from "@/components/icons";
import AuthFrag from "@/components/summary/auth-frag";

/**
 * The auth screen frame — brand, the form card, and the product fragment
 * beside it. children: the card's inner content (h1 + form), links: the
 * supporting sentence under the card.
 */
export default function AuthFrame({
  children,
  links,
  fragCaption,
}: {
  children: React.ReactNode;
  links: React.ReactNode;
  fragCaption: string;
}) {
  return (
    <div className="auth">
      <div className="auth-col">
        <div className="brand">
          <Mark size={22} />
          <span className="wordmark">Margins</span>
        </div>
        <div className="auth-card">{children}</div>
        <p className="links">{links}</p>
      </div>
      <AuthFrag caption={fragCaption} />
    </div>
  );
}
