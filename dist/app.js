import * as THREE from 'three';
import {OrbitControls} from 'three/addons/controls/OrbitControls.js';
import {moduleCatalog, traceStateAt} from './pyright/trace-model.mjs';
import {scenarios} from './pyright/overload-scenarios.mjs';

const $ = (selector) => document.querySelector(selector);
const canvas = $('#scene');
const scenePanel = canvas.parentElement;

const renderer = new THREE.WebGLRenderer({canvas, antialias: true, alpha: true});
renderer.setPixelRatio(Math.min(devicePixelRatio, 1.75));
renderer.outputColorSpace = THREE.SRGBColorSpace;

const scene = new THREE.Scene();
scene.fog = new THREE.FogExp2(0x07111c, 0.025);

const camera = new THREE.PerspectiveCamera(45, 1, 0.1, 100);
camera.position.set(0, 8.5, 18);

const controls = new OrbitControls(camera, canvas);
controls.enableDamping = true;
controls.target.set(0, 0, 0);
controls.minDistance = 8;
controls.maxDistance = 32;
controls.maxPolarAngle = Math.PI * 0.82;

scene.add(new THREE.HemisphereLight(0x9ddfff, 0x08101a, 1.3));
const keyLight = new THREE.DirectionalLight(0xffffff, 2.2);
keyLight.position.set(5, 10, 8);
scene.add(keyLight);

const floor = new THREE.Mesh(
  new THREE.PlaneGeometry(40, 30),
  new THREE.MeshStandardMaterial({
    color: 0x08131f,
    roughness: 1,
    metalness: 0,
    transparent: true,
    opacity: 0.78,
  })
);
floor.rotation.x = -Math.PI / 2;
floor.position.y = -2;
scene.add(floor);

const grid = new THREE.GridHelper(34, 34, 0x21475a, 0x132b3b);
grid.position.y = -1.98;
grid.material.opacity = 0.42;
grid.material.transparent = true;
scene.add(grid);

const positions = {
  expressionEvaluation: [-5.8, 1.6, 0],
  evaluatorCore: [-2.2, 1.6, 0],
  memberResolution: [-5.8, -1.2, 0],
  assignFunctions: [1.5, 1.6, 0],
  typeVarHandling: [5.2, 1.6, 0],
  collectionInference: [-2.2, -1.2, 0],
  flowAnalysis: [1.5, -1.2, 0],
  narrowing: [5.2, -1.2, 0],
  diagnostics: [1.5, -3.9, 0],
};

const links = [
  ['expressionEvaluation', 'evaluatorCore'],
  ['expressionEvaluation', 'memberResolution'],
  ['evaluatorCore', 'assignFunctions'],
  ['evaluatorCore', 'collectionInference'],
  ['evaluatorCore', 'flowAnalysis'],
  ['assignFunctions', 'typeVarHandling'],
  ['flowAnalysis', 'narrowing'],
  ['assignFunctions', 'diagnostics'],
  ['expressionEvaluation', 'diagnostics'],
];

const modules = new Map();
const labelLayer = $('#labels');
const boxGeometry = new THREE.BoxGeometry(2.75, 1.25, 1.25);
const edgeGeometry = new THREE.EdgesGeometry(boxGeometry);

for (const [id, info] of Object.entries(moduleCatalog)) {
  const position = positions[id];
  if (!position) continue;

  const group = new THREE.Group();
  group.position.set(...position);
  group.userData.moduleId = id;

  const material = new THREE.MeshStandardMaterial({
    color: new THREE.Color(info.color).multiplyScalar(0.32),
    emissive: new THREE.Color(info.color),
    emissiveIntensity: 0.08,
    roughness: 0.38,
    metalness: 0.28,
  });
  const mesh = new THREE.Mesh(boxGeometry, material);
  mesh.userData.moduleId = id;
  group.add(mesh);

  const edges = new THREE.LineSegments(
    edgeGeometry,
    new THREE.LineBasicMaterial({color: info.color, transparent: true, opacity: 0.42})
  );
  group.add(edges);

  const marker = new THREE.Mesh(
    new THREE.SphereGeometry(0.09, 16, 12),
    new THREE.MeshBasicMaterial({color: info.color})
  );
  marker.position.set(-1.05, 0.39, 0.64);
  group.add(marker);

  scene.add(group);

  const label = document.createElement('div');
  label.className = 'module-label';
  label.textContent = info.label;
  labelLayer.append(label);

  modules.set(id, {group, mesh, edges, label, info});
}

const connectionMaterial = new THREE.LineBasicMaterial({
  color: 0x315b70,
  transparent: true,
  opacity: 0.48,
});
for (const [from, to] of links) {
  const geometry = new THREE.BufferGeometry().setFromPoints([
    modules.get(from).group.position,
    modules.get(to).group.position,
  ]);
  scene.add(new THREE.Line(geometry, connectionMaterial));
}

const pulse = new THREE.Mesh(
  new THREE.SphereGeometry(0.16, 20, 14),
  new THREE.MeshBasicMaterial({color: 0xffffff})
);
pulse.visible = false;
scene.add(pulse);

const candidateGroup = new THREE.Group();
candidateGroup.position.set(-0.35, 3.65, 0);
scene.add(candidateGroup);
const candidateMeshes = [1, 2].map((candidate, index) => {
  const mesh = new THREE.Mesh(
    new THREE.CylinderGeometry(0.22, 0.22, 1.2, 16),
    new THREE.MeshStandardMaterial({
      color: 0x384e5e,
      emissive: 0x000000,
      roughness: 0.4,
      metalness: 0.15,
    })
  );
  mesh.rotation.z = Math.PI / 2;
  mesh.position.x = index * 2.1;
  mesh.userData.candidate = candidate;
  candidateGroup.add(mesh);
  return mesh;
});

let trace = scenarios.find((item) => item.id === $('#scenario').value);
let eventIndex = 0;
let playing = false;
let lastAdvance = performance.now();
let selectedModule = 'evaluatorCore';
let pulsePath = null;
let pulseStart = performance.now();

function renderCode() {
  const code = $('#code');
  code.replaceChildren();
  trace.example.split('\n').forEach((line, index) => {
    const row = document.createElement('span');
    row.className = 'code-line' + (index + 1 === trace.focus.line ? ' focus' : '');
    const number = document.createElement('span');
    number.className = 'line-number';
    number.textContent = String(index + 1).padStart(2, ' ');
    row.append(number, document.createTextNode(line || ' '));
    code.append(row);
  });
  $('#focus-expression').textContent = trace.focus.expression;
}

function showModule(id) {
  if (!moduleCatalog[id]) return;
  selectedModule = id;
  const info = moduleCatalog[id];
  $('#module-title').textContent = info.label;
  $('#module-role').textContent = info.role;
  const link = $('#module-source');
  link.href = `https://github.com/bschnurr/pyright/blob/typeEval-explained/packages/pyright-internal/src/analyzer/${info.source}`;
}

function addDetail(list, label, value) {
  if (value === undefined || value === null || typeof value === 'object') return;
  const term = document.createElement('dt');
  term.textContent = label;
  const description = document.createElement('dd');
  description.textContent = String(value);
  list.append(term, description);
}

function renderStateList(element, values, emptyText, mapper) {
  element.replaceChildren();
  if (values.length === 0) {
    element.className = 'state-list empty';
    element.textContent = emptyText;
    return;
  }
  element.className = 'state-list';
  for (const value of values) element.append(mapper(value));
}

function createPill(text, status = '') {
  const pill = document.createElement('div');
  pill.className = `state-pill ${status}`;
  pill.textContent = text;
  return pill;
}

function updateCandidateMeshes(state) {
  for (const mesh of candidateMeshes) {
    const candidate = state.candidates.get(mesh.userData.candidate);
    const status = candidate?.status;
    const colors = {
      accepted: [0x62c58f, 0x62c58f],
      rejected: [0xef7d80, 0xef7d80],
      testing: [0xedb565, 0xedb565],
    };
    const [color, emissive] = colors[status] || [0x384e5e, 0x000000];
    mesh.material.color.setHex(color);
    mesh.material.emissive.setHex(emissive);
    mesh.material.emissiveIntensity = status ? 0.25 : 0;
  }
}

function setEvent(index, animate = true) {
  eventIndex = Math.max(0, Math.min(trace.events.length - 1, index));
  const event = trace.events[eventIndex];
  const state = traceStateAt(trace, eventIndex);

  $('#timeline').max = String(trace.events.length - 1);
  $('#timeline').value = String(eventIndex);
  $('#step-count').textContent = `Step ${eventIndex + 1} of ${trace.events.length}`;
  $('#event-kind').textContent = event.kind;
  $('#step-title').textContent = event.operation || event.kind.replace(/^./, (c) => c.toUpperCase());
  $('#step-caption').textContent = event.caption;
  $('#inferred-type').textContent = state.result || '—';

  const details = $('#event-details');
  details.replaceChildren();
  for (const [key, value] of Object.entries(event)) {
    if (['id', 'kind', 'time', 'caption', 'module'].includes(key)) continue;
    addDetail(details, key, value);
  }

  renderStateList(
    $('#candidates'),
    [...state.candidates.entries()],
    'No candidates tested yet.',
    ([number, value]) => createPill(
      `#${number}  ${value.signature}\n${value.status}${value.reason ? ` — ${value.reason}` : ''}`,
      value.status
    )
  );
  renderStateList(
    $('#constraints'),
    [...state.constraints.entries()],
    'No constraints collected yet.',
    ([typeVar, value]) => createPill(
      `${typeVar}: lower bound ${value.lowerBound || '—'} → solution ${value.solution || 'pending'}`,
      value.solution ? 'accepted' : 'testing'
    )
  );

  const active = new Set(state.activeModules);
  if (event.module) active.add(event.module);
  for (const [id, module] of modules) {
    const on = active.has(id);
    module.mesh.material.emissiveIntensity = on ? 0.56 : 0.08;
    module.edges.material.opacity = on ? 1 : 0.42;
    module.label.classList.toggle('active', on);
    module.group.scale.setScalar(on ? 1.08 : 1);
  }

  updateCandidateMeshes(state);
  if (event.module) {
    showModule(event.module);
    if (animate) startPulse(eventIndex > 0 ? trace.events[eventIndex - 1].module : null, event.module);
  }
}

function startPulse(fromId, toId) {
  if (!toId || !modules.has(toId)) return;
  const from = modules.get(fromId)?.group.position || new THREE.Vector3(-8.5, 1.6, 0);
  const to = modules.get(toId).group.position;
  pulsePath = {from: from.clone(), to: to.clone()};
  pulseStart = performance.now();
  pulse.material.color.copy(modules.get(toId).mesh.material.emissive);
  pulse.visible = true;
}

function setPlaying(value) {
  playing = value;
  $('#play').innerHTML = value ? 'Ⅱ <span>Pause</span>' : '▶ <span>Play</span>';
  lastAdvance = performance.now();
}

$('#play').addEventListener('click', () => setPlaying(!playing));
$('#previous').addEventListener('click', () => { setPlaying(false); setEvent(eventIndex - 1); });
$('#next').addEventListener('click', () => {
  setPlaying(false);
  setEvent(eventIndex === trace.events.length - 1 ? 0 : eventIndex + 1);
});
$('#timeline').addEventListener('input', (event) => { setPlaying(false); setEvent(Number(event.target.value)); });
$('#scenario').addEventListener('change', (event) => {
  trace = scenarios.find((item) => item.id === event.target.value);
  setPlaying(false);
  renderCode();
  setEvent(0, false);
});
$('#overview').addEventListener('click', () => {
  camera.position.set(0, 8.5, 18);
  controls.target.set(0, 0, 0);
  controls.update();
});

const raycaster = new THREE.Raycaster();
const pointer = new THREE.Vector2();
canvas.addEventListener('pointerdown', (event) => {
  const rect = canvas.getBoundingClientRect();
  pointer.x = ((event.clientX - rect.left) / rect.width) * 2 - 1;
  pointer.y = -((event.clientY - rect.top) / rect.height) * 2 + 1;
  raycaster.setFromCamera(pointer, camera);
  const hit = raycaster.intersectObjects([...modules.values()].map((item) => item.mesh))[0];
  if (hit?.object.userData.moduleId) showModule(hit.object.userData.moduleId);
});

function resize() {
  const width = scenePanel.clientWidth;
  const height = scenePanel.clientHeight;
  if (canvas.width !== Math.round(width * renderer.getPixelRatio()) ||
      canvas.height !== Math.round(height * renderer.getPixelRatio())) {
    renderer.setSize(width, height, false);
    camera.aspect = width / Math.max(1, height);
    camera.updateProjectionMatrix();
  }
}

const projected = new THREE.Vector3();
function updateLabels() {
  const rect = canvas.getBoundingClientRect();
  for (const module of modules.values()) {
    projected.copy(module.group.position);
    projected.y -= 0.9;
    projected.project(camera);
    module.label.style.left = `${(projected.x * .5 + .5) * rect.width}px`;
    module.label.style.top = `${(-projected.y * .5 + .5) * rect.height}px`;
    module.label.style.opacity = projected.z > 1 ? '0' : '1';
  }
}

function animate(now) {
  requestAnimationFrame(animate);
  resize();
  controls.update();

  if (playing && now - lastAdvance > 2200) {
    if (eventIndex >= trace.events.length - 1) {
      setPlaying(false);
    } else {
      setEvent(eventIndex + 1);
      lastAdvance = now;
    }
  }

  if (pulse.visible && pulsePath) {
    const progress = Math.min(1, (now - pulseStart) / 720);
    const eased = 1 - Math.pow(1 - progress, 3);
    pulse.position.lerpVectors(pulsePath.from, pulsePath.to, eased);
    pulse.position.y += Math.sin(progress * Math.PI) * 0.65;
    pulse.scale.setScalar(0.8 + Math.sin(progress * Math.PI) * 0.7);
    if (progress >= 1) pulse.visible = false;
  }

  const bob = Math.sin(now * 0.0015) * 0.025;
  for (const module of modules.values()) module.mesh.position.y = bob;

  updateLabels();
  renderer.render(scene, camera);
}

renderCode();
showModule(selectedModule);
setEvent(0, false);
requestAnimationFrame(animate);
