from pathlib import Path

from flask import Flask, jsonify, render_template, request, send_from_directory

from app.database import get_connection
from app.talents import get_japanese_aliases, translate_name

app = Flask(__name__)

# Card art never changes once scraped, so let the browser keep it. Without this
# Flask sends "no-cache" and every visible card triggers a revalidation round
# trip on each page load. Scoped to /static/assets so edits to JS/CSS still show
# up on a normal reload.
CARD_ART_MAX_AGE = 60 * 60 * 24 * 30  # 30 days


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


@app.route("/")
def home():
    return render_template("search.html")


@app.route("/cards")
def get_cards():
    keyword = request.args.get("q", "").strip()
    booster = request.args.get("booster", "").strip()

    conn = get_connection()
    cur = conn.cursor()

    query = """
        SELECT name_en, card_number, card_index, version, rarity
        FROM cards
        WHERE 1=1
    """
    params = []

    if keyword:
        if keyword.lower().startswith("rarity="):
            rarity_keyword = keyword.split("=", 1)[1].strip().upper()

            if rarity_keyword:
                query += """
                    AND UPPER(TRIM(rarity)) = ?
                """
                params.append(rarity_keyword)
            else:
                query += """
                    AND 1 = 0
                """
        else:
            pattern = f"%{escape_like(keyword)}%"

            query += """
                AND (
                    name_en LIKE ? ESCAPE '\\'
                    OR original_title LIKE ? ESCAPE '\\'
                    OR card_number LIKE ? ESCAPE '\\'
            """
            params.extend([pattern, pattern, pattern])

            # Also match the Japanese talent name behind a romaji search.
            for japanese_name in get_japanese_aliases(keyword):
                query += """
                    OR name_en LIKE ? ESCAPE '\\'
                    OR original_title LIKE ? ESCAPE '\\'
                """
                params.extend(
                    [
                        f"%{escape_like(japanese_name)}%",
                        f"%{escape_like(japanese_name)}%",
                    ]
                )

            query += ")"

    if booster:
        # Filter by `version` instead of card number: reprint / Start Deck /
        # Cheer cards keep their old card number but still belong to the new
        # booster. version looks like "[hBP04] Curious Universe".
        query += """
            AND version LIKE ? ESCAPE '\\'
        """
        params.append(f"[{escape_like(booster)}]%")

    query += """
        ORDER BY version, card_index, card_number, rarity
    """

    cur.execute(query, params)

    rows = cur.fetchall()
    conn.close()

    return jsonify(
        [
            {
                "name": translate_name(r["name_en"]),
                "original_name": r["name_en"],
                "card_number": r["card_number"],
                "card_index": r["card_index"],
                "version": r["version"],
                "rarity": r["rarity"],
            }
            for r in rows
        ]
    )


if __name__ == "__main__":
    app.run(debug=True)
