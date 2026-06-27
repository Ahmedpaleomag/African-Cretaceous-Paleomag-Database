# Egypt / Africa Cretaceous Paleomagnetic Pole Database

Static GitHub Pages prototype generated from `Africa_Cretaceous_Pmag_DB_pole_level.xlsx`.

## Scope

- Current scientific scope: **145–66 Ma** Cretaceous paleomagnetic pole-level data.
- Current geographic coverage: **Egypt first run**.
- Future direction: extend to a wider **Africa Cretaceous paleomagnetic database**.

## Current counts

- Uploaded pole entries: **22**
- Entries within 145–66 Ma: **20**
- Entries retained but outside stated scope: **2**
- References represented: **10**
- Nominal age range in raw upload: **18–142 Ma**

## Folder structure

```text
.
├── index.html
├── map.html
├── compilation.html
├── data_dictionary.html
├── revisions.html
├── assets/
│   ├── style.css
│   └── app.js
├── data/
│   ├── poles.csv
│   ├── poles.json
│   └── Africa_Cretaceous_Pmag_DB_pole_level.xlsx
├── pole_assessments/
│   ├── index.html
│   └── *.html
└── scripts/
    └── build_site.py
```

## Publish on GitHub Pages

1. Create a new repository, for example: `Africa_Cretaceous_Pmag_DB`.
2. Upload the **contents** of this folder to the repository root, not the ZIP file itself.
3. Go to **Settings → Pages**.
4. Under **Build and deployment**, choose **Deploy from a branch**.
5. Select branch **main** and folder **/(root)**.
6. The expected URL will be:

```text
https://ahmedpaleomag.github.io/Africa_Cretaceous_Pmag_DB/
```

## Update workflow

1. Update `data/poles.csv`.
2. Run:

```bash
python scripts/build_site.py
```

3. Commit and push the changed files.

## Notes

- Pole longitudes are preserved in the table as 0–360°.
- For map display only, pole longitudes are converted to −180–180°.
- Assessment pages are generated scaffolds; scientific review text should be added carefully from checked papers/supplements.
