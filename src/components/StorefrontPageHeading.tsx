import * as React from "react";
import type { ReactNode } from "react";

type StorefrontPageHeadingProps = {
  eyebrow: ReactNode;
  title: ReactNode;
  description?: ReactNode;
  id?: string;
  className?: string;
  children?: ReactNode;
};

/**
 * Shared public-page masthead. The className prop deliberately preserves each
 * route's existing presentation variant while standardising semantic markup.
 */
export function StorefrontPageHeading({
  eyebrow,
  title,
  description,
  id,
  className = "atelier-page-heading",
  children,
}: StorefrontPageHeadingProps) {
  return (
    <header className={className}>
      <div className="section-kicker">{eyebrow}</div>
      <h1 id={id}>{title}</h1>
      {description != null && <p>{description}</p>}
      {children}
    </header>
  );
}
