import * as THREE from "three";
import { GEOS, PLANE_SIZE, RES_COLOR, RES_R, INITIAL_RESOURCES } from './config.js';
import { createRigidBody } from './physics.js';
import { getScene } from './scene.js';
import { getAmmo } from "./ammo-lib.js";

let resources = [];

export function createWorld() {
    const AmmoLib = getAmmo();
    const scene = getScene();

    // Sol
    GEOS.ground = new THREE.BoxGeometry(PLANE_SIZE, 1, PLANE_SIZE);
    const groundMat = new THREE.MeshStandardMaterial({ color: 0xffffff });
    const ground = new THREE.Mesh(GEOS.ground, groundMat);
    ground.position.set(0, -0.5, 0);
    scene.add(ground);
    const groundShape = new AmmoLib.btBoxShape(
        new AmmoLib.btVector3(PLANE_SIZE * 0.5, 0.5, PLANE_SIZE * 0.5)
    );
    createRigidBody(ground, groundShape, 0, ground.position, ground.quaternion);

    // Ressources initiales
    for (let i = 0; i < INITIAL_RESOURCES; i++) {
        spawnResource(
            (Math.random() - 0.5) * (PLANE_SIZE - 4),
            (Math.random() - 0.5) * (PLANE_SIZE - 4)
        );
    }
}

export function getResources() {
    return resources;
}

export function removeResource(res) {
    const i = resources.indexOf(res);
    if (i >= 0) {
        getScene().remove(res.mesh);
        resources.splice(i, 1);
    }
}

function spawnResource(x, z) {
    const y = 0.5;
    const geo = new THREE.SphereGeometry(RES_R, 16, 12);
    const mat = new THREE.MeshStandardMaterial({
        color: RES_COLOR,
        emissive: 0x330000,
        emissiveIntensity: 0.35,
    });
    const m = new THREE.Mesh(geo, mat);
    m.position.set(x, y, z);
    getScene().add(m);
    resources.push({ mesh: m, pos: m.position.clone() });
    return m;
}