import * as THREE from "three";
import { setAmmo } from "./ammo-lib.js";
import {
	initScene,
	getScene,
	getCamera,
	getRenderer,
	getControls,
	clampCameraAboveGround,
} from "./scene.js";
import { initPhysics, getPhysicsWorld, getRigidBodies } from "./physics.js";
import {
	initAgents,
	spawnAgent,
	getAgents,
	faceMotion,
	updateHat,
} from "./agent.js";
import { initAI, updateAgentAI } from "./ai.js";
import { createWorld, getResources, removeResource } from "./world.js";
import { FACTIONS, getTmpCache } from "./config.js";
import { createHouses, getSpawnPointForAgent } from "./faction.js";

Ammo().then((AmmoLib) => {
	// Stocker l'instance d'Ammo pour un accès global
	setAmmo(AmmoLib);

	// ----------------------
	// INITIALISATION
	// ----------------------
	const { scene, camera, renderer, controls } = initScene();
	const physicsWorld = initPhysics();
	initAgents();
	initAI();
	createWorld();
	createHouses();

	const TMP = getTmpCache();

	// Population initiale
	const roles = ["tank", "dps", "healer", "ramasseur"];
	for (let i = 0; i < FACTIONS.length; i++) {
		const faction = FACTIONS[i];
		for (const role of roles) {
			const spawnPoint = getSpawnPointForAgent(faction.id, role);
			if (spawnPoint) {
				spawnAgent(role, i, spawnPoint.x, spawnPoint.y, spawnPoint.z);
			}
		}
	}

	// ----------------------
	// BOUCLE D'ANIMATION
	// ----------------------
	let last = performance.now();

	function animate(now) {
		const dt = Math.min((now - last) / 1000, 1 / 30);
		last = now;

		// 1. Mise à jour physique
		physicsWorld.stepSimulation(dt, 10);

		// 2. Synchronisation des objets rigides
		const trans = TMP.trans;
		const rigidBodies = getRigidBodies();
		for (const mesh of rigidBodies) {
			const body = mesh.userData.physicsBody;
			if (body && body.getMotionState()) {
				body.getMotionState().getWorldTransform(trans);
				const o = trans.getOrigin();
				const r = trans.getRotation();
				mesh.position.set(o.x(), o.y(), o.z());
				mesh.quaternion.set(r.x(), r.y(), r.z(), r.w());
			}
		}

		// 3. Mise à jour des agents
		const agents = getAgents();
		const resources = getResources();
		for (const a of agents) {
			updateAgentAI(a, dt, resources, removeResource, agents);
			faceMotion(a, dt);
			updateHat(a);
		}

		// 4. Rendu
		controls.update();
		clampCameraAboveGround();
		renderer.render(scene, camera);

		requestAnimationFrame(animate);
	}

	requestAnimationFrame(animate);
});
