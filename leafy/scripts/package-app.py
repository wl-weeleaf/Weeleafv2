"""Package runnable app source and optional original art below static asset limits."""
from pathlib import Path
import subprocess
import zipfile

root = Path(__file__).resolve().parents[1]
files = subprocess.check_output(["git", "ls-files", "--cached", "--others", "--exclude-standard"], cwd=root, text=True).splitlines()
with zipfile.ZipFile(root / "public/downloads/leafy-grok-project.zip", "w", zipfile.ZIP_DEFLATED, compresslevel=9) as archive:
    for name in files:
        file = root / name
        if not file.is_file() or name.startswith("public/downloads/") or file.name == "tsconfig.tsbuildinfo":
            continue
        if name.startswith("public/leafy-live/wasm/") or name == "public/leafy-live/vision_bundle.mjs":
            continue  # Recreated from pinned npm dependency by live:assets before dev/build.
        if name.startswith("assets/") and file.suffix != ".md":
            continue
        archive.write(file, "leafy-0.1/" + name)
with zipfile.ZipFile(root / "public/downloads/leafy-design-sources.zip", "w", zipfile.ZIP_DEFLATED, compresslevel=9) as archive:
    for file in (root / "assets").rglob("*"):
        if file.is_file():
            archive.write(file, file.relative_to(root))
for name in ["leafy-grok-project.zip", "leafy-design-sources.zip"]:
    size = (root / "public/downloads" / name).stat().st_size
    if size > 26214400:
        raise RuntimeError(f"{name} exceeds the hosting asset limit")
    print(f"{name}: {size} bytes")

with zipfile.ZipFile(root / "public/downloads/leafy-chrome-extension.zip", "w", zipfile.ZIP_DEFLATED) as archive:
    for file in (root / "integration/chrome-extension").rglob("*"):
        if file.is_file():
            archive.write(file, "leafy-chrome-extension/" + str(file.relative_to(root / "integration/chrome-extension")))
print("leafy-chrome-extension.zip:", (root / "public/downloads/leafy-chrome-extension.zip").stat().st_size, "bytes")

with zipfile.ZipFile(root / "public/downloads/leafy-pc-bridge.zip", "w", zipfile.ZIP_DEFLATED) as archive:
    for name in ["connect.mjs", "operations.mjs", "README.md"]:
        archive.write(root / "integration/pc-bridge" / name, "leafy-pc-bridge/" + name)
print("leafy-pc-bridge.zip:", (root / "public/downloads/leafy-pc-bridge.zip").stat().st_size, "bytes")

with zipfile.ZipFile(root / "public/downloads/leafy-browser-engine.zip", "w", zipfile.ZIP_DEFLATED) as archive:
    for file in (root / "integration/browser-engine").rglob("*"):
        if file.is_file() and file.name != ".env":
            archive.write(file, "leafy-browser-engine/" + str(file.relative_to(root / "integration/browser-engine")))
print("leafy-browser-engine.zip:", (root / "public/downloads/leafy-browser-engine.zip").stat().st_size, "bytes")
