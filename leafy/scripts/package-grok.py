from pathlib import Path
from zipfile import ZIP_DEFLATED, ZipFile
import sys

root = Path(__file__).resolve().parents[1]
out = root / 'public' / 'downloads' / 'leafy-grok-project.zip'
out.parent.mkdir(parents=True, exist_ok=True)
excluded_dirs = {'.git', '.next', '.vinext', '.wrangler', '.sites-runtime', '.agents', '.codex', 'node_modules', 'dist', 'build', 'coverage', '__pycache__'}
excluded_files = {'leafy-grok-project.zip'}
archival_art_sources = {'mouth-source.png', 'npc-base-source.png', 'expression-atlas-source.png', 'back-source.png'}
with ZipFile(out, 'w', ZIP_DEFLATED, compresslevel=6) as archive:
    archive.write(root / 'README_GROK.md', 'README_GROK.md')
    # Vite config imports this runtime helper; it must ship even though the
    # generated build/ directory is otherwise excluded from the source bundle.
    archive.write(root / 'build' / 'sites-vite-plugin.ts', 'build/sites-vite-plugin.ts')
    if (root / 'build' / 'sites-vite-plugin.LICENSE').is_file():
        archive.write(root / 'build' / 'sites-vite-plugin.LICENSE', 'build/sites-vite-plugin.LICENSE')
    for top in root.iterdir():
        if top.name in excluded_dirs or top.name in {'README_GROK.md'}:
            continue
        if top.name == 'public':
            for path in top.rglob('*'):
                if not path.is_file() or 'downloads' in path.relative_to(top).parts:
                    continue
                if path.relative_to(root).as_posix().startswith('public/leafy-live/wasm/') or path.relative_to(root).as_posix() == 'public/leafy-live/vision_bundle.mjs':
                    continue  # Rebuilt from the pinned MediaPipe npm package during setup/build.
                archive.write(path, path.relative_to(root).as_posix())
            continue
        if top.is_file():
            if top.name not in excluded_files and not top.name.startswith('.env') and top.name != 'tsconfig.tsbuildinfo':
                archive.write(top, top.name)
            continue
        for path in top.rglob('*'):
            if not path.is_file():
                continue
            rel = path.relative_to(root)
            if any(part in excluded_dirs for part in rel.parts) or path.name in excluded_files:
                continue
            if rel.parts[:2] == ('assets', 'leafy') and path.name in archival_art_sources:
                continue
            if path.name.startswith('.env') or path.name == 'tsconfig.tsbuildinfo':
                continue
            archive.write(path, rel.as_posix())
size = out.stat().st_size
if size > 24 * 1024 * 1024:
    out.unlink(missing_ok=True)
    raise SystemExit(f'Package is too large for reliable one-file hosting: {size} bytes')
with ZipFile(out) as archive:
    bad = archive.testzip()
    if bad:
        out.unlink(missing_ok=True)
        raise SystemExit(f'Archive integrity check failed: {bad}')
print(f'{out}\n{size} bytes\n{len(archive.namelist())} files')
