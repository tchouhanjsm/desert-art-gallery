type PreviewArtworkProps = {
  title: string;
  category?: string;
  variant?: "textile" | "embroidered" | "object" | "heritage";
};

export function PreviewArtwork({
  title,
  category,
  variant = "textile",
}: PreviewArtworkProps) {
  return (
    <div
      className={"atelier-preview-art atelier-preview-art--" + variant}
      role="img"
      aria-label={"Design placeholder for " + title + ". Original gallery photography is pending approval."}
    >
      <span className="atelier-preview-art-code">DAG / VISUAL STUDY</span>
      <span className="atelier-preview-art-monogram" aria-hidden="true">D</span>
      <span className="atelier-preview-art-title">{category || "THE GALLERY"}</span>
      <span className="atelier-preview-art-caption">ORIGINAL PHOTOGRAPHY TO BE ADDED</span>
    </div>
  );
}
