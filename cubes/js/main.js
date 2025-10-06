import * as THREE from "three";
import { setAmmo } from './ammo-lib.js';
import { initScene, getScene, getCamera, getRenderer, getControls, clampCameraAboveGround } from './scene.js';
import { initPhysics, getPhysicsWorld, getRigidBodies } from './physics.js';
import { initAgents, spawnAgent, getAgents, updateAgent, faceMotion, updateHat } from './agent.js';
import { createWorld, getResources, removeResource } from './world.js';
import { SPAWN_RADIUS, getTmpCache } from './config.js';

Ammo().then((AmmoLib) => {
    // Stocker l'instance d'Ammo pour un accès global
    setAmmo(AmmoLib);

    // ----------------------
    // INITIALISATION
    // ----------------------
    const { scene, camera, renderer, controls } = initScene();
    const physicsWorld = initPhysics();
    initAgents();
    createWorld();

    const TMP = getTmpCache();

    // Population initiale
    for (let f = 0; f < 4; f++) {
        spawnAgent("tank", f, (Math.random() - 0.5) * SPAWN_RADIUS, 7, (Math.random() - 0.5) * SPAWN_RADIUS);
        spawnAgent("dps", f, (Math.random() - 0.5) * SPAWN_RADIUS, 8, (Math.random() - 0.5) * SPAWN_RADIUS);
        spawnAgent("healer", f, (Math.random() - 0.5) * SPAWN_RADIUS, 9, (Math.random() - 0.5) * SPAWN_RADIUS);
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
            updateAgent(a, dt, resources, removeResource);
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