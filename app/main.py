from flask import Flask, jsonify, render_template, request
from app.database import get_connection
import re

# Japanese name: English / Romaji name
TALENT_ALIASES = {
    # hololive Gen 0
    "ときのそら": "Tokino Sora",
    "ロボ子さん": "Robocosan",
    "AZKi": "AZKi",
    "さくらみこ": "Sakura Miko",
    "星街すいせい": "Hoshimachi Suisei",
    # hololive Gen 1
    "アキ・ローゼンタール": "Aki Rosenthal",
    "赤井はあと": "Akai Haato",
    "白上フブキ": "Shirakami Fubuki",
    "夏色まつり": "Natsuiro Matsuri",
    # hololive Gen 2
    "百鬼あやめ": "Nakiri Ayame",
    "癒月ちょこ": "Yuzuki Choco",
    "大空スバル": "Oozora Subaru",
    "湊あくあ": "Minato Aqua",
    "紫咲シオン": "Murasaki Shion",
    # hololive GAMERS
    "大神ミオ": "Ookami Mio",
    "猫又おかゆ": "Nekomata Okayu",
    "戌神ころね": "Inugami Korone",
    # hololive Gen 3
    "兎田ぺこら": "Usada Pekora",
    "不知火フレア": "Shiranui Flare",
    "白銀ノエル": "Shirogane Noel",
    "宝鐘マリン": "Houshou Marine",
    # hololive Gen 4
    "角巻わため": "Tsunomaki Watame",
    "常闇トワ": "Tokoyami Towa",
    "姫森ルーナ": "Himemori Luna",
    "天音かなた": "Amane Kanata",
    "桐生ココ": "Kiryu Coco",
    # hololive Gen 5
    "雪花ラミィ": "Yukihana Lamy",
    "桃鈴ねね": "Momosuzu Nene",
    "獅白ぼたん": "Shishiro Botan",
    "尾丸ポルカ": "Omaru Polka",
    # holoX
    "ラプラス・ダークネス": "La+ Darknesss",
    "鷹嶺ルイ": "Takane Lui",
    "博衣こより": "Hakui Koyori",
    "沙花叉クロヱ": "Sakamata Chloe",
    "風真いろは": "Kazama Iroha",
    # hololive Indonesia
    "アユンダ・リス": "Ayunda Risu",
    "ムーナ・ホシノヴァ": "Moona Hoshinova",
    "アイラニ・イオフィフティーン": "Airani Iofifteen",
    "クレイジー・オリー": "Kureiji Ollie",
    "アーニャ・メルフィッサ": "Anya Melfissa",
    "パヴォリア・レイネ": "Pavolia Reine",
    "ベスティア・ゼータ": "Vestia Zeta",
    "カエラ・コヴァルスキア": "Kaela Kovalskia",
    "こぼ・かなえる": "Kobo Kanaeru",
    # hololive English
    "森カリオペ": "Mori Calliope",
    "小鳥遊キアラ": "Takanashi Kiara",
    "一伊那尓栖": "Ninomae Ina'nis",
    "ワトソン・アメリア": "Watson Amelia",
    "がうる・ぐら": "Gawr Gura",
    "九十九佐命": "Tsukumo Sana",
    "オーロ・クロニー": "Ouro Kronii",
    "セレス・ファウナ": "Ceres Fauna",
    "七詩ムメイ": "Nanashi Mumei",
    "ハコス・ベールズ": "Hakos Baelz",
    "IRyS": "IRyS",
    "シオリ・ノヴェラ": "Shiori Novella",
    "古石ビジュー": "Koseki Bijou",
    "ネリッサ・レイヴンクロフト": "Nerissa Ravencroft",
    "フワワ・アビスガード": "Fuwawa Abyssgard",
    "モココ・アビスガード": "Mococo Abyssgard",
    "エリザベス・ローズ・ブラッドフレイム": "Elizabeth Rose Bloodflame",
    "ジジ・ムリン": "Gigi Murin",
    "セシリア・イマーグリーン": "Cecilia Immergreen",
    "ラオーラ・パンテーラ": "Raora Panthera",
    # ReGLOSS
    "音乃瀬奏": "Otonose Kanade",
    "一条莉々華": "Ichijou Ririka",
    "儒烏風亭らでん": "Juufuutei Raden",
    "轟はじめ": "Todoroki Hajime",
    "火威青": "Hiodoshi Ao",
    # FLOW GLOW
    "響咲リオナ": "Isaki Riona",
    "虎金妃笑虎": "Koganei Niko",
    "水宮枢": "Mizumiya Su",
    "輪堂千速": "Rindo Chihaya",
    "綺々羅々ヴィヴィ": "Kikirara Vivi",
    # ASOBI★MAWARI-TAI!
    "熱千めら": "Achichi Mela",
    "宙科そぴあ": "Sorashina Sopia",
    "鈴鳴つづり": "Suzuna Tsuzuri",
    "百灯キョーコ": "Hyakuto Kyoko",
    # holoAN
    "井月みちる": "Izuki Michiru",
    "花園さやか": "Hanazono Sayaka",
    "風白ゆき": "Kazeshiro Yuki",
}

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
            japanese_names = get_japanese_aliases(keyword)

            query += """
                AND (
                    name_en LIKE ?
                    OR card_number LIKE ?
            """

            params.extend(
                [
                    f"%{keyword}%",
                    f"%{keyword}%",
                ]
            )

            # Bổ sung tìm kiếm tên tiếng Nhật
            for japanese_name in japanese_names:
                query += " OR name_en LIKE ?"
                params.append(f"%{japanese_name}%")

            query += ")"

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


def normalize_alias(value):
    return re.sub(r"[^a-z0-9]+", " ", value.casefold()).strip()


ALIAS_LOOKUP = {}

for japanese_name, english_name in TALENT_ALIASES.items():
    aliases = [english_name]
    aliases.extend(english_name.split())

    for alias in aliases:
        key = normalize_alias(alias)

        ALIAS_LOOKUP.setdefault(key, set()).add(japanese_name)


def get_japanese_aliases(keyword):
    normalized = normalize_alias(keyword)

    if not normalized:
        return []

    matched_names = set()

    for alias, japanese_names in ALIAS_LOOKUP.items():
        if normalized in alias:
            matched_names.update(japanese_names)

    return sorted(matched_names)


if __name__ == "__main__":
    app.run(debug=True)
