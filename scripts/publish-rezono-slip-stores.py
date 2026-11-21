"""Publish Rezono's slip fixture as Rezono's own slip tests do (Decision 0009, point 3).

Run only by .github/workflows/rezono-reader-parity.yml, inside a checkout of rezono-lang/rezono at the pinned commit
(packages/slip/rezono-source.json), with Rezono's locked Python environment. It imports Rezono's
tests/slip/slip_support.py and calls exactly what test_slip_rule_row.py and test_stops_only.py call:

  main:   publish_main                                  (epoch 1, roles checker, reader, summary)
  sweeps: publish_sweeps, then drop_variant(v-item_amount-03-*)

Usage: python publish-rezono-slip-stores.py <rezono checkout> <output directory>
Prints {"main": <store>, "sweeps": <store>} as JSON. The git dates of the sweeps repository come from
GIT_AUTHOR_DATE / GIT_COMMITTER_DATE, which the workflow fixes so every run publishes the same bytes.
"""

from __future__ import annotations

import json
import sys
from pathlib import Path


def main() -> None:
    rezono = Path(sys.argv[1]).resolve()
    out = Path(sys.argv[2]).resolve()
    sys.path.insert(0, str(rezono / "tests" / "slip"))
    import slip_support  # noqa: PLC0415  (Rezono's own test helper, at the pinned commit)

    (out / "main").mkdir(parents=True, exist_ok=True)
    (out / "sweeps").mkdir(parents=True, exist_ok=True)
    main_store, main_manifest = slip_support.publish_main(out / "main")
    sweeps_store, sweeps_manifest, done = slip_support.publish_sweeps(out / "sweeps")
    dropped = next(vid for vid, _ in done if vid.startswith("v-item_amount-03-"))
    slip_support.drop_variant(sweeps_store, dropped)
    print(json.dumps({
        "main": str(main_store),
        "sweeps": str(sweeps_store),
        "manifests": {"main": main_manifest["id"], "sweeps": sweeps_manifest["id"]},
        "dropped": dropped,
    }))


if __name__ == "__main__":
    main()
