import json
import re
from pathlib import Path

TALENTS_PATH = Path(__file__).resolve().parent.parent / "data" / "talents.json"


def load_talent_generations():
    """Load {generation: {japanese name: name or {name, status}}}."""
    with TALENTS_PATH.open("r", encoding="utf-8") as file:
        return json.load(file)


TALENTS_BY_GENERATION = load_talent_generations()


def _unwrap(entry):
    """Return (english name, status) for one member entry.

    Status is "active" unless the entry is a dict carrying "status"
    (e.g. "graduated", "affiliate")
    Backwards compatible with the older {"graduated": true} shape
    """
    if isinstance(entry, dict):
        status = entry.get("status")

        if not status and entry.get("graduated"):
            status = "graduated"

        if not status and entry.get("affiliate"):
            status = "affiliate"

        return entry["name"], (status or "active")

    return entry, "active"


# Flat {japanese name: english/romaji name}, built from the grouped data.
TALENT_ALIASES = {}

# {japanese name: generation label}
TALENT_GENERATIONS = {}

# {japanese name: status} for members whose status is not "active".
TALENT_STATUS = {}


for generation, members in TALENTS_BY_GENERATION.items():
    for japanese_name, entry in members.items():
        english_name, status = _unwrap(entry)
        TALENT_ALIASES[japanese_name] = english_name
        TALENT_GENERATIONS[japanese_name] = generation

        if status != "active":
            TALENT_STATUS[japanese_name] = status

# {japanese name: True} for graduated members only.
GRADUATED_TALENTS = {
    japanese_name
    for japanese_name, status in TALENT_STATUS.items()
    if status == "graduated"
}

# {japanese name: True} for affiliate members only.
AFFILIATE_TALENTS = {
    japanese_name
    for japanese_name, status in TALENT_STATUS.items()
    if status == "affiliate"
}


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


def get_status(name):
    """Return a talent's status: "active", "graduated" or "affiliate"."""
    if not name:
        return None

    return TALENT_STATUS.get(name.strip(), "active")


def is_graduated(name):
    """Return True if the talent has graduated."""
    if not name:
        return False

    return name.strip() in GRADUATED_TALENTS


def is_affiliate(name):
    """Return True if the talent is an affiliate (not streaming)."""
    if not name:
        return False

    return name.strip() in AFFILIATE_TALENTS
