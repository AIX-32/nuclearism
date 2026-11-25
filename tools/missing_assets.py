#!/usr/bin/env python3
"""Report workbenches with no model and items with no texture-backed icon.

Run: python3 tools/missing_assets.py [--self-check]
Uses node to read the real ES-module catalogue, so helper-generated items and
the spread-in building pieces are included. Paths resolve from the repo root.
"""
import json
import subprocess
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent

# Mirrors itemIconUrl()/itemModelIcon() in game.js and content.js.
DUMP = r"""
import { ITEM_DEFS, MACHINE_DEFS, ITEM_MODEL_ICON_EXCLUDE, itemModelIcon } from './assets/js/content.js';
const items = Object.entries(ITEM_DEFS).map(([id, def]) => ({
  id, name: def.name, icon: def.icon || null,
  model: itemModelIcon(id), excluded: ITEM_MODEL_ICON_EXCLUDE.has(id),
}));
const machines = MACHINE_DEFS.map(m => ({ id: m.id, name: m.name, model: m.model || null }));
process.stdout.write(JSON.stringify({ items, machines }));
"""


def exists(rel):
    return bool(rel) and (ROOT / rel).is_file()


def load():
    try:
        p = subprocess.run(["node", "--input-type=module", "-e", DUMP], cwd=ROOT,
                           capture_output=True, text=True, check=True)
    except FileNotFoundError:
        sys.exit("node not found — needed to read content.js")
    except subprocess.CalledProcessError as e:
        sys.exit("node could not read content.js:\n" + e.stderr.strip())
    return json.loads(p.stdout)


def icon_source(item):
    """Return (kind, path, exists) following game.js itemIconUrl() precedence."""
    icon, model = item["icon"], item["model"]
    if item["excluded"] and icon and icon.startswith("assets/"):
        return "texture", icon, exists(icon)
    if model and exists(model):
        return "model", model, True
    if icon and icon.startswith("assets/"):
        return "texture", icon, exists(icon)
    return "generated tile", model or "-", False


def self_check():
    cases = [
        ({"icon": "assets/images/vegetation/plant05.png", "model": None, "excluded": True}, ("texture", True)),
        ({"icon": None, "model": "assets/models/items/triangle_wood.glb", "excluded": False}, ("model", True)),
        ({"icon": "assets/images/items/missing.png", "model": None, "excluded": False}, ("texture", False)),
        ({"icon": None, "model": "assets/models/items/missing.glb", "excluded": False}, ("generated tile", False)),
    ]
    for item, want in cases:
        kind, _, ok = icon_source(item)
        assert (kind, ok) == want, (item, kind, ok, want)
    print("self-check ok")


def find_missing(data):
    """Return (machines missing a model, items with no texture-backed icon)."""
    no_model = [m for m in data["machines"] if not exists(m["model"])]
    no_icon = []
    for i in data["items"]:
        kind, path, ok = icon_source(i)
        if not (ok and kind in ("texture", "model")):
            no_icon.append((i, kind, path))
    return no_model, no_icon


def main():
    if "--self-check" in sys.argv:
        self_check()
        return
    data = load()
    no_model, no_icon = find_missing(data)
    broken_icon = [(i, p) for i, k, p in no_icon if k == "texture"]
    tile = [(i, p) for i, k, p in no_icon if k != "texture"]

    print(f"Workbenches: {len(data['machines'])} total, {len(no_model)} missing a model")
    for m in no_model:
        print(f"  {m['id']:<28} {m['name']:<22} {m['model'] or '<no model field>'}")

    print(f"\nItems: {len(data['items'])} total, {len(no_icon)} with no texture-backed icon")
    if broken_icon:
        print(f"  Broken icon path ({len(broken_icon)}) — referenced PNG is missing:")
        for i, p in broken_icon:
            print(f"    {i['id']:<28} {p}")
    print(f"  Generated code tile ({len(tile)}) — no icon path and no model file:")
    for i, p in tile:
        print(f"    {i['id']:<28} {i['name']:<22} {p}")


if __name__ == "__main__":
    main()
