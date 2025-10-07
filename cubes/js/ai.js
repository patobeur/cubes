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
import { getScene } from "./scene.js";
import { setHatColor } from "./agent.js";
import { checkAndRespawnResources } from "./world.js";
import { updateDottedLine, hideDottedLine } from "./effects.js";

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

		// Gatherers should not consider other gatherers as enemies
		if (agent.role === 'ramasseur' && other.role === 'ramasseur') {
			continue;
		}

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
		const isIsolated =
			!findClosestFactionMember(a, agents)[0] ||
			findClosestFactionMember(a, agents)[1] >
				roleInfo.distances.max_distance_entre_membre_de_meme_faction;

		// Priority 1: Flee from enemies
		if (closestEnemy && enemyDist < GATHERER_FLEE_DISTANCE) {
			if (a.collectionTarget) hideDottedLine(a);
			a.isCollecting = false; // Stop collecting if fleeing
			a.collectionTarget = null;
			a.state = "flee";
		}
		// Priority 2: Return resource if carrying some and not currently collecting
		else if (a.carriedResourceAmount > 0 && !a.isCollecting) {
			a.state = "return_with_resource";
		}
		// Priority 3: Continue collecting if already doing so
		else if (a.isCollecting) {
			a.state = "collect_resource";
		}
		// Priority 4: Seek resource if not carrying anything and resources are available
		else if (a.carriedResourceAmount === 0 && resources.length > 0) {
			a.state = "seek_resource";
		}
		// Priority 5: Regroup if isolated and has nothing else to do
		else if (isIsolated) {
			a.state = "return_for_regroup";
		}
		// Priority 6: Wander if not isolated and nothing else to do
		else {
			a.state = "wander";
		}
	} else {
		// Non-gatherers reactively protect their faction's gatherer.
		const gatherer = findFactionGatherer(a, agents);
		let threatToGatherer = null;
		if (gatherer && gatherer.hp > 0) {
			const [threat, threatDistToGatherer] = findClosestEnemy(gatherer, agents);
			const PROTECTION_RADIUS = 25; // Define a radius around the gatherer

			if (threat && threatDistToGatherer < PROTECTION_RADIUS) {
				threatToGatherer = threat;
			}
		}

		// Priority 1: Intercept threats to the gatherer
		if (threatToGatherer) {
			a.state = "intercept_threat";
			a.target = threatToGatherer;
		}
		// Priority 2: Fall back to general cohesion if no threat
		else {
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
			if (!a.collectionTarget) {
				const [res, d] = nearestResource(a.mesh.position, resources);
				if (res) {
					a.collectionTarget = res;
				} else {
					a.state = "wander";
					break;
				}
			}

			if (a.collectionTarget) {
				if (a.collectionTarget.size <= 0) {
					hideDottedLine(a);
					a.collectionTarget = null;
					a.state = "seek_resource";
					break;
				}

				updateDottedLine(a, a.mesh.position, a.collectionTarget.pos);
				steerSeek(a, a.collectionTarget.pos, dt);
				const d = a.mesh.position.distanceTo(a.collectionTarget.pos);
				if (d < RES_PICK + 2.0) {
					hideDottedLine(a);
					a.isCollecting = true;
					a.state = "collect_resource";
				}
			}
			break;

		case "collect_resource":
			if (!a.collectionTarget || a.collectionTarget.size <= 0) {
				hideDottedLine(a);
				a.isCollecting = false;
				a.collectionTarget = null;
				a.state = a.carriedResourceAmount > 0 ? "return_with_resource" : "seek_resource";
				break;
			}

			// Must be close to the resource to collect
			if (a.mesh.position.distanceTo(a.collectionTarget.pos) > RES_PICK + 2.5) {
				// Too far, stop collecting and go back to seeking it
				a.isCollecting = false;
				a.state = "seek_resource";
				break;
			}

			setVelocity(a.body, 0, 0, 0);
			const dir = new THREE.Vector3().subVectors(a.collectionTarget.pos, a.mesh.position);
			a.headingDeg = (Math.atan2(dir.x, dir.z) * 180) / Math.PI;

			const collectionRate = 10; // 10 units per second
			const amountToCollect = collectionRate * dt;
			const actualCollected = Math.min(amountToCollect, a.collectionTarget.size);

			a.carriedResourceAmount += actualCollected;
			a.collectionTarget.size -= actualCollected;

			// Update visuals
			const sourceScale = Math.max(0.01, a.collectionTarget.size / 100.0);
			a.collectionTarget.mesh.scale.set(sourceScale, sourceScale, sourceScale);

			a.carriedResourceMesh.material.visible = true;
			const carriedScale = 0.1 + (a.carriedResourceAmount / 100.0) * 1.2;
			a.carriedResourceMesh.scale.set(carriedScale, carriedScale, carriedScale);

			if (a.collectionTarget.size <= 0) {
				getScene().remove(a.collectionTarget.mesh);
				removeResource(a.collectionTarget);
				a.isCollecting = false;
				a.collectionTarget = null;
				a.state = "return_with_resource";
			}

			// Agent decides to return home if it has collected a decent amount
			if (a.carriedResourceAmount >= 100) {
				 a.isCollecting = false;
				 a.state = "return_with_resource";
			}

			break;

		case "return_with_resource":
			if (house) {
				steerSeek(a, house.mesh.position, dt);
				if (a.mesh.position.distanceTo(house.mesh.position) < 7) {
					// This fixes the resource drop-off bug
					house.storedResources += a.carriedResourceAmount;

					a.carriedResourceAmount = 0;

					// Hide and reset the carried resource mesh
					a.carriedResourceMesh.material.visible = false;
					a.carriedResourceMesh.scale.set(0.1, 0.1, 0.1);

					a.state = "seek_resource";

					// Check if we need to spawn more resources
					checkAndRespawnResources();
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

		case "intercept_threat":
			if (a.target && a.target.hp > 0) {
				steerSeek(a, a.target.mesh.position, dt);
				// (A more advanced implementation would have combat logic here)
				// For now, they just move towards the threat.
				// If the threat is dead or moves away, the state will change on the next tick.
			} else {
				a.state = "wander";
				a.target = null;
			}
			break;
	}

	keepInside(a);
}
