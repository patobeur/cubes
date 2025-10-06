import { getTmpCache } from './config.js';
import { getAmmo } from './ammo-lib.js';

let physicsWorld;
let rigidBodies = [];
let TMP;

export function initPhysics() {
    const AmmoLib = getAmmo();
    TMP = getTmpCache();
    const collisionConfiguration = new AmmoLib.btDefaultCollisionConfiguration();
    const dispatcher = new AmmoLib.btCollisionDispatcher(collisionConfiguration);
    const broadphase = new AmmoLib.btDbvtBroadphase();
    const solver = new AmmoLib.btSequentialImpulseConstraintSolver();
    physicsWorld = new AmmoLib.btDiscreteDynamicsWorld(
        dispatcher,
        broadphase,
        solver,
        collisionConfiguration
    );
    physicsWorld.setGravity(new AmmoLib.btVector3(0, -9.81, 0));
    return physicsWorld;
}

export function getPhysicsWorld() {
    return physicsWorld;
}

export function getRigidBodies() {
    return rigidBodies;
}

export function createRigidBody(mesh, shape, mass = 0, pos = mesh.position, quat = mesh.quaternion) {
    const AmmoLib = getAmmo();
    const transform = new AmmoLib.btTransform();
    transform.setIdentity();
    transform.setOrigin(new AmmoLib.btVector3(pos.x, pos.y, pos.z));
    transform.setRotation(new AmmoLib.btQuaternion(quat.x, quat.y, quat.z, quat.w));
    const motionState = new AmmoLib.btDefaultMotionState(transform);
    const localInertia = new AmmoLib.btVector3(0, 0, 0);
    if (mass > 0) shape.calculateLocalInertia(mass, localInertia);
    const rbInfo = new AmmoLib.btRigidBodyConstructionInfo(
        mass,
        motionState,
        shape,
        localInertia
    );
    const body = new AmmoLib.btRigidBody(rbInfo);
    body.setFriction(0.9);
    body.setRollingFriction(0.2);
    body.setDamping(0.3, 0.5);
    physicsWorld.addRigidBody(body);
    mesh.userData.physicsBody = body;
    mesh.userData.shape = shape;
    mesh.castShadow = true;
    mesh.receiveShadow = true;
    if (mass > 0) rigidBodies.push(mesh);

    AmmoLib.destroy(rbInfo);
    AmmoLib.destroy(localInertia);

    return body;
}

export function setVelocity(body, vx, vy, vz) {
    TMP.vA.setValue(vx, vy, vz);
    if (typeof body.setLinearVelocity === "function") {
        body.setLinearVelocity(TMP.vA);
    } else {
        const k = 0.2; // gain
        TMP.vB.setValue(vx * k, vy * k, vz * k);
        body.applyCentralImpulse(TMP.vB);
    }
    if (typeof body.activate === "function") body.activate();
}

export function kickBody(body, vec3) {
    try {
        if (typeof body.applyCentralImpulse === "function") {
            body.applyCentralImpulse(vec3);
            return;
        }
        if (typeof body.applyImpulse === "function") {
            const zero = TMP.vB;
            zero.setValue(0, 0, 0);
            body.applyImpulse(vec3, zero);
            return;
        }
        if (typeof body.setLinearVelocity === "function") {
            body.setLinearVelocity(vec3);
            return;
        }
        if (typeof body.applyCentralForce === "function") {
            body.applyCentralForce(vec3);
            if (typeof body.activate === "function") body.activate();
        }
    } catch (e) {
        console.warn(e);
    }
}