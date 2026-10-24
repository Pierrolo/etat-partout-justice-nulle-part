#!/usr/bin/env python3
"""Regenerate every JSON file of site/src/data/ from the CSV dumps and research pages.

    python3 -I pipeline/build.py              # build, then validate
    python3 -I pipeline/build.py --no-validate
    python3 -I pipeline/build.py --check      # rebuild in memory and fail if files on disk differ

Isolated mode (-I) removes the script directory from sys.path, so this directory (our own,
trusted code) is added explicitly below.  Inputs under data/ and research/ are only parsed
as text / csv / json, never executed.
"""
from __future__ import annotations

import hashlib
import os
import sys

sys.dont_write_bytecode = True  # keep pipeline/ free of __pycache__

HERE = os.path.dirname(os.path.abspath(__file__))
if HERE not in sys.path:
    sys.path.insert(0, HERE)

import functools  # noqa: E402

import b_agences  # noqa: E402
import b_amendements  # noqa: E402
import b_calendrier  # noqa: E402
import b_cofog  # noqa: E402
import b_credits  # noqa: E402
import b_etat  # noqa: E402
import b_europe  # noqa: E402
import b_fiches  # noqa: E402
import b_lifecycle  # noqa: E402
import b_niches  # noqa: E402
import b_plan  # noqa: E402
import facts_def  # noqa: E402
from lib import OUT_DIR, dumps, write_json  # noqa: E402

# builders used by several others are computed once
for _m in (b_credits, b_niches, b_europe):
    _m.build = functools.cache(_m.build)

OUTPUTS = [
    ("depenses-cofog.json", b_cofog.build),
    ("europe.json", b_europe.build),
    ("etat-partout.json", b_etat.build),
    ("plan-flux.json", b_plan.build),
    ("niches.json", b_niches.build),
    ("agences.json", b_agences.build),
    ("credits-retires.json", b_credits.build),
    ("calendrier.json", b_calendrier.build),
    ("amendements.json", b_amendements.build),
    ("fiches.json", b_fiches.build),
    ("lifecycle.json", b_lifecycle.build),
]


def build_facts_json() -> dict:
    return facts_def.build_facts().dump()


def build_all() -> dict[str, str]:
    """name -> serialized JSON text (deterministic)."""
    out = {}
    for name, fn in OUTPUTS:
        out[name] = dumps(fn())
    out["facts.json"] = dumps(build_facts_json())
    return out


def manifest(texts: dict[str, str]) -> str:
    import json

    entries = {}
    for name in sorted(texts):
        obj = json.loads(texts[name])
        counts = {}
        if isinstance(obj, dict):
            if name == "facts.json":
                counts["facts"] = len(obj)
            else:
                for k, v in obj.items():
                    if isinstance(v, list):
                        counts[k] = len(v)
        entries[name] = {
            "bytes": len(texts[name].encode("utf-8")),
            "sha256": hashlib.sha256(texts[name].encode("utf-8")).hexdigest(),
            "top_level_lists": counts,
        }
    return dumps({
        "_comment": "Généré par pipeline/build.py ; sha256 du texte JSON de chaque fichier (hors manifest.json). Sortie déterministe : deux exécutions donnent les mêmes empreintes.",
        "files": entries,
    })


def main(argv: list[str]) -> int:
    check = "--check" in argv
    texts = build_all()
    texts["manifest.json"] = manifest({k: v for k, v in texts.items()})
    if check:
        bad = []
        for name, txt in texts.items():
            p = OUT_DIR / name
            if not p.exists() or p.read_text(encoding="utf-8") != txt:
                bad.append(name)
        if bad:
            print("DIFFERENT from disk:", ", ".join(sorted(bad)))
            return 1
        print(f"OK: {len(texts)} files identical to a fresh build")
        return 0
    for name, txt in texts.items():
        OUT_DIR.mkdir(parents=True, exist_ok=True)
        (OUT_DIR / name).write_text(txt, encoding="utf-8", newline="\n")
        print(f"wrote {OUT_DIR / name}  ({len(txt.encode('utf-8')):,} bytes)")
    if "--no-validate" not in argv:
        import validate

        return validate.main([])
    return 0


if __name__ == "__main__":
    sys.exit(main(sys.argv[1:]))
