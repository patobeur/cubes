import * as THREE from "three";
import { getRoles, getTmpCache, RES_PICK, RES_HEAL } from "./config.js";
import { setVelocity } from "./physics.js";
import { getAmmo } from "./ammo-lib.js";
import { getHouses } from "./faction.js";

let TMP;
let HOUSES = [];
let ROLES;

export function initAI() {
	TMP = getTmpCache();
	HOUSES = getHouses();
	ROLES = getRoles();
}

function isGrounded(a) {
	a.body.getMotionState().getWorldTransform(TMP.trans);
	const y = TMP.trans.getOrigin().y();
	const vy = a.body.getLinearVelocity().y?.() || 0;
	return y <= 0.55 && Math.abs(vy) < 0.7;
}

function steerWander(a, dt) {
	a.turnT -= dt;
	if (a.turnT <= 0) {
		a.turnT = 0.3 + Math.random() * 0.5;
		a.headingDeg =
			(a.headingDeg + (Math.random() * 2 - 1) * a.turnRate * 0.3 + 360) %
			360;
	}
	const rad = (a.headingDeg * Math.PI) / 180;
	const ax = Math.sin(rad),
		az = Math.cos(rad);
	const vx = ax * a.speed,
		vz = az * a.speed;

	if (a.isLocked) {
		keepAnchored(a);
		return;
	}
	setVelocity(a.body, vx, 0, vz);
}

function steerSeek(a, target, dt) {
	const dir = new THREE.Vector3().subVectors(target, a.mesh.position);
	dir.y = 0;
	const d = dir.length();
	if (d > 0.0001) dir.normalize();

	const desiredDeg = (Math.atan2(dir.x, dir.z) * 180) / Math.PI;
	let delta = desiredDeg - a.headingDeg;
	delta = ((delta + 540) % 360) - 180;

	const maxTurn = a.turnRate * dt;
	delta = Math.max(-maxTurn, Math.min(maxTurn, delta));
	a.headingDeg = (a.headingDeg + delta + 360) % 360;

	const rad = (a.headingDeg * Math.PI) / 180;
	const ax = Math.sin(rad),
		az = Math.cos(rad);
	const speed = a.speed * (d > 1 ? 1 : Math.max(0.2, d));

	if (a.isLocked) {
		keepAnchored(a);
		return;
	}
	setVelocity(a.body, ax * speed, 0, az * speed);
}

function keepInside(a) {
	const lim = 400 * 0.5 - 1.0; // PLANE_SIZE
	const p = a.mesh.position;
	if (Math.abs(p.x) > lim || Math.abs(p.z) > lim) {
		const dirToCenter = (Math.atan2(-p.x, -p.z) * 180) / Math.PI;
		a.headingDeg = (dirToCenter + 360) % 360;
	}
}

function keepAnchored(a) {
	const AmmoLib = getAmmo();
	if (!a.anchor)
		a.anchor = new THREE.Vector3(a.mesh.position.x, 0.5, a.mesh.position.z);

	const b = a.body;
	const tr = TMP.trans;
	b.getMotionState().getWorldTransform(tr);
	tr.setOrigin(
		new AmmoLib.btVector3(a.anchor.x, a.anchor.y ?? 0.5, a.anchor.z)
	);

	if (typeof b.setWorldTransform === "function") b.setWorldTransform(tr);
	else if (typeof b.setCenterOfMassTransform === "function")
		b.setCenterOfMassTransform(tr);
}

function nearestResource(pos, resources) {
	let best = null,
		bd = Infinity;
	for (const r of resources) {
		const d = pos.distanceTo(r.pos);
		if (d < bd) {
			bd = d;
			best = r;
		}
	}
	return [best, bd];
}

function findClosestFactionMember(agent, allAgents) {
	let closestDist = Infinity;
	let closestMember = null;
	for (const other of allAgents) {
		if (other === agent || other.faction !== agent.faction) continue;
		const d = agent.mesh.position.distanceTo(other.mesh.position);
		if (d < closestDist) {
			closestDist = d;
			closestMember = other;
		}
	}
	return [closestMember, closestDist];
}

export function updateAgentAI(a, dt, resources, removeResource, agents) {
	a.grounded = isGrounded(a);
	if (!a.grounded) return;

	a.hp -= 0.5 * dt;
	if (a.hp < 0) a.hp = 0;

	// --- Determine Agent State ---
	const roleInfo = ROLES[a.role];
	const maxDist = roleInfo.distances.max_distance_entre_membre_de_meme_faction;
	const [closestAlly, allyDist] = findClosestFactionMember(a, agents);
	const isIsolated = !closestAlly || allyDist > maxDist;

	// State transition logic (higher numbers are higher priority)
	// 1. (Safety) Regroup if isolated, unless already returning with resource
	if (isIsolated && a.state !== "return_with_resource") {
		a.state = "return_for_regroup";
	}
	// 2. (Objective) Return resource if gatherer has one
	else if (a.role === "ramasseur" && a.hasResource) {
		a.state = "return_with_resource";
	}
	// 3. (Needs) Seek resource if gatherer is low on HP
	else if (
		a.role === "ramasseur" &&
		a.hp < 50 &&
		resources.length > 0 &&
		a.state !== "return_for_regroup" // Don't seek if regrouping
	) {
		a.state = "seek_resource";
	}
	// 4. (Default) Wander if not doing anything else important
	else if (
		a.state !== "seek_resource" &&
		a.state !== "return_for_regroup"
	) {
		a.state = "wander";
	}

	// --- Execute Behavior based on State ---
	const house = HOUSES.find((h) => h.id === a.faction);

	switch (a.state) {
		case "wander":
			steerWander(a, dt);
			break;

		case "seek_resource":
			const [res, d] = nearestResource(a.mesh.position, resources);
			if (res) {
				steerSeek(a, res.pos, dt);
				if (d < RES_PICK) {
					a.hasResource = true;
					removeResource(res);
					a.state = "return_with_resource"; // Immediately head back
				}
			} else {
				a.state = "wander"; // No resources found, wander
			}
			break;

		case "return_with_resource":
			if (house) {
				steerSeek(a, house.mesh.position, dt);
				const distToHouse = a.mesh.position.distanceTo(house.mesh.position);
				if (distToHouse < 7) {
					// Drop off distance
					a.hasResource = false;
					a.hp = Math.min(66, a.hp + RES_HEAL);
					a.state = "wander"; // Dropped off, now wander
				}
			} else {
				a.state = "wander"; // Failsafe
			}
			break;

		case "return_for_regroup":
			if (house) {
				steerSeek(a, house.mesh.position, dt);
				const distToHouse = a.mesh.position.distanceTo(house.mesh.position);
				// If we are no longer isolated, or we've reached the base, we can stop.
				if (!isIsolated || distToHouse < 10) {
					a.state = "wander";
				}
			} else {
				a.state = "wander"; // Failsafe
			}
			break;
	}

	keepInside(a);
}