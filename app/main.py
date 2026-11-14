from flask import Flask, jsonify, render_template, request

from app.database import get_connection
from app.talents import get_japanese_aliases, translate_name

app = Flask(__name__)


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
