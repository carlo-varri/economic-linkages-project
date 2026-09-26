# Economics System Map

An interactive visual map for exploring how agents, institutions, markets, variables, and economic mechanisms connect. The map is the main interface; descriptions provide context for a selected node or relationship rather than acting as standalone lessons.

## Objectives

- Represent the economy as a network, not a hierarchy.
- Make relationships and their mechanisms selectable objects.
- Reveal deeper causal chains and feedback loops on demand.
- Keep economics content separate from spatial layout and rendering.
- Provide a small prototype that can grow into a much larger knowledge map.

## Current Prototype

- Select a node to inspect it; select a relationship line or label to inspect its mechanism.
- Expand a node or relationship to reveal its deeper network layer.
- Pan by dragging empty canvas, zoom with the mouse wheel or `+` / `-`, and use **Fit** to frame visible nodes.
- Drag nodes to arrange the map. Custom positions are saved in browser local storage.
- Node colors distinguish systems, agents, institutions, markets, variables, outcomes, and mechanisms. Dashed links indicate feedback relationships.

The example data includes household-bank lending and deposits, central-bank policy-rate setting, household interest-rate channels, and a household income-to-spending-to-employment feedback loop.

## Data Model

The graph data in `data.js` has three distinct parts:

- `nodes`: economic entities or concepts, identified by stable IDs.
- `relationships`: directed, named mechanisms between source and target nodes, with a category, direction, explanation, and optional expansion.
- `layout`: presentation-only node coordinates, kept separate from economics content.

Expansion is modeled as additional nodes and relationships marked with `revealedBy`. Nodes and relationships reference the expansion key that reveals those records. This keeps the graph network-shaped and supports cross-links and loops without requiring parent-child ownership.

## Project Files

| File | Purpose |
| --- | --- |
| `index.html` | Page shell, map controls, and mechanism inspector. |
| `app.js` | SVG graph rendering, selection, expansion, pan/zoom, node dragging, and local layout persistence. |
| `data.js` | Economics nodes, first-class relationships, and the initial visual layout. |
| `styles.css` | Canvas, node categories, relationship states, inspector, and responsive styling. |
| `package.json` | Project metadata and convenience scripts for serving the static app. |
| `hello.txt` | Existing project file; not used by the application. |

## Run Locally

From the project directory, start the static server with Python:

```sh
python3 -m http.server 8000
```

Then open <http://localhost:8000> in a browser. No package installation or build step is required for the current prototype.

If Node.js and npm are installed, the package script is also available:

```sh
npm run dev
```

That script serves the same static files on port `4173`.

## Current Scope

This is a small front-end prototype with a manually authored starting layout. It has no backend, multi-user storage, automatic graph layout, or full economics knowledge base yet. The separate graph and layout data are intended to make those later changes possible without tying economic content to one visual design.