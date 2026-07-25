import { store } from "../store.js";
import * as THREE from "https://cdn.jsdelivr.net/npm/three@0.160.0/build/three.module.js";

/* ============================================================
   TRANSVOIX 3D REAL-WORLD GLOBE ENGINE
   Renders a complete, unclipped 3D Earth matrix with animated
   translation arcs, glowing city nodes, and drag physics.
   ============================================================ */

const GLOBAL_NODES = [
  { lat: 40.7128, lon: -74.0060, name: "New York", lang: "EN" },
  { lat: 51.5074, lon: -0.1278,  name: "London",   lang: "EN" },
  { lat: 35.6762, lon: 139.6503, name: "Tokyo",    lang: "JA" },
  { lat: 28.6139, lon: 77.2090,  name: "New Delhi",lang: "HI" },
  { lat: 48.8566, lon: 2.3522,   name: "Paris",    lang: "FR" },
  { lat: -33.8688,lon: 151.2093, name: "Sydney",   lang: "EN" },
  { lat: -23.5505,lon: -46.6333, name: "São Paulo",lang: "PT" },
  { lat: 30.0444, lon: 31.2357,  name: "Cairo",    lang: "AR" },
  { lat: 1.3521,  lon: 103.8198, name: "Singapore",lang: "ZH" },
  { lat: 19.4326, lon: -99.1332, name: "Mexico City", lang: "ES" }
];

const TRANSLATION_ROUTES = [
  { from: 0, to: 2, label: "EN ↔ JA" },
  { from: 1, to: 3, label: "EN ↔ HI" },
  { from: 4, to: 2, label: "FR ↔ JA" },
  { from: 0, to: 6, label: "EN ↔ PT" },
  { from: 3, to: 5, label: "HI ↔ EN" },
  { from: 1, to: 7, label: "EN ↔ AR" },
  { from: 8, to: 0, label: "ZH ↔ EN" },
  { from: 9, to: 4, label: "ES ↔ FR" }
];

export class Globe3DEngine {
  constructor(container) {
    this.container = container;
    this.width = container.clientWidth || 640;
    this.height = container.clientHeight || 640;

    this.scene = null;
    this.camera = null;
    this.renderer = null;
    this.globeGroup = null;
    this.arcsGroup = null;

    this.animId = null;
    this.rotationSpeed = 0.0016;
    this.isDragging = false;
    this.previousMousePosition = { x: 0, y: 0 };
    this.targetRotation = { x: 0.2, y: 0 };
    this.currentRotation = { x: 0.2, y: 0 };
    this.pulseParticles = [];

    this.init();
  }

  latLonToVector3(lat, lon, radius = 195, alt = 0) {
    const phi = (90 - lat) * (Math.PI / 180);
    const theta = (lon + 180) * (Math.PI / 180);
    const r = radius + alt;

    const x = -(r * Math.sin(phi) * Math.cos(theta));
    const z = r * Math.sin(phi) * Math.sin(theta);
    const y = r * Math.cos(phi);

    return new THREE.Vector3(x, y, z);
  }

  init() {
    // 1. Scene & Camera (adjusted focal length for complete unclipped view)
    this.scene = new THREE.Scene();
    this.camera = new THREE.PerspectiveCamera(45, this.width / this.height, 1, 2000);
    this.camera.position.z = 540;

    // 2. Renderer
    this.renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true });
    this.renderer.setSize(this.width, this.height);
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));

    this.container.innerHTML = "";
    this.container.appendChild(this.renderer.domElement);

    // 3. Globe Group
    this.globeGroup = new THREE.Group();
    this.scene.add(this.globeGroup);

    // 4. Build Components
    this.createCoreSphere();
    this.createDotMatrixLandmass();
    this.createAtmosphereGlow();
    this.createCityNodes();
    this.createTranslationArcs();

    // 5. Lighting
    const ambientLight = new THREE.AmbientLight(0xffffff, 1.3);
    this.scene.add(ambientLight);

    const pointLight = new THREE.PointLight(0xa78bfa, 2.2, 900);
    pointLight.position.set(200, 300, 400);
    this.scene.add(pointLight);

    // 6. Bind Events & Start Loop
    this.bindEvents();
    this.animate();
  }

  createCoreSphere() {
    const geometry = new THREE.SphereGeometry(193, 48, 48);
    const material = new THREE.MeshBasicMaterial({
      color: 0x0a0520,
      transparent: true,
      opacity: 0.88,
    });
    const sphere = new THREE.Mesh(geometry, material);
    this.globeGroup.add(sphere);

    // Wireframe grid lines
    const gridMat = new THREE.MeshBasicMaterial({
      color: 0x6d28d9,
      wireframe: true,
      transparent: true,
      opacity: 0.22
    });
    const gridSphere = new THREE.Mesh(new THREE.SphereGeometry(194, 36, 18), gridMat);
    this.globeGroup.add(gridSphere);
  }

  createDotMatrixLandmass() {
    const dotsCount = 3000;
    const geometry = new THREE.BufferGeometry();
    const positions = [];
    const colors = [];

    const colorA = new THREE.Color(0xa78bfa);
    const colorB = new THREE.Color(0x38bdf8);

    for (let i = 0; i < dotsCount; i++) {
      const phi = Math.acos(1 - 2 * (i + 0.5) / dotsCount);
      const theta = Math.PI * (1 + Math.sqrt(5)) * i;

      const lat = 90 - (phi * 180 / Math.PI);
      const lon = (theta * 180 / Math.PI) % 360 - 180;

      if (!this.isApproxLand(lat, lon)) continue;

      const pos = this.latLonToVector3(lat, lon, 195);
      positions.push(pos.x, pos.y, pos.z);

      const mixedColor = colorA.clone().lerp(colorB, Math.random());
      colors.push(mixedColor.r, mixedColor.g, mixedColor.b);
    }

    geometry.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
    geometry.setAttribute('color', new THREE.Float32BufferAttribute(colors, 3));

    const material = new THREE.PointsMaterial({
      size: 3.2,
      vertexColors: true,
      transparent: true,
      opacity: 0.95
    });

    const dotsMesh = new THREE.Points(geometry, material);
    this.globeGroup.add(dotsMesh);
  }

  isApproxLand(lat, lon) {
    if (lat > 15 && lat < 70 && lon > -160 && lon < -50) return true;
    if (lat > -55 && lat < 12 && lon > -80 && lon < -35) return true;
    if (lat > 35 && lat < 70 && lon > -10 && lon < 40) return true;
    if (lat > -35 && lat < 35 && lon > -18 && lon < 50) return true;
    if (lat > 5 && lat < 70 && lon > 40 && lon < 145) return true;
    if (lat > -42 && lat < -10 && lon > 112 && lon < 154) return true;
    return Math.random() > 0.84;
  }

  createAtmosphereGlow() {
    const geometry = new THREE.SphereGeometry(208, 36, 36);
    const material = new THREE.MeshBasicMaterial({
      color: 0x38bdf8,
      transparent: true,
      opacity: 0.12,
      side: THREE.BackSide
    });
    const atmosphere = new THREE.Mesh(geometry, material);
    this.globeGroup.add(atmosphere);
  }

  createCityNodes() {
    GLOBAL_NODES.forEach((node) => {
      const pos = this.latLonToVector3(node.lat, node.lon, 197);

      const nodeGeo = new THREE.SphereGeometry(3.8, 16, 16);
      const nodeMat = new THREE.MeshBasicMaterial({ color: 0x38bdf8 });
      const nodeMesh = new THREE.Mesh(nodeGeo, nodeMat);
      nodeMesh.position.copy(pos);
      this.globeGroup.add(nodeMesh);

      const ringGeo = new THREE.RingGeometry(4.5, 8, 24);
      const ringMat = new THREE.MeshBasicMaterial({
        color: 0xe879f9,
        side: THREE.DoubleSide,
        transparent: true,
        opacity: 0.8
      });
      const ringMesh = new THREE.Mesh(ringGeo, ringMat);
      ringMesh.position.copy(pos);
      ringMesh.lookAt(new THREE.Vector3(0, 0, 0));
      this.globeGroup.add(ringMesh);
    });
  }

  createTranslationArcs() {
    this.arcsGroup = new THREE.Group();
    this.globeGroup.add(this.arcsGroup);

    TRANSLATION_ROUTES.forEach((route) => {
      const startNode = GLOBAL_NODES[route.from];
      const endNode = GLOBAL_NODES[route.to];

      const start = this.latLonToVector3(startNode.lat, startNode.lon, 196);
      const end = this.latLonToVector3(endNode.lat, endNode.lon, 196);

      const mid = start.clone().add(end).multiplyScalar(0.5);
      const distance = start.distanceTo(end);
      mid.setLength(195 + distance * 0.35);

      const curve = new THREE.QuadraticBezierCurve3(start, mid, end);
      const points = curve.getPoints(50);
      const arcGeometry = new THREE.BufferGeometry().setFromPoints(points);

      const arcMaterial = new THREE.LineBasicMaterial({
        color: 0xc084fc,
        transparent: true,
        opacity: 0.6
      });

      const arcLine = new THREE.Line(arcGeometry, arcMaterial);
      this.arcsGroup.add(arcLine);

      const particleGeo = new THREE.SphereGeometry(3.5, 12, 12);
      const particleMat = new THREE.MeshBasicMaterial({ color: 0x38bdf8 });
      const particle = new THREE.Mesh(particleGeo, particleMat);

      this.pulseParticles.push({
        mesh: particle,
        curve: curve,
        progress: Math.random()
      });
      this.arcsGroup.add(particle);
    });
  }

  bindEvents() {
    this._onMouseDown = (e) => {
      this.isDragging = true;
      this.previousMousePosition = { x: e.clientX, y: e.clientY };
    };

    this._onMouseMove = (e) => {
      if (!this.isDragging) return;
      const deltaX = e.clientX - this.previousMousePosition.x;
      const deltaY = e.clientY - this.previousMousePosition.y;

      this.targetRotation.y += deltaX * 0.005;
      this.targetRotation.x += deltaY * 0.005;

      this.previousMousePosition = { x: e.clientX, y: e.clientY };
    };

    this._onMouseUp = () => {
      this.isDragging = false;
    };

    this._onResize = () => {
      if (!this.container) return;
      this.width = this.container.clientWidth || 640;
      this.height = this.container.clientHeight || 640;
      this.camera.aspect = this.width / this.height;
      this.camera.updateProjectionMatrix();
      this.renderer.setSize(this.width, this.height);
    };

    const dom = this.renderer.domElement;
    dom.style.cursor = "grab";
    dom.addEventListener("mousedown", this._onMouseDown);
    window.addEventListener("mousemove", this._onMouseMove);
    window.addEventListener("mouseup", this._onMouseUp);
    window.addEventListener("resize", this._onResize);
  }

  animate() {
    this.animId = requestAnimationFrame(() => this.animate());

    if (!this.isDragging) {
      this.targetRotation.y += this.rotationSpeed;
    }

    this.currentRotation.x += (this.targetRotation.x - this.currentRotation.x) * 0.05;
    this.currentRotation.y += (this.targetRotation.y - this.currentRotation.y) * 0.05;

    if (this.globeGroup) {
      this.globeGroup.rotation.x = this.currentRotation.x;
      this.globeGroup.rotation.y = this.currentRotation.y;
    }

    this.pulseParticles.forEach((item) => {
      item.progress += 0.008;
      if (item.progress > 1) item.progress = 0;
      const pos = item.curve.getPoint(item.progress);
      item.mesh.position.copy(pos);
    });

    this.renderer.render(this.scene, this.camera);
  }

  destroy() {
    if (this.animId) cancelAnimationFrame(this.animId);

    window.removeEventListener("mousemove", this._onMouseMove);
    window.removeEventListener("mouseup", this._onMouseUp);
    window.removeEventListener("resize", this._onResize);

    if (this.renderer && this.renderer.domElement) {
      this.renderer.domElement.remove();
      this.renderer.dispose();
    }
  }
}
