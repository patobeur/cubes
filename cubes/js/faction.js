import * as THREE from "three";
import { FACTIONS, PLANE_SIZE } from "./config.js";
import { createRigidBody } from "./physics.js";
import { getScene } from "./scene.js";
import { getAmmo } from "./ammo-lib.js";

const houses = [];
const HOUSE_SIZE = 5;
const HOUSE_OFFSET = 5; // Distance from world edge

export function createHouses() {
	const AmmoLib = getAmmo();
	if (!AmmoLib) {
		console.error("Ammo has not been initialized yet!");
		return;
	}
	const scene = getScene();
	const halfPlane = PLANE_SIZE / 2;
	const pos = halfPlane - HOUSE_OFFSET - HOUSE_SIZE / 2;

	const positions = [
		new THREE.Vector3(pos, HOUSE_SIZE / 2, pos),
		new THREE.Vector3(-pos, HOUSE_SIZE / 2, pos),
		new THREE.Vector3(pos, HOUSE_SIZE / 2, -pos),
		new THREE.Vector3(-pos, HOUSE_SIZE / 2, -pos),
	];

	const rotationsY = [
		-Math.PI / 4, // Face towards center from (+,+)
		Math.PI / 4, // Face towards center from (-,+)
		(-Math.PI * 3) / 4, // Face towards center from (+,-)
		(Math.PI * 3) / 4, // Face towards center from (-,-)
	];

	for (let i = 0; i < FACTIONS.length; i++) {
		const faction = FACTIONS[i];

		const houseGeo = new THREE.BoxGeometry(
			HOUSE_SIZE,
			HOUSE_SIZE,
			HOUSE_SIZE
		);
		// Use a different material for houses to distinguish them
		const houseMat = new THREE.MeshStandardMaterial({
			color: faction.color,
			metalness: 0.2,
			roughness: 0.8,
		});
		const houseMesh = new THREE.Mesh(houseGeo, houseMat);

		houseMesh.position.copy(positions[i]);
		houseMesh.rotation.y = rotationsY[i];
		houseMesh.castShadow = true;
		houseMesh.receiveShadow = true;

		scene.add(houseMesh);

		const shape = new AmmoLib.btBoxShape(
			new AmmoLib.btVector3(
				HOUSE_SIZE * 0.5,
				HOUSE_SIZE * 0.5,
				HOUSE_SIZE * 0.5
			)
		);
		createRigidBody(
			houseMesh,
			shape,
			0,
			houseMesh.position,
			houseMesh.quaternion
		);

		const house = {
			id: faction.id,
			mesh: houseMesh,
			spawnPoints: [],
		};

		// Calculate spawn points
		const spawnDistance = 3 + HOUSE_SIZE / 2; // 3 units from the front face
		const frontVector = new THREE.Vector3(0, 0, -1).applyQuaternion(
			houseMesh.quaternion
		);
		const sideVector = new THREE.Vector3()
			.crossVectors(new THREE.Vector3(0, 1, 0), frontVector)
			.normalize();

		const spawnCenter = houseMesh.position
			.clone()
			.add(frontVector.multiplyScalar(spawnDistance));

		// 4 spawn points per house, side by side
		const agentRoles = ["tank", "dps", "healer", "ramasseur"];
		for (let j = 0; j < agentRoles.length; j++) {
			const offset = (j - 1.5) * 2.5; // agent spacing
			const spawnPoint = spawnCenter
				.clone()
				.add(sideVector.clone().multiplyScalar(offset));
			spawnPoint.y = 1; // Agents spawn slightly above ground
			house.spawnPoints.push({ role: agentRoles[j], position: spawnPoint });
		}

		houses.push(house);
	}
}

export function getHouses() {
	return houses;
}

export function getSpawnPointForAgent(factionId, role) {
	const house = houses.find((h) => h.id === factionId);
	if (house) {
		const spawnInfo = house.spawnPoints.find((sp) => sp.role === role);
		if (spawnInfo) {
			return spawnInfo.position;
		}
	}
	// Fallback or error
	console.warn(`No spawn point for faction ${factionId}, role ${role}`);
	return new THREE.Vector3(
		(Math.random() - 0.5) * 10,
		5,
		(Math.random() - 0.5) * 10
	);
}
