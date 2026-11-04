import { MapPin, Hand, MessageCircle, Sparkles } from "lucide-react";

// Only facts the gallery has already stated. Add shipping/returns/authenticity
// items here once the owner confirms the exact wording.
const items = [
  { icon: MapPin, title: "Based in Jaisalmer", text: "Rajasthan, India" },
  { icon: Hand, title: "Handcrafted textiles", text: "Embroidery, zari & vintage" },
  { icon: Sparkles, title: "Rare, one-of-a-kind", text: "Pieces with a past" },
  { icon: MessageCircle, title: "Talk to the gallery", text: "Ask before you decide" },
];

export function TrustStrip() {
  return (
    <div className="trust-strip" aria-label="Why shop with us">
      {items.map(({ icon: Icon, title, text }) => (
        <div key={title}><Icon size={22} aria-hidden="true" /><p style={{ margin: 0 }}><b>{title}</b><span>{text}</span></p></div>
      ))}
    </div>
  );
}
