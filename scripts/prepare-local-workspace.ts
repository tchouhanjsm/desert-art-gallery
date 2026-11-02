import { chmod, mkdir, readFile } from "node:fs/promises";
import path from "node:path";

const projectRoot = process.cwd();

async function main() {
  const packageContent = JSON.parse(
    await readFile(path.join(projectRoot, "package.json"), "utf8"),
  ) as { name?: string };

  if (packageContent.name !== "desert-art-gallery") {
    throw new Error("Run npm run local:prepare from the Desert Art Gallery repository root.");
  }

  const privateRoot = path.resolve(projectRoot, ".local-data");
  const directories = [
    "mysql",
    "media",
    "imports/etsy",
    "imports/product-images",
    "backups/mysql",
    "backups/media",
  ];

  for (const relativeDirectory of directories) {
    const destination = path.resolve(privateRoot, relativeDirectory);
    if (destination !== privateRoot && !destination.startsWith(privateRoot + path.sep)) {
      throw new Error("A local workspace path escaped .local-data.");
    }
    await mkdir(destination, { recursive: true, mode: 0o700 });
    await chmod(destination, 0o700);
  }

  process.stdout.write("Private local workspace is ready:\n");
  for (const directory of directories) {
    process.stdout.write("  .local-data/" + directory + "/\n");
  }
  process.stdout.write("\nNo database was initialized or modified. Configure a dedicated native MySQL data directory only after verifying the installed server and existing data location.\n");
}

main().catch((error: unknown) => {
  process.stderr.write((error instanceof Error ? error.message : "Unable to prepare the local workspace.") + "\n");
  process.exitCode = 1;
});
