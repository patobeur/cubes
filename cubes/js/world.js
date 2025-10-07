import * as THREE from "three";
import {
	GEOS,
	PLANE_SIZE,
	RES_COLOR,
	RES_R,
	INITIAL_RESOURCES,
	RESOURCE_SPAWN_RADIUS,
} from "./config.js";
import { createRigidBody } from "./physics.js";
import { getScene } from "./scene.js";
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
			(Math.random() - 0.5) * (PLANE_SIZE - 10),
			(Math.random() - 0.5) * (PLANE_SIZE - 10)
		);
	}
}

export function getResources() {
	return resources;
}

export function removeResource(res) {
	const i = resources.indexOf(res);
	if (i >= 0) {
		// getScene().remove(res.mesh); // Don't remove from scene, just from array
		resources.splice(i, 1);
		// checkAndRespawnResources(); // Respawn should happen after drop-off
	}
}

export function checkAndRespawnResources() {
	if (resources.length < INITIAL_RESOURCES / 2) {
		const toSpawn = INITIAL_RESOURCES - resources.length;
		for (let i = 0; i < toSpawn; i++) {
			const angle = Math.random() * Math.PI * 2;
			const radius = Math.sqrt(Math.random()) * RESOURCE_SPAWN_RADIUS;
			const x = Math.cos(angle) * radius;
			const z = Math.sin(angle) * radius;
			spawnResource(x, z);
		}
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
	resources.push({ mesh: m, pos: m.position.clone(), size: 100 }); // Add size property
	return m;
}
