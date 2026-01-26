<h1>Hololive TCG Card Search</h1>

<div style="display: flex; align-items: center; gap: 10px;">
  <img src="https://img.shields.io/badge/Python-3.13+-blue?style=for-the-badge" alt="Python">
  <img src="https://img.shields.io/badge/Flask-Enabled-lightgrey?style=for-the-badge" alt="Flask">
</div>

<br>

A simple personal hobby project for browsing and searching cards from the **_hololive OFFICIAL CARD GAME_**

This is **_not an official product_**, made purely for personal interest

<br>

<h1>Features</h1>

- Display all available cards in a grid
- Search cards by: - Oshi's name (e.g. Koseki Bijou)
- Card code (e.g. hBP04-066) - Lightweight UI for quick browsing
- Uses a local SQLite database

<br>

<h1>Prerequisites</h1>

- **Python** 3.13+
- **Backend**: Flask
- **Database**: SQLite
- **Frontend**: HTML, CSS, Vanilla JavaScript (ES modules)

<br>

> [!NOTE]
> Note: FastAPI and uvicorn are included in requirements.txt for future experiments
> The current app runs with **Flask only**

<br>

<h1>How to run</h1>

- Install dependencies

```bash
pip install -r requirements.txt
```

- Run the app

```bash
python -m app.main
```

- Open in browser
```bash
http://127.0.0.1:5000
```

<br>

> This project will be expanded in the future... maybe :D
>
> Depends on motivation, free time, and coffee ☕...