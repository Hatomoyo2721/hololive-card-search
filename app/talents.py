import json
import re
from pathlib import Path

TALENTS_PATH = Path(__file__).resolve().parent.parent / "data" / "talents.json"


def load_talent_generations():
    """Load {generation: {japanese name: name or {name, graduated}}}."""
    with TALENTS_PATH.open("r", encoding="utf-8") as file:
        return json.load(file)


TALENTS_BY_GENERATION = load_talent_generations()


def _unwrap(entry):
    """Return (english name, graduated flag) for one member entry."""
    if isinstance(entry, dict):
        return entry["name"], bool(entry.get("graduated"))

    return entry, False


# Flat {japanese name: english/romaji name}, built from the grouped data.
TALENT_ALIASES = {}

# {japanese name: generation label}
TALENT_GENERATIONS = {}

# {japanese name: True} for graduated members only.
GRADUATED_TALENTS = {
    japanese_name
    for members in TALENTS_BY_GENERATION.values()
    for japanese_name, entry in members.items()
    if _unwrap(entry)[1]
}


for generation, members in TALENTS_BY_GENERATION.items():
    for japanese_name, entry in members.items():
        english_name, _ = _unwrap(entry)
        TALENT_ALIASES[japanese_name] = english_name
        TALENT_GENERATIONS[japanese_name] = generation


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


def get_generation(name):
    """Return the generation label for a talent, or None."""
    if not name:
        return None

    return TALENT_GENERATIONS.get(name.strip())


def is_graduated(name):
    """Return True if the talent has graduated."""
    if not name:
        return False

    return name.strip() in GRADUATED_TALENTS
