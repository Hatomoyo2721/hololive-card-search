import json
import re
from pathlib import Path

TALENTS_PATH = Path(__file__).resolve().parent.parent / "data" / "talents.json"


def load_talent_aliases():
    """Load {japanese name: english/romaji name} from data/talents.json."""
    with TALENTS_PATH.open("r", encoding="utf-8") as file:
        return json.load(file)


TALENT_ALIASES = load_talent_aliases()


def normalize_alias(value):
    return re.sub(r"[^a-z0-9]+", " ", value.casefold()).strip()


ALIAS_LOOKUP = {}

for japanese_name, english_name in TALENT_ALIASES.items():
    aliases = [english_name]
    aliases.extend(english_name.split())

    for alias in aliases:
        key = normalize_alias(alias)

        if key:
            ALIAS_LOOKUP.setdefault(key, set()).add(japanese_name)


def get_japanese_aliases(keyword):
    """Return every Japanese talent name matching the (romaji) keyword."""
    normalized = normalize_alias(keyword)

    if len(normalized) < 2:
        return []

    matched_names = set()

    for alias, japanese_names in ALIAS_LOOKUP.items():
        if normalized in alias:
            matched_names.update(japanese_names)

    return sorted(matched_names)


def translate_name(name):
    """Return the romaji name for a talent card, otherwise the original name."""
    if not name:
        return name

    return TALENT_ALIASES.get(name.strip(), name)
