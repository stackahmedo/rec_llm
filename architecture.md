# Architecture

## Stack

- **React 18** + **TypeScript** + **Vite 6**
- **Tailwind CSS v4** for styling
- **shadcn/ui** (Radix primitives) for the design system
- **recharts** for bar/line charts; custom SVG for donuts
- **sonner** for toasts
- **lucide-react** for icons

## Layout

```
src/app/
├── App.tsx                 # Shell + view router
├── components/
│   ├── sidebar-nav.tsx     # Left nav
│   ├── stat-card.tsx       # Dashboard KPIs
│   ├── upload-panel.tsx    # Drag/drop ingest
│   ├── transcript-viewer.tsx
│   ├── speaker-panel.tsx
│   ├── analytics-panel.tsx
│   ├── summary-card.tsx
│   ├── pdf-editor.tsx
│   ├── file-library.tsx
│   ├── settings-panel.tsx
│   ├── role-engines.tsx    # Per-role engine assignment
│   └── ui/                 # shadcn primitives
└── styles/
    ├── theme.css           # Design tokens
    └── fonts.css
```

## State

Local component state via `useState`. The app is intentionally store-free — each view owns its data so it can be ported into a larger host without untangling a global store.

## Pipeline (logical, not yet wired)

```
Audio file
  │
  ▼
[Ingest] → [Preprocess] → [Diarize] → [Transcribe]
                                       │
                                       ▼
                              [Classify (6 attrs)]
                                       │
                                       ▼
                              [Summarize (30 items)]
                                       │
                                       ▼
                              File Library + PDF export
```

Each pipeline stage maps to a **role** in `role-engines.tsx`. Swapping an engine swaps the implementation for that role only.

## Why no global store?

The UI is built so each view is independently shippable into other apps (the PDF editor or the file library can be lifted out wholesale). A central store would force a coupling that the product doesn't need yet.
