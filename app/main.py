from flask import Flask, jsonify, render_template, request
from app.database import get_connection

app = Flask(__name__)


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
            query += """
                AND (
                    name_en LIKE ?
                    OR card_number LIKE ?
                )
            """
            params.extend(
                [
                    f"%{keyword}%",
                    f"%{keyword}%",
                ]
            )

    if booster:
        query += """
            AND card_number LIKE ?
        """
        params.append(f"{booster}-%")

    query += """
        ORDER BY version, card_index, card_number
    """

    cur.execute(query, params)

    rows = cur.fetchall()
    conn.close()

    return jsonify(
        [
            {
                "name": r["name_en"],
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
