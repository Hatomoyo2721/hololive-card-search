from pathlib import Path

from flask import Flask, jsonify, render_template, request, send_from_directory

from app.database import get_connection
from app.rarities import BASIC_RARITIES, PARALLEL_RARITIES
from app.talents import get_japanese_aliases, translate_name

app = Flask(__name__)

# Card art never changes once scraped, so let the browser keep it. Without this
# Flask sends "no-cache" and every visible card triggers a revalidation round
# trip on each page load. Scoped to /static/assets so edits to JS/CSS still show
# up on a normal reload.
CARD_ART_MAX_AGE = 60 * 60 * 24 * 30  # 30 days
CARDS_PER_PAGE = 24

CARD_SELECT_COLUMNS = """
    id,
    name_en,
    original_title,
    card_game,
    card_number,
    card_index,
    version,
    original_version,
    rarity,
    spec
"""

# Basic rarities first, then parallel rarities: U -> S -> SEC reads naturally
# in the variant strip.
RARITY_RANK = {
    code: index
    for index, (code, _label) in enumerate(BASIC_RARITIES + PARALLEL_RARITIES)
}


@app.route("/static/assets/<path:filename>")
def card_art(filename):
    """Serve card images with a long cache, leaving JS/CSS as no-cache."""
    return send_from_directory(
        Path(app.static_folder) / "assets",
        filename,
        max_age=CARD_ART_MAX_AGE,
    )


def escape_like(value):
    """Escape LIKE wildcards so user input is matched literally."""
    return value.replace("\\", "\\\\").replace("%", "\\%").replace("_", "\\_")


def serialize_card(row):
    """Shape one cards row for the search grid and the variant strip."""
    return {
        "id": row["id"],
        "name": translate_name(row["name_en"]),
        "original_name": row["name_en"],
        "original_title": row["original_title"],
        "card_game": row["card_game"],
        "card_number": row["card_number"],
        "card_index": row["card_index"],
        "version": row["version"],
        "original_version": row["original_version"],
        "rarity": row["rarity"],
        "spec": row["spec"],
    }


@app.route("/")
def home():
    return render_template(
        "search.html",
        basic_rarities=BASIC_RARITIES,
        parallel_rarities=PARALLEL_RARITIES,
    )


@app.route("/cards")
def get_cards():
    keyword = request.args.get("q", "").strip()
    booster = request.args.get("booster", "").strip()
    rarity = request.args.get("rarity", "").strip().upper()
    variant = request.args.get("variant", "").strip().lower()

    conn = get_connection()
    cur = conn.cursor()

    where_clause = """
        WHERE 1=1
    """
    params = []

    if keyword:
        pattern = f"%{escape_like(keyword)}%"

        where_clause += """
            AND (
                name_en LIKE ? ESCAPE '\\'
                OR original_title LIKE ? ESCAPE '\\'
                OR card_number LIKE ? ESCAPE '\\'
        """
        params.extend([pattern, pattern, pattern])

        # Also match the Japanese talent name behind a romaji search.
        for japanese_name in get_japanese_aliases(keyword):
            where_clause += """
                OR name_en LIKE ? ESCAPE '\\'
                OR original_title LIKE ? ESCAPE '\\'
            """
            params.extend(
                [
                    f"%{escape_like(japanese_name)}%",
                    f"%{escape_like(japanese_name)}%",
                ]
            )

        where_clause += ")"

    if rarity:
        # Codes are already normalized to upper case; TRIM guards old rows that
        # were imported with stray spaces.
        where_clause += """
            AND UPPER(TRIM(rarity)) = ?
        """
        params.append(rarity)

    if booster:
        # Filter by `version` instead of card number: reprint / Start Deck /
        # Cheer cards keep their old card number but still belong to the new
        # booster. version looks like "[hBP04] Curious Universe".
        where_clause += """
            AND version LIKE ? ESCAPE '\\'
        """
        params.append(f"[{escape_like(booster)}]%")

    if variant == "multi":
        # Card numbers printed in more than one booster, so the grid can list
        # every printing of the same artwork number side by side.
        where_clause += """
            AND card_number IN (
                SELECT card_number
                FROM cards
                GROUP BY card_number
                HAVING COUNT(DISTINCT version) > 1
            )
        """

    try:
        page = int(request.args.get("page", "1"))
    except (TypeError, ValueError):
        page = 1

    page = max(page, 1)

    cur.execute(f"SELECT COUNT(*) AS total FROM cards {where_clause}", params)
    total = cur.fetchone()["total"]
    pages = (total + CARDS_PER_PAGE - 1) // CARDS_PER_PAGE

    if pages and page > pages:
        page = pages

    query = f"""
        SELECT {CARD_SELECT_COLUMNS}
        FROM cards
        {where_clause}
        ORDER BY version, card_index, card_number, rarity, id
        LIMIT ? OFFSET ?
    """

    offset = (page - 1) * CARDS_PER_PAGE
    cur.execute(query, [*params, CARDS_PER_PAGE, offset])

    rows = cur.fetchall()
    conn.close()

    return jsonify(
        {
            "items": [serialize_card(r) for r in rows],
            "total": total,
            "page": page,
            "per_page": CARDS_PER_PAGE,
            "pages": pages,
        }
    )


@app.route("/cards/variants")
def get_card_variants():
    """Return every printing of one card number, optionally one booster only."""
    number = request.args.get("number", "").strip()
    version = request.args.get("version", "").strip()

    if not number:
        return jsonify({"items": []})

    conn = get_connection()
    cur = conn.cursor()

    query = f"""
        SELECT {CARD_SELECT_COLUMNS}
        FROM cards
        WHERE card_number = ?
    """
    params = [number]

    if version:
        query += " AND version = ?"
        params.append(version)

    cur.execute(query, params)
    rows = cur.fetchall()
    conn.close()

    items = [serialize_card(row) for row in rows]
    items.sort(
        key=lambda item: (
            item["version"] or "",
            RARITY_RANK.get(item["rarity"], len(RARITY_RANK)),
            item["card_index"],
            item["id"],
        )
    )

    return jsonify({"items": items})


if __name__ == "__main__":
    app.run(debug=True)
