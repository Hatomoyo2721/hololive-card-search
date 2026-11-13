# Hololive TCG Card Search

<div style="display: flex; align-items: center; gap: 10px;">
  <img src="https://img.shields.io/badge/Python-3.13+-blue?style=for-the-badge" alt="Python">
  <img src="https://img.shields.io/badge/Flask-Enabled-lightgrey?style=for-the-badge" alt="Flask">
  <img src="https://img.shields.io/badge/SQLite-Database-blue?style=for-the-badge" alt="SQLite">
</div>

<br>

A simple personal hobby project for browsing and searching cards from the **_hololive OFFICIAL CARD GAME_**

This is **_not an official product_**, made purely for personal interest

<br>

<h1>Features</h1>

- Browse cards in a grid layout
- Search by talent name (English, Romaji, or Japanese)
- Search by card number (e.g. `hBP04-066`)
- Filter cards by booster pack
- Filter cards by rarity
- Lightweight and responsive interface
- Local SQLite database

<br>

<h1>Prerequisites</h1>

- **Python** 3.13+ (recommend)
- **pip**
- **Backend**: Python, Flask
- **Database**: SQLite
- **Frontend**: HTML, CSS, Vanilla JavaScript (ES modules)

<br>

> [!IMPORTANT]
> **Python 3.13 is recommended**
>
> - Python **3.10 – 3.12** may work, but is **not fully tested**
> - Python **3.14+ is currently not supported** due to dependency compatibility

<br>

<h1>How to run</h1>

**1. Install dependencies**

```bash
pip install -r requirements.txt
```

**2. Run the application**

```bash
python -m app.main
```

**3. Open in browser**
```bash
http://127.0.0.1:5000
```

<br>

> [!NOTE]
> FastAPI and Uvicorn are included in `requirements.txt` for future experiments
> 
> The current application runs on **Flask**
> 
> Card data and images are maintained locally

---

This project will be expanded in the future... (if not lazy :D)

Depends on motivation, free time, and kofi ☕...
