import * as THREE from "three";
import {
	getRoles,
	getTmpCache,
	RES_PICK,
	RES_HEAL,
	GATHERER_FLEE_DISTANCE,
} from "./config.js";
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

function findFactionGatherer(agent, allAgents) {
	for (const other of allAgents) {
		if (other.faction === agent.faction && other.role === "ramasseur") {
			return other;
		}
	}
	return null;
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

function findClosestEnemy(agent, allAgents) {
	let closestDist = Infinity;
	let closestEnemy = null;
	for (const other of allAgents) {
		if (other.faction === agent.faction) continue;
		const d = agent.mesh.position.distanceTo(other.mesh.position);
		if (d < closestDist) {
			closestDist = d;
			closestEnemy = other;
		}
	}
	return [closestEnemy, closestDist];
}

export function updateAgentAI(a, dt, resources, removeResource, agents) {
	a.grounded = isGrounded(a);
	if (!a.grounded) return;

	a.hp -= 0.5 * dt;
	if (a.hp < 0) a.hp = 0;

	const roleInfo = ROLES[a.role];
	const house = HOUSES.find((h) => h.id === a.faction);

	// --- Determine Agent State ---
	if (a.role === "ramasseur") {
		const [closestEnemy, enemyDist] = findClosestEnemy(a, agents);
		const [closestAlly, allyDist] = findClosestFactionMember(a, agents);
		const isIsolated =
			!closestAlly ||
			allyDist >
				roleInfo.distances.max_distance_entre_membre_de_meme_faction;

		// Priority 1: Flee from enemies
		if (closestEnemy && enemyDist < GATHERER_FLEE_DISTANCE) {
			a.state = "flee";
		}
		// Priority 2: Regroup if isolated
		else if (isIsolated && a.state !== "return_with_resource") {
			a.state = "return_for_regroup";
		}
		// Priority 3: Return resource if carrying one
		else if (a.hasResource) {
			a.state = "return_with_resource";
		}
		// Priority 4: Seek resource if available
		else if (resources.length > 0) {
			a.state = "seek_resource";
		}
		// Priority 5: Wander if nothing else to do
		else {
			a.state = "wander";
		}
	} else {
		// Non-gatherers protect their faction's gatherer.
		const gatherer = findFactionGatherer(a, agents);
		if (gatherer) {
			if (
				a.mesh.position.distanceTo(gatherer.mesh.position) >
				roleInfo.distances.vue
			) {
				a.state = "follow_gatherer";
				a.target = gatherer;
			} else {
				a.state = "wander";
			}
		} else {
			// No gatherer, fall back to general cohesion.
			const [closestAlly, allyDist] = findClosestFactionMember(a, agents);
			if (
				!closestAlly ||
				allyDist >
					roleInfo.distances.max_distance_entre_membre_de_meme_faction
			) {
				a.state = "return_for_regroup";
			} else {
				a.state = "wander";
			}
		}
	}

	// --- Execute Behavior based on State ---
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
					a.state = "return_with_resource";
				}
			} else {
				a.state = "wander";
			}
			break;

		case "return_with_resource":
			if (house) {
				steerSeek(a, house.mesh.position, dt);
				if (a.mesh.position.distanceTo(house.mesh.position) < 7) {
					a.hasResource = false;
					a.hp = Math.min(66, a.hp + RES_HEAL);
					a.state = "wander";
				}
			} else {
				a.state = "wander";
			}
			break;

		case "return_for_regroup":
			if (house) {
				steerSeek(a, house.mesh.position, dt);
				const [closestAlly, allyDist] = findClosestFactionMember(a, agents);
				if (
					!closestAlly ||
					allyDist >
						roleInfo.distances.max_distance_entre_membre_de_meme_faction
				) {
					if (a.mesh.position.distanceTo(house.mesh.position) < 10) {
						a.state = "wander";
					}
				} else {
					a.state = "wander";
				}
			} else {
				a.state = "wander";
			}
			break;

		case "flee":
			const [closestAlly, allyDist] = findClosestFactionMember(a, agents);
			let retreatTarget = house.mesh.position;

			if (closestAlly) {
				if (allyDist < a.mesh.position.distanceTo(house.mesh.position)) {
					retreatTarget = closestAlly.mesh.position;
				}
			}

			steerSeek(a, retreatTarget, dt);

			const [enemy, enemyDist] = findClosestEnemy(a, agents);
			if (!enemy || enemyDist > GATHERER_FLEE_DISTANCE * 1.2) {
				a.state = "wander"; // Cooldown from fleeing
			}
			break;

		case "follow_gatherer":
			if (a.target && a.target.hp > 0) {
				steerSeek(a, a.target.mesh.position, dt);
				if (
					a.mesh.position.distanceTo(a.target.mesh.position) <
					roleInfo.distances.vue * 0.8
				) {
					a.state = "wander";
					a.target = null;
				}
			} else {
				a.state = "wander";
				a.target = null;
			}
			break;
	}

	keepInside(a);
}
