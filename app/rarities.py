"""Rarity metadata for the search UI.

One source of truth for the rarity filter dropdown and the rarity legend in the
search guide, so the two never drift apart. Codes and full names come from the
official card game; the split into basic and parallel groups matches how the
cards are actually released.
"""

BASIC_RARITIES = [
    ("C", "Common"),
    ("U", "Uncommon"),
    ("R", "Rare"),
    ("RR", "Double Rare"),
    ("OSR", "Oshi Super Rare"),
]

PARALLEL_RARITIES = [
    ("S", "Special"),
    ("SR", "Super Rare"),
    ("HR", "Holomem Rare"),
    ("UR", "Ultra Rare"),
    ("OUR", "Oshi Ultra Rare"),
    ("SEC", "Secret Rare"),
    ("SY", "Special Yell"),
]

ALL_RARITIES = BASIC_RARITIES + PARALLEL_RARITIES
