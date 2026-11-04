import { MapPin, MessageCircle, PackageCheck } from "lucide-react";

// Keep reassurance grounded in information the gallery already publishes.
// Shipping, returns, authenticity and review claims require separate owner approval.
const items = [
  { icon: MapPin, title: "Based in Jaisalmer", text: "Rajasthan, India" },
  { icon: PackageCheck, title: "Considered product details", text: "See the information supplied for each piece" },
  { icon: MessageCircle, title: "Speak with the gallery", text: "Ask about a piece before you decide" },
];

export function TrustStrip() {
  return (
    <div className="trust-strip" aria-label="Gallery information">
      {items.map(({ icon: Icon, title, text }) => (
        <div key={title}>
          <Icon size={22} aria-hidden="true" />
          <p style={{ margin: 0 }}><b>{title}</b><span>{text}</span></p>
        </div>
      ))}
    </div>
  );
}
