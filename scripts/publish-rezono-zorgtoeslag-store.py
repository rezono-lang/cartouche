"""Publish Rezono's healthcare allowance slice across 4 bitemporal (as_of, known) epochs.

Run by .github/workflows/rezono-reader-parity.yml inside a checkout of rezono-lang/rezono at the
pinned commit (contracts/rezono-pin.json), with Rezono's locked Python environment. It imports
Rezono's examples/zorgtoeslag_history_support.py and publishes the exact 4 epochs tested by
examples/test_zorgtoeslag_bitemporal_history.py into one FileStore:

  m-1: (2026-02-01, 2025-11-15)  bob unknown (before 2025-12-01 income knowledge)
  m-2: (2026-02-01, 2025-12-01)  bob known 10500
  m-3: (2026-01-01, 2026-02-01)  gus known 13500 (initial 2026 income estimate)
  m-4: (2026-01-01, 2026-05-01)  gus known 8500  (2026-04-15 retroactive correction)

Usage: python scripts/publish-rezono-zorgtoeslag-store.py <rezono checkout> <output directory>
Prints {"store": <dir>, "epochs": [{"manifest": ..., "as_of": ..., "known": ...}, ...]} as JSON.
"""

from __future__ import annotations

import json
import sys
from pathlib import Path


EPOCHS = [
    ("2026-02-01", "2025-11-15"),
    ("2026-02-01", "2025-12-01"),
    ("2026-01-01", "2026-02-01"),
    ("2026-01-01", "2026-05-01"),
]


def main() -> None:
    rezono = Path(sys.argv[1]).resolve()
    out = Path(sys.argv[2]).resolve()
    out.mkdir(parents=True, exist_ok=True)
    sys.path.insert(0, str(rezono / "examples"))
    import zorgtoeslag_history_support as support  # noqa: PLC0415

    store_dir, manifests = support.publish_history(out, EPOCHS)
    print(json.dumps({
        "store": str(store_dir),
        "epochs": [
            {"manifest": m["id"], "as_of": as_of, "known": known}
            for m, (as_of, known) in zip(manifests, EPOCHS, strict=True)
        ],
    }))


if __name__ == "__main__":
    main()
