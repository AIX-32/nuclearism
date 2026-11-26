
import * as THREE from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { MACHINE_DEFS } from './content.js';

let gallery = null;
const THUMB_PX = 96;

export function openGallery() {
  const grid = document.getElementById('galleryGrid');
  const canvas = document.getElementById('galleryCanvas');
  const caption = document.getElementById('galleryCaption');
  if (!grid || !canvas) return () => { };
  if (gallery) { gallery.start(); return gallery.stop; }

  const loader = new GLTFLoader();
  const renderer = new THREE.WebGLRenderer({ canvas, alpha: true, antialias: true });
  renderer.setPixelRatio(1);
  const scene = new THREE.Scene();
  scene.add(new THREE.HemisphereLight(0xffffff, 0x39424f, 2.2));
  const key = new THREE.DirectionalLight(0xffffff, 2.4); key.position.set(4, 7, 6); scene.add(key);
  const rim = new THREE.DirectionalLight(0x9db8ff, 1.1); rim.position.set(-5, 2, -4); scene.add(rim);
  const camera = new THREE.PerspectiveCamera(45, 1, 0.01, 10000);

  const thumbCanvas = document.createElement('canvas');
  const thumbRenderer = new THREE.WebGLRenderer({ canvas: thumbCanvas, alpha: true, antialias: true, preserveDrawingBuffer: true });
  thumbRenderer.setPixelRatio(1);
  thumbRenderer.setSize(THUMB_PX, THUMB_PX, false);
  const thumbScene = new THREE.Scene();
  thumbScene.add(new THREE.HemisphereLight(0xffffff, 0x39424f, 2.2));
  const thumbKey = new THREE.DirectionalLight(0xffffff, 2.4); thumbKey.position.set(4, 7, 6); thumbScene.add(thumbKey);
  const thumbCam = new THREE.OrthographicCamera(-1, 1, 1, -1, 0.01, 1000);

  let current = null, running = false, raf = 0;
  let yaw = 0.7, pitch = 0.4, dist = 1;
  const target = new THREE.Vector3();

  function placeCamera() {
    camera.position.set(
      target.x + dist * Math.cos(pitch) * Math.sin(yaw),
      target.y + dist * Math.sin(pitch),
      target.z + dist * Math.cos(pitch) * Math.cos(yaw),
    );
    camera.lookAt(target);
  }

  function frame() {
    const w = canvas.clientWidth || 320, h = canvas.clientHeight || 240;
    if (canvas.width !== w || canvas.height !== h) {
      renderer.setSize(w, h, false);
      camera.aspect = w / Math.max(1, h);
      camera.updateProjectionMatrix();
    }
    placeCamera();
    renderer.render(scene, camera);
    if (running) raf = requestAnimationFrame(frame);
  }
  function start() { if (!running) { running = true; frame(); } }
  function stop() { running = false; cancelAnimationFrame(raf); }

  function thumbnail(root) {
    root.updateMatrixWorld(true);
    const sphere = new THREE.Box3().setFromObject(root).getBoundingSphere(new THREE.Sphere());
    const r = Math.max(sphere.radius, 1e-3);
    thumbCam.position.copy(sphere.center).addScaledVector(new THREE.Vector3(1, 0.85, 1).normalize(), r * 4);
    thumbCam.lookAt(sphere.center);
    thumbCam.left = -r * 1.04; thumbCam.right = r * 1.04;
    thumbCam.top = r * 1.04; thumbCam.bottom = -r * 1.04;
    thumbCam.near = 0.01; thumbCam.far = r * 10;
    thumbCam.updateProjectionMatrix();
    thumbScene.add(root);
    thumbRenderer.render(thumbScene, thumbCam);
    thumbScene.remove(root);
    return thumbCanvas.toDataURL('image/png');
  }

  function select(def, cell) {
    for (const c of grid.children) c.classList.toggle('selected', c === cell);
    const name = (def.name || def.id).toUpperCase();
    caption.textContent = `${name} · LOADING`;
    loader.loadAsync(def.model).then((gltf) => {
      if (current) scene.remove(current);
      const root = gltf.scene;
      root.updateMatrixWorld(true);
      const sphere = new THREE.Box3().setFromObject(root).getBoundingSphere(new THREE.Sphere());
      target.copy(sphere.center);
      dist = Math.max(sphere.radius, 1e-3) * 3.2;
      scene.add(root);
      current = root;
      yaw = 0.7; pitch = 0.4;
      caption.textContent = `${name} · DRAG TO ROTATE · SCROLL TO ZOOM`;
    }).catch(() => { caption.textContent = `MODEL UNAVAILABLE · ${name}`; });
  }

  for (const def of MACHINE_DEFS) {
    if (!def.model) continue;
    const cell = document.createElement('button');
    cell.type = 'button';
    cell.className = 'gallery-cell';
    cell.title = def.name || def.id;
    const img = document.createElement('img');
    img.alt = '';
    const label = document.createElement('span');
    label.textContent = def.name || def.id;
    cell.append(img, label);
    cell.addEventListener('click', () => select(def, cell));
    grid.appendChild(cell);
    loader.loadAsync(def.model).then((gltf) => {
      img.src = thumbnail(gltf.scene);
      img.classList.add('ready');
    }).catch(() => cell.classList.add('missing'));
  }

  let drag = null;
  canvas.addEventListener('pointerdown', (e) => { drag = { x: e.clientX, y: e.clientY }; canvas.setPointerCapture(e.pointerId); });
  canvas.addEventListener('pointermove', (e) => {
    if (!drag) return;
    yaw -= (e.clientX - drag.x) * 0.01;
    pitch = Math.max(-1.4, Math.min(1.4, pitch + (e.clientY - drag.y) * 0.01));
    drag = { x: e.clientX, y: e.clientY };
  });
  canvas.addEventListener('pointerup', () => { drag = null; });
  canvas.addEventListener('pointercancel', () => { drag = null; });
  canvas.addEventListener('wheel', (e) => { e.preventDefault(); dist = Math.max(0.1, dist * (e.deltaY > 0 ? 1.12 : 0.89)); }, { passive: false });

  gallery = { start, stop };
  start();
  return stop;
}
