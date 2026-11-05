import * as React from "react";
import type { ReactNode } from "react";

type StorefrontSectionHeadingProps = {
  eyebrow: ReactNode;
  title: ReactNode;
  id?: string;
  description?: ReactNode;
  action?: ReactNode;
  className?: string;
};

/**
 * Shared section heading for editorial and merchandising sections. The action
 * remains a direct child so existing flex layouts keep their intended rhythm.
 */
export function StorefrontSectionHeading({
  eyebrow,
  title,
  id,
  description,
  action,
  className = "jp-home-section-heading",
}: StorefrontSectionHeadingProps) {
  return (
    <div className={className}>
      <div>
        <div className="section-kicker">{eyebrow}</div>
        <h2 id={id} className="section-title">{title}</h2>
        {description != null && <p>{description}</p>}
      </div>
      {action}
    </div>
  );
}
