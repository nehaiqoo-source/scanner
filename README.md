# ScanDesk

A private, browser-based document scanner for capturing pages, cleaning scans, and exporting polished documents.

## Features

- Add pages from image upload or camera capture
- Multi-page document preview
- Brightness, contrast, sharpness, grayscale, and black/white adjustments
- Rotate and crop scanned pages
- Optional per-page text notes and browser OCR support where available
- Export as PDF, DOCX, DOC, HTML, TXT, and JSON
- Client-side processing so document images stay in the browser

## Run Locally

```bash
npm run dev
```

Then open:

```text
http://127.0.0.1:4173
```

Camera access works best from `localhost` or `127.0.0.1`, not directly from a `file://` URL.

## Project Files

```text
index.html             App structure
styles.css             Adobe Scan-inspired interface styling
app.js                 Scanner, image editing, and export logic
scripts/dev-server.js  Lightweight local static server
package.json           Local run and build scripts
vercel.json            Static Vercel deployment config
```

## Notes

PDF import is not implemented yet. Add image pages or camera captures, then export them to PDF or Word-compatible formats.
