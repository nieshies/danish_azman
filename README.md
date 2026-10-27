# Muhammad Danish bin Mohd Azman — portfolio

A single-page portfolio: editorial layout, numbered sections, and a draggable
3D student-ID lanyard in the hero.

Plain HTML + CSS + vanilla ES modules. **No build step, no dependencies to
install.** Three.js loads from a CDN via the import map in `index.html`.

## Files

| File | What it is |
|------|------------|
| `index.html` | Every section: 00 Introduction → 06 Contact |
| `styles.css` | All styles. Breakpoints at 1080px and 760px live at the bottom |
| `main.js` | Mobile menu, scroll reveals, active nav link, nav inversion over the dark footer |
| `lanyard.js` | The hero lanyard — verlet rope, ribbon mesh, card, canvas-drawn card face |
| `images/gallery/` | Gallery photos (`1.jpg` … `9.jpg`) |
| `resume.pdf` | Linked from the Contact section |

## The lanyard

`lanyard.js` simulates a rope as 18 points with distance constraints solved 26
times per step (3 steps a frame), renders it as a flat ribbon, and hangs a rigid
card off the end. Drag the card and the rope follows; let go and it swings.
Sideways motion spins the card on its Y axis and it settles facing front again.
Tunables are the consts at the top of the file.

The card face is drawn to a `<canvas>` in `makeCardTexture()` — edit the text
there. Drop a headshot at **`images/card-photo.jpg`** and it replaces the "MD"
placeholder automatically.

## Swapping content

- **Gallery** — replace `images/gallery/1-9.jpg`, same names.
- **Projects / Skills / Journey** — plain markup in `index.html`.
- **Colours** — the tokens on `:root` in `styles.css`.

## Run it

```
python3 -m http.server 8000
```

## Deploy

Static, so any host works with no build settings:

```
vercel --prod --yes --cwd . --scope <your-scope>
```
