# Ignatiev Lounge Matrix

Static website for the Ignatiev Lounge tobacco shelf matrix: stock control, flavor catalog, low-stock tracking, and supplier order export.

## Local Run

```powershell
npm run build:data
npm start
```

The site runs at `http://localhost:4173`.

## Site Files

- `index.html` - application shell.
- `assets/styles.css` - modern lounge visual style.
- `assets/app.js` - tabs, shelf editing, catalog, order export, import/export settings.
- `data/shelf-data.json` - starter shelf and catalog data.

## GitHub Pages

Use GitHub Pages with source `main` and folder `/root`. The static site does not need a backend.