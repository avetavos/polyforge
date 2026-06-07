# Contributing to the docs

These docs are built with [Material for MkDocs](https://squidfunk.github.io/mkdocs-material/) and live in `docs/` at the repo root.

## Local preview

```bash
pip install -r requirements-docs.txt
mkdocs serve          # live-reload at http://127.0.0.1:8000
```

## Build / validate

```bash
mkdocs build --strict   # fails on broken links / warnings
```

CI runs the same `--strict` build before deploying.

## Authoring conventions

- One page per major topic; keep navigation in `mkdocs.yml` in sync with files under `docs/`.
- Use **Mermaid** fenced blocks for diagrams:

  ````markdown
  ```mermaid
  flowchart LR
      a --> b
  ```
  ````

- Use admonitions for callouts:

  ```markdown
  !!! note "Title"
      Body text.
  ```

- Prefer linking between pages with relative paths (e.g. `../database/index.md`).
- Keep docs **truthful to the code** — if you spot drift (like the recommendation-service language in the repo `README`), fix the docs and, ideally, the source.

## Deployment

Pushing to `main` triggers `.github/workflows/docs.yml`, which builds and publishes to GitHub Pages via `mkdocs gh-deploy` (the `gh-pages` branch).

!!! note "One-time setup"
    In the GitHub repo settings, set **Pages → Source** to the `gh-pages` branch (root). After the first successful workflow run, the site is served at `https://avetavos.github.io/polyforge/`.
