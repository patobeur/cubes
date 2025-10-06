import * as THREE from "three";
import { OrbitControls } from "three/addons/controls/OrbitControls.js";
import { MAX_PIXEL_RATIO } from "./config.js";

let scene, camera, renderer, controls;

export function initScene() {
    // Renderer
    renderer = new THREE.WebGLRenderer({ antialias: true });
    renderer.setPixelRatio(Math.min(devicePixelRatio || 1, MAX_PIXEL_RATIO));
    renderer.setSize(window.innerWidth, window.innerHeight);
    renderer.shadowMap.enabled = true;
    document.body.appendChild(renderer.domElement);

    // Scène
    scene = new THREE.Scene();
    scene.background = new THREE.Color(0x0b0e13);

    // Caméra
    camera = new THREE.PerspectiveCamera(60, innerWidth / innerHeight, 0.1, 500);
    camera.position.set(6, 7, 12);

    // Contrôles
    controls = new OrbitControls(camera, renderer.domElement);
    renderer.domElement.style.display = "block";
    renderer.domElement.style.position = "fixed";
    renderer.domElement.style.inset = "0";
    renderer.domElement.style.touchAction = "none";
    controls.enableDamping = true;
    controls.enableRotate = true;
    controls.enableZoom = true;
    controls.enablePan = true;
    controls.screenSpacePanning = false;
    controls.minPolarAngle = 0.0;
    controls.maxPolarAngle = Math.PI / 2 - 0.01;
    controls.minDistance = 2;
    controls.maxDistance = 80;
    controls.mouseButtons = {
        LEFT: THREE.MOUSE.ROTATE,
        MIDDLE: THREE.MOUSE.DOLLY,
        RIGHT: THREE.MOUSE.PAN,
    };
    controls.touches = {
        ONE: THREE.TOUCH.ROTATE,
        TWO: THREE.TOUCH.DOLLY_PAN,
    };
    controls.target.set(0, 1, 0);

    // Lumières
    scene.add(new THREE.HemisphereLight(0xffffff, 0xffffff, 0.6));
    const dir = new THREE.DirectionalLight(0xffffff, 1);
    dir.position.set(5, 10, 5);
    dir.castShadow = true;
    dir.shadow.mapSize.set(1024, 1024);
    scene.add(dir);

    // UI
    const ui = document.createElement("div");
    ui.className = "ui";
    ui.innerHTML = `
        <b>Three.js + Ammo.js</b><br>
        4 factions (max 4 unités chacune)<br> • Rôles : <b>cube</b>=tank, <b>pyramide</b>=dps, <b>sphère</b>=healer, <b>palette</b>=ramasseur<br>
        - Les corps <b>physiques sont tous des cubes</b>; un <b>chapeau</b> au-dessus indique le rôle<br>
        - Les agents IA ont des comportements variés selon les situations<br>
        - Les ressources réapparaissent au centre<br>
        <div id="lockBadge">Lock: OFF</div>
    `;
    document.body.appendChild(ui);

    // Redimensionnement
    window.addEventListener("resize", onWindowResize);

    clampCameraAboveGround();
    controls.addEventListener("change", () => clampCameraAboveGround());

    return { scene, camera, renderer, controls };
}

function onWindowResize() {
    camera.aspect = window.innerWidth / window.innerHeight;
    camera.updateProjectionMatrix();
    renderer.setSize(window.innerWidth, window.innerHeight);
}

export function getScene() {
    return scene;
}

export function getCamera() {
    return camera;
}

export function getRenderer() {
    return renderer;
}

export function getControls() {
    return controls;
}

export function clampCameraAboveGround(minY = 0.05) {
    if (camera.position.y < minY) camera.position.y = minY;
    if (controls.target.y < minY * 0.5) controls.target.y = minY * 0.5;
}