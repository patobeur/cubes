import * as THREE from "three";
import { FACTIONS, getRoles, GEOS, T3, getTmpCache } from "./config.js";
import { createRigidBody, kickBody, setVelocity } from "./physics.js";
import { getScene } from "./scene.js";
import { getAmmo } from "./ammo-lib.js";

let agents = [];
let factionCounts = new Map();
let LOCK_MODE = false;
let TMP;
let ROLES;

export function initAgents() {
	TMP = getTmpCache();
	ROLES = getRoles();
}

export function getAgents() {
	return agents;
}

export function setLockMode(enabled) {
	LOCK_MODE = enabled;
	for (const a of agents) applyLockToAgent(a, enabled);
	const badge = document.getElementById("lockBadge");
	if (badge)
		badge.textContent = LOCK_MODE
			? "Lock: ON (rotation Y seulement)"
			: "Lock: OFF";
}

function applyLockToAgent(agent, enabled, snap = true) {
	const AmmoLib = getAmmo();
	const b = agent.body;
	if (!b) return;
	if (enabled) {
		if (!agent.anchor)
			agent.anchor = new THREE.Vector3(
				agent.mesh.position.x,
				0.5,
				agent.mesh.position.z
			);
		b.setLinearFactor(TMP.zero);
		b.setAngularFactor(TMP.angY);
		b.setLinearVelocity(TMP.zero);
		b.setAngularVelocity(TMP.zero);
		if (snap) {
			const tr = TMP.trans;
			b.getMotionState().getWorldTransform(tr);
			tr.setOrigin(
				new AmmoLib.btVector3(
					agent.anchor.x,
					agent.anchor.y ?? 0.5,
					agent.anchor.z
				)
			);
			if (typeof b.setWorldTransform === "function") b.setWorldTransform(tr);
			else if (typeof b.setCenterOfMassTransform === "function")
				b.setCenterOfMassTransform(tr);
		}
		if (typeof b.activate === "function") b.activate();
	} else {
		b.setLinearFactor(TMP.one);
		b.setAngularFactor(TMP.one);
		if (typeof b.activate === "function") b.activate();
	}
}

function canSpawnFaction(fid) {
	return (factionCounts.get(fid) || 0) < 4;
}

function incFaction(fid) {
	factionCounts.set(fid, (factionCounts.get(fid) || 0) + 1);
}

function addRoleHat(parentMesh, roleKey) {
	let hatGeo;
	if (roleKey === "tank") hatGeo = GEOS.box;
	else if (roleKey === "ramasseur") hatGeo = GEOS.palette;
	else if (roleKey === "dps") hatGeo = GEOS.pyramid;
	else hatGeo = GEOS.sphere;

	const hat = new THREE.Mesh(
		hatGeo,
		new THREE.MeshStandardMaterial({
			color: 0xffffff,
			metalness: 0.1,
			roughness: 0.6,
		})
	);
	hat.name = "roleHat";
	hat.castShadow = true;
	hat.receiveShadow = true;
	hat.scale.set(0.55, 0.55, 0.55);
	hat.position.set(0, 0.85, 0);
	parentMesh.add(hat);
	return hat;
}

export function updateHat(agent) {
	const mesh = agent.mesh;
	const hat = agent.hat || mesh.children.find((c) => c.name === "roleHat");
	if (!hat) return;
	agent.hat = hat;

	const offsetY = 0.85;
	T3.v1.set(0, offsetY, 0);
	mesh.getWorldPosition(T3.v2).add(T3.v1);
	mesh.worldToLocal(T3.v2);
	hat.position.copy(T3.v2);

	mesh.getWorldQuaternion(T3.q1).invert();
	hat.quaternion.copy(T3.q1);
}

export function faceMotion(a, dt) {
	const maxYawRate = (a.turnRate * Math.PI) / 180;
	let targetYaw;

	if (!LOCK_MODE) {
		const v = a.body.getLinearVelocity();
		const vx = typeof v.x === "function" ? v.x() : v.x ?? 0;
		const vz = typeof v.z === "function" ? v.z() : v.z ?? 0;
		if (Math.abs(vx) + Math.abs(vz) > 1e-3) {
			targetYaw = Math.atan2(vx, vz);
		}
	}
	if (targetYaw == null) {
		targetYaw = (a.headingDeg * Math.PI) / 180;
	}

	const e = new THREE.Euler().setFromQuaternion(a.mesh.quaternion, "YXZ");
	const yaw = e.y;

	let diff =
		THREE.MathUtils.euclideanModulo(targetYaw - yaw + Math.PI, Math.PI * 2) -
		Math.PI;
	const desiredRate = THREE.MathUtils.clamp(
		diff / Math.max(dt, 1e-3),
		-maxYawRate,
		maxYawRate
	);

	a.body.setAngularFactor(TMP.angY);
	TMP.vA.setValue(0, desiredRate, 0);
	a.body.setAngularVelocity(TMP.vA);
	if (typeof a.body.activate === "function") a.body.activate();
}

export function spawnAgent(roleKey, factionIndex, x, y, z) {
	const role = ROLES[roleKey];
	const fac = FACTIONS[factionIndex % FACTIONS.length];
	if (!canSpawnFaction(fac.id)) return null;

	const geom = role.makeMesh();
	const mat = new THREE.MeshStandardMaterial({
		color: fac.color,
		metalness: 0.1,
		roughness: 0.7,
	});
	const mesh = new THREE.Mesh(geom, mat);
	mesh.position.set(x, y, z);
	getScene().add(mesh);

	const hat = addRoleHat(mesh, roleKey);
	const shape = role.makeShape();
	const body = createRigidBody(
		mesh,
		shape,
		role.mass,
		mesh.position,
		mesh.quaternion
	);

	if (typeof body.setAngularFactor === "function")
		body.setAngularFactor(TMP.angY);
	if (typeof body.setActivationState === "function")
		body.setActivationState(4);
	if (typeof body.activate === "function") body.activate();

	TMP.vA.setValue((Math.random() - 0.5) * 2, -1, (Math.random() - 0.5) * 2);
	kickBody(body, TMP.vA);

	const agent = {
		mesh,
		body,
		hat,
		faction: fac.id,
		role: roleKey,
		headingDeg: Math.random() * 360,
		speed: role.speed,
		turnRate: role.turn,
		grounded: false,
		hp: 66,
		energy: 99,
		state: "wander",
		thinkT: 0,
		turnT: 0,
		anchor: new THREE.Vector3(x, 0.5, z),
		hasResource: false,
	};
	agents.push(agent);
	incFaction(fac.id);
	return agent;
}

