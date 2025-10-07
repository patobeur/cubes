import * as THREE from "three";
import { getScene } from "./scene.js";

const DOTTED_LINE_POOL_SIZE = 50;
const dottedLinePool = [];
let scene;

export function initEffects() {
    scene = getScene();
    const dotGeometry = new THREE.CircleGeometry(0.15, 8);
    const dotMaterial = new THREE.MeshBasicMaterial({ color: 0xffffff });

    for (let i = 0; i < DOTTED_LINE_POOL_SIZE; i++) {
        const dot = new THREE.Mesh(dotGeometry, dotMaterial);
        dot.rotation.x = -Math.PI / 2; // Lay flat on the ground
        dot.visible = false;
        scene.add(dot);
        dottedLinePool.push(dot);
    }
}

// A map to store active lines, one per agent
const activeLines = new Map();

export function updateDottedLine(agent, startPos, endPos) {
    if (!activeLines.has(agent)) {
        activeLines.set(agent, { usedDots: 0 });
    }
    const line = activeLines.get(agent);

    const direction = new THREE.Vector3().subVectors(endPos, startPos);
    const distance = direction.length();
    direction.normalize();

    const dotSpacing = 1.0;
    const numDots = Math.floor(distance / dotSpacing);

    let poolIndex = 0;
    // Find the starting index in the pool for this agent's line
    for (const [key, value] of activeLines.entries()) {
        if (key === agent) break;
        poolIndex += value.usedDots;
    }

    for (let i = 0; i < numDots; i++) {
        if (poolIndex >= DOTTED_LINE_POOL_SIZE) break; // Pool exhausted

        const dot = dottedLinePool[poolIndex];
        const pos = startPos.clone().add(direction.clone().multiplyScalar(i * dotSpacing));
        pos.y = 0.1; // Slightly above ground
        dot.position.copy(pos);
        dot.visible = true;
        poolIndex++;
    }

    // Hide the previously used dots for this line if they are no longer needed
    for (let i = numDots; i < line.usedDots; i++) {
         if (poolIndex >= DOTTED_LINE_POOL_SIZE) break;
         dottedLinePool[poolIndex].visible = false;
         poolIndex++;
    }

    line.usedDots = numDots;
}

export function hideDottedLine(agent) {
    if (!activeLines.has(agent)) return;

    const line = activeLines.get(agent);
    let poolIndex = 0;
    for (const [key, value] of activeLines.entries()) {
        if (key === agent) break;
        poolIndex += value.usedDots;
    }

    for (let i = 0; i < line.usedDots; i++) {
        if (poolIndex >= DOTTED_LINE_POOL_SIZE) break;
        dottedLinePool[poolIndex].visible = false;
        poolIndex++;
    }
    line.usedDots = 0;
    activeLines.delete(agent);
}