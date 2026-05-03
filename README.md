# Ignatiev Lounge Orders

Static web app for weekly hookah tobacco shelf checks and supplier order preparation.

## What it does

- Keeps shelf matrix items in the browser.
- Lets staff mark current stock, minimum stock, target stock and manual order quantities.
- Imports supplier price lists from CSV.
- Exports order CSV files by supplier.
- Works as a plain static site: `index.html`, `styles.css`, `app.js`.

## Local Use

Open `index.html` in a browser. Data changes are saved in browser `localStorage`.

For team access, enable GitHub Pages for this repository:

1. Repository Settings.
2. Pages.
3. Source: `Deploy from a branch`.
4. Branch: `main`, folder `/root`.
5. Save.

## CSV Price Format

Supported headers:

- `Артикул` or `Код`
- `Наименование`, `Номенклатура`, `Позиция`, or `Товар`
- `Крупный опт`, `Опт`, or `Цена`
- `Мелкий опт` or `Розн`

Separators: semicolon, comma, or tab.
