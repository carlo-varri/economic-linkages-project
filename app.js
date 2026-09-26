import { economyGraph } from './data.js';

const state = {
  selected: { kind: 'node', id: economyGraph.rootId },
  expanded: new Set(),
  scale: 1,
  offsetX: 0,
  offsetY: 0,
  dragging: null
};

const app = {
  map: document.getElementById('map'),
  focusCard: document.getElementById('focus-card'),
  resetButton: document.getElementById('reset-view'),
  zoomIn: document.getElementById('zoom-in'),
  zoomOut: document.getElementById('zoom-out'),
  fit: document.getElementById('fit-view')
};

const nodeMap = new Map(economyGraph.nodes.map((node) => [node.id, node]));
const relationshipMap = new Map(economyGraph.relationships.map((edge) => [edge.id, edge]));
const layoutMap = new Map(Object.entries(economyGraph.layout).map(([id, position]) => [id, { ...position }]));
const svgNamespace = 'http://www.w3.org/2000/svg';
const canvas = document.createElementNS(svgNamespace, 'svg');
canvas.classList.add('map-canvas');
canvas.setAttribute('viewBox', '0 0 1200 820');
canvas.setAttribute('role', 'group');
canvas.setAttribute('aria-label', 'Interactive economic system map');
app.map.appendChild(canvas);

try {
  const savedLayout = JSON.parse(localStorage.getItem('economy-map-layout') || '{}');
  Object.entries(savedLayout).forEach(([id, position]) => {
    if (layoutMap.has(id) && Number.isFinite(position.x) && Number.isFinite(position.y)) {
      layoutMap.set(id, { x: position.x, y: position.y });
    }
  });
} catch {
}

function isVisible(record) {
  return !record.revealedBy || state.expanded.has(record.revealedBy);
}

function visibleNodes() {
  return economyGraph.nodes.filter(isVisible);
}

function visibleRelationships() {
  const visibleNodeIds = new Set(visibleNodes().map((node) => node.id));
  return economyGraph.relationships.filter((edge) =>
    isVisible(edge) && visibleNodeIds.has(edge.source) && visibleNodeIds.has(edge.target)
  );
}

function saveLayout() {
  try {
    localStorage.setItem('economy-map-layout', JSON.stringify(Object.fromEntries(layoutMap)));
  } catch {
  }
}

function selectedNodeId() {
  return state.selected.kind === 'node' ? state.selected.id : null;
}

function selectedRelationshipId() {
  return state.selected.kind === 'relationship' ? state.selected.id : null;
}

function dimensions(node) {
  return {
    width: Math.max(112, Math.min(220, node.label.length * 8 + 34)),
    height: node.category === 'system' ? 58 : 48
  };
}

function svgElement(name, attributes = {}) {
  const element = document.createElementNS(svgNamespace, name);
  Object.entries(attributes).forEach(([key, value]) => element.setAttribute(key, value));
  return element;
}

function edgePath(edge) {
  const source = layoutMap.get(edge.source);
  const target = layoutMap.get(edge.target);
  const sourceSize = dimensions(nodeMap.get(edge.source));
  const targetSize = dimensions(nodeMap.get(edge.target));
  const deltaX = target.x - source.x;
  const deltaY = target.y - source.y;
  const distance = Math.hypot(deltaX, deltaY) || 1;
  const unitX = deltaX / distance;
  const unitY = deltaY / distance;
  const sourceX = Math.abs(unitX) < 0.001 ? Infinity : sourceSize.width / 2 / Math.abs(unitX);
  const sourceY = Math.abs(unitY) < 0.001 ? Infinity : sourceSize.height / 2 / Math.abs(unitY);
  const targetX = Math.abs(unitX) < 0.001 ? Infinity : targetSize.width / 2 / Math.abs(unitX);
  const targetY = Math.abs(unitY) < 0.001 ? Infinity : targetSize.height / 2 / Math.abs(unitY);
  const startOffset = Math.min(sourceX, sourceY);
  const endOffset = Math.min(targetX, targetY);
  const startX = source.x + unitX * startOffset;
  const startY = source.y + unitY * startOffset;
  const endX = target.x - unitX * endOffset;
  const endY = target.y - unitY * endOffset;
  return `M ${startX} ${startY} L ${endX} ${endY}`;
}

function buildDefinitions() {
  const defs = svgElement('defs');
  const marker = svgElement('marker', {
    id: 'arrowhead', markerWidth: 10, markerHeight: 10, refX: 8, refY: 5,
    orient: 'auto', markerUnits: 'strokeWidth'
  });
  marker.appendChild(svgElement('path', { d: 'M 0 0 L 10 5 L 0 10 z', class: 'arrowhead' }));
  defs.appendChild(marker);

  const startMarker = svgElement('marker', {
    id: 'arrowhead-start', markerWidth: 10, markerHeight: 10, refX: 2, refY: 5,
    orient: 'auto-start-reverse', markerUnits: 'strokeWidth'
  });
  startMarker.appendChild(svgElement('path', { d: 'M 0 0 L 10 5 L 0 10 z', class: 'arrowhead' }));
  defs.appendChild(startMarker);
  return defs;
}

function renderEdges(layer) {
  const activeNodeId = selectedNodeId();
  const activeRelationshipId = selectedRelationshipId();

  visibleRelationships().forEach((edge) => {
    const source = nodeMap.get(edge.source);
    const target = nodeMap.get(edge.target);
    const selected = edge.id === activeRelationshipId;
    const connected = selected || edge.source === activeNodeId || edge.target === activeNodeId;
    const sourcePosition = layoutMap.get(edge.source);
    const targetPosition = layoutMap.get(edge.target);
    const midpointX = (sourcePosition.x + targetPosition.x) / 2;
    const midpointY = (sourcePosition.y + targetPosition.y) / 2;
    const group = svgElement('g', {
      class: `relationship ${selected ? 'is-selected' : ''} ${connected ? 'is-connected' : ''} ${edge.direction === 'feedback' ? 'is-feedback' : ''}`,
      tabindex: '0',
      role: 'button',
      'aria-label': `${source.label} to ${target.label}: ${edge.name}`,
      'data-id': edge.id
    });
    const pathData = edgePath(edge);
    const hit = svgElement('path', { d: pathData, class: 'relationship-hit' });
    const line = svgElement('path', { d: pathData, class: 'relationship-line', 'marker-end': 'url(#arrowhead)' });
    if (edge.direction === 'two-way' || edge.direction === 'feedback') {
      line.setAttribute('marker-start', 'url(#arrowhead-start)');
    }

    const label = svgElement('g', {
      class: 'relationship-label',
      transform: `translate(${midpointX} ${midpointY})`
    });
    const text = svgElement('text', { 'text-anchor': 'middle', y: '-5' });
    text.textContent = edge.name;
    const background = svgElement('rect', { class: 'label-backplate', rx: 7, y: '-24' });
    label.append(background, text);
    group.append(hit, line, label);
    group.addEventListener('click', (event) => {
      event.stopPropagation();
      state.selected = { kind: 'relationship', id: edge.id };
      render();
    });
    group.addEventListener('keydown', (event) => {
      if (event.key === 'Enter' || event.key === ' ') {
        event.preventDefault();
        state.selected = { kind: 'relationship', id: edge.id };
        render();
      }
    });
    layer.appendChild(group);
    requestAnimationFrame(() => {
      const bounds = text.getBBox();
      background.setAttribute('x', String(-bounds.width / 2 - 10));
      background.setAttribute('width', String(bounds.width + 20));
    });
  });
}

function renderNodes(layer) {
  const activeNodeId = selectedNodeId();
  const activeEdge = relationshipMap.get(selectedRelationshipId());

  visibleNodes().forEach((node) => {
    const { width, height } = dimensions(node);
    const isEndpoint = activeEdge && (activeEdge.source === node.id || activeEdge.target === node.id);
    const group = svgElement('g', {
      class: `map-node node-${node.category} ${node.id === activeNodeId ? 'is-selected' : ''} ${isEndpoint ? 'is-endpoint' : ''}`,
      transform: `translate(${layoutMap.get(node.id).x} ${layoutMap.get(node.id).y})`,
      tabindex: '0',
      role: 'button',
      'aria-label': `${node.label}, ${node.category}`,
      'data-id': node.id
    });
    group.appendChild(svgElement('rect', {
      x: String(-width / 2), y: String(-height / 2), width: String(width), height: String(height),
      rx: node.category === 'system' ? '16' : '12'
    }));
    const text = svgElement('text', { 'text-anchor': 'middle', dy: '0.35em' });
    text.textContent = node.label;
    group.appendChild(text);
    group.addEventListener('pointerdown', (event) => {
      event.preventDefault();
      event.stopPropagation();
      state.selected = { kind: 'node', id: node.id };
      state.dragging = { kind: 'node', nodeId: node.id, x: event.clientX, y: event.clientY };
      canvas.classList.add('is-dragging');
      render();
      canvas.setPointerCapture(event.pointerId);
    });
    group.addEventListener('click', (event) => {
      event.stopPropagation();
      state.selected = { kind: 'node', id: node.id };
      render();
    });
    group.addEventListener('keydown', (event) => {
      if (event.key === 'Enter' || event.key === ' ') {
        event.preventDefault();
        state.selected = { kind: 'node', id: node.id };
        render();
      }
    });
    layer.appendChild(group);
  });
}

function renderCanvas() {
  canvas.replaceChildren(buildDefinitions());
  const world = svgElement('g', {
    class: 'map-world',
    transform: `translate(${state.offsetX} ${state.offsetY}) scale(${state.scale})`
  });
  const edges = svgElement('g', { class: 'relationship-layer' });
  const nodes = svgElement('g', { class: 'node-layer' });
  renderEdges(edges);
  renderNodes(nodes);
  world.append(edges, nodes);
  canvas.appendChild(world);
}

function toggleExpansion(records) {
  records.forEach((key) => {
    if (state.expanded.has(key)) state.expanded.delete(key);
    else state.expanded.add(key);
  });
  render();
}

function renderNodeDetails(node) {
  const expandable = node.expands?.some((key) => !state.expanded.has(key));
  const collapsible = node.expands?.some((key) => state.expanded.has(key));
  const linkedCount = economyGraph.relationships.filter((edge) => edge.source === node.id || edge.target === node.id).length;
  app.focusCard.innerHTML = `
    <p class="detail-kicker">${node.category} <span>·</span> node</p>
    <h2>${node.label}</h2>
    <p class="detail-summary">${node.summary}</p>
    <div class="detail-meta"><span>${linkedCount} linked mechanisms</span></div>
    ${expandable || collapsible ? `<button class="expand-button" type="button" data-action="toggle-node">${expandable ? 'Expand mechanisms' : 'Collapse expansion'}</button>` : ''}
  `;
  app.focusCard.querySelector('[data-action="toggle-node"]')?.addEventListener('click', () => {
    toggleExpansion(node.expands);
  });
}

function renderRelationshipDetails(edge) {
  const source = nodeMap.get(edge.source);
  const target = nodeMap.get(edge.target);
  const expandable = edge.expands?.some((key) => !state.expanded.has(key));
  const collapsible = edge.expands?.some((key) => state.expanded.has(key));
  const arrow = edge.direction === 'two-way' ? '↔' : edge.direction === 'feedback' ? '↺' : '→';
  app.focusCard.innerHTML = `
    <p class="detail-kicker">${edge.category} <span>·</span> relationship</p>
    <h2>${edge.name}</h2>
    <div class="edge-route"><span>${source.label}</span><b aria-hidden="true">${arrow}</b><span>${target.label}</span></div>
    <p class="detail-summary">${edge.description}</p>
    <div class="detail-meta"><span>Direction: ${edge.direction}</span></div>
    ${expandable || collapsible ? `<button class="expand-button" type="button" data-action="toggle-edge">${expandable ? 'Expand mechanism' : 'Collapse expansion'}</button>` : ''}
  `;
  app.focusCard.querySelector('[data-action="toggle-edge"]')?.addEventListener('click', () => {
    toggleExpansion(edge.expands);
  });
}

function render() {
  renderCanvas();
  if (state.selected.kind === 'relationship') {
    renderRelationshipDetails(relationshipMap.get(state.selected.id));
  } else {
    renderNodeDetails(nodeMap.get(state.selected.id));
  }
}

function zoomAt(clientX, clientY, factor) {
  const bounds = canvas.getBoundingClientRect();
  const cursorX = ((clientX - bounds.left) / bounds.width) * 1200;
  const cursorY = ((clientY - bounds.top) / bounds.height) * 820;
  const nextScale = Math.min(2.4, Math.max(0.55, state.scale * factor));
  const worldX = (cursorX - state.offsetX) / state.scale;
  const worldY = (cursorY - state.offsetY) / state.scale;
  state.scale = nextScale;
  state.offsetX = cursorX - worldX * nextScale;
  state.offsetY = cursorY - worldY * nextScale;
  render();
}

canvas.addEventListener('pointerdown', (event) => {
  if (event.target.closest('.map-node, .relationship')) return;
  state.dragging = { kind: 'pan', x: event.clientX, y: event.clientY };
  canvas.classList.add('is-panning');
  canvas.setPointerCapture(event.pointerId);
});

canvas.addEventListener('pointermove', (event) => {
  if (!state.dragging) return;
  const bounds = canvas.getBoundingClientRect();
  if (state.dragging.kind === 'node') {
    const position = layoutMap.get(state.dragging.nodeId);
    position.x += ((event.clientX - state.dragging.x) / bounds.width) * 1200 / state.scale;
    position.y += ((event.clientY - state.dragging.y) / bounds.height) * 820 / state.scale;
    state.dragging.x = event.clientX;
    state.dragging.y = event.clientY;
    renderCanvas();
    return;
  }
  state.offsetX += ((event.clientX - state.dragging.x) / bounds.width) * 1200;
  state.offsetY += ((event.clientY - state.dragging.y) / bounds.height) * 820;
  state.dragging = { x: event.clientX, y: event.clientY };
  canvas.querySelector('.map-world')?.setAttribute('transform', `translate(${state.offsetX} ${state.offsetY}) scale(${state.scale})`);
});

function endPointer() {
  if (!state.dragging) return;
  if (state.dragging?.kind === 'node') {
    saveLayout();
  }
  state.dragging = null;
  canvas.classList.remove('is-panning', 'is-dragging');
  render();
}

canvas.addEventListener('pointerup', endPointer);
canvas.addEventListener('pointercancel', endPointer);
canvas.addEventListener('wheel', (event) => {
  event.preventDefault();
  zoomAt(event.clientX, event.clientY, event.deltaY < 0 ? 1.12 : 0.89);
}, { passive: false });

app.zoomIn.addEventListener('click', () => {
  const bounds = canvas.getBoundingClientRect();
  zoomAt(bounds.left + bounds.width / 2, bounds.top + bounds.height / 2, 1.2);
});
app.zoomOut.addEventListener('click', () => {
  const bounds = canvas.getBoundingClientRect();
  zoomAt(bounds.left + bounds.width / 2, bounds.top + bounds.height / 2, 0.84);
});
function fitGraph() {
  const nodes = visibleNodes();
  const bounds = nodes.reduce((result, node) => {
    const position = layoutMap.get(node.id);
    const size = dimensions(node);
    result.left = Math.min(result.left, position.x - size.width / 2);
    result.right = Math.max(result.right, position.x + size.width / 2);
    result.top = Math.min(result.top, position.y - size.height / 2);
    result.bottom = Math.max(result.bottom, position.y + size.height / 2);
    return result;
  }, { left: Infinity, right: -Infinity, top: Infinity, bottom: -Infinity });
  const scaleX = 1040 / (bounds.right - bounds.left + 120);
  const scaleY = 680 / (bounds.bottom - bounds.top + 120);
  state.scale = Math.min(2.6, Math.max(0.55, Math.min(scaleX, scaleY)));
  state.offsetX = 600 - ((bounds.left + bounds.right) / 2) * state.scale;
  state.offsetY = 410 - ((bounds.top + bounds.bottom) / 2) * state.scale;
  renderCanvas();
}
app.fit.addEventListener('click', fitGraph);

function resetMapView() {
  const width = canvas.getBoundingClientRect().width || app.map.clientWidth;
  state.scale = Math.min(2.6, Math.max(1, 900 / width));
  const focalX = width < 560 ? 450 : 600;
  state.offsetX = 600 - focalX * state.scale;
  state.offsetY = state.scale > 1 ? 410 - 140 * state.scale : 0;
}

app.resetButton.addEventListener('click', () => {
  state.selected = { kind: 'node', id: economyGraph.rootId };
  state.expanded.clear();
  resetMapView();
  render();
});

resetMapView();
render();