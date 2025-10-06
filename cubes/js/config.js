import * as THREE from "three";
import { getAmmo } from "./ammo-lib.js";

// ----------------------
// CONSTANTES & CACHES
// ----------------------

export const MAX_PIXEL_RATIO = 1.5; // éviter VRAM élevée

// Géométries partagées (évite de dupliquer les buffers)
export const GEOS = {
	box: new THREE.BoxGeometry(1, 1, 1),
	palette: new THREE.BoxGeometry(0.8, 0.2, 0.8),
	pyramid: new THREE.CylinderGeometry(0, 0.7, 1, 4),
	sphere: new THREE.SphereGeometry(0.5, 24, 16),
	ground: null, // créé plus bas avec la bonne taille
};

// 4 factions (couleurs uniques)
export const FACTIONS = [
	{ id: 0, name: "Aqua", color: 0x49b6ff },
	{ id: 1, name: "Ember", color: 0xff6b57 },
	{ id: 2, name: "Moss", color: 0x57e389 },
	{ id: 3, name: "Amethyst", color: 0xb085ff },
];

// Skills => Pouvoirs disponibles
export const SKILLS = {
	tir: {
		lv: 1,
		distance: 10,
		effet: { malus: { degats: 5, repeat: false } },
		rayon: false,
		duree: false,
		energie: 5,
		rechargement: 5,
	},
	bouclier: {
		lv: 1,
		distance: 0,
		effet: { bonus: { def: 20, repeat: false } },
		rayon: 8,
		duree: 5,
		energie: 20,
		rechargement: 5,
	},
	soin: {
		lv: 1,
		distance: 0,
		effet: { bonus: { vie: 5, repeat: 1 } },
		rayon: 6,
		duree: 5,
		energie: 20,
		rechargement: 5,
	},
};

// Rôles
export function getRoles() {
	const AmmoLib = getAmmo();
	return {
		ramasseur: {
			playable_by_user: false, // pour plus tard
			def: 5,
			mass: 1.6,
			speed: 1.5,
			energie: 99,
			distances: {
				vue: 30,
				max_distance_entre_membre_de_meme_faction: 15, // distance max des autres membre de la faction s'il en reste
			},
			turn: 110,
			makeMesh: () => GEOS.box,
			makeShape: () =>
				new AmmoLib.btBoxShape(new AmmoLib.btVector3(0.5, 0.5, 0.5)),
		},
		tank: {
			playable_by_user: true, // pour plus tard
			def: 10,
			mass: 1.6,
			speed: 2.0,
			energie: 99,
			distances: {
				vue: 20,
				max_distance_entre_membre_de_meme_faction: 20, // distance max des autres membre de la faction s'il en reste
			},
			turn: 110,
			makeMesh: () => GEOS.box,
			makeShape: () =>
				new AmmoLib.btBoxShape(new AmmoLib.btVector3(0.5, 0.5, 0.5)),
		},
		dps: {
			playable_by_user: true, // pour plus tard
			def: 6,
			mass: 1.0,
			speed: 3.0,
			energie: 99,
			distances: {
				vue: 30,
				max_distance_entre_membre_de_meme_faction: 20, // distance max des autres membre de la faction s'il en reste
			},
			turn: 160,
			makeMesh: () => GEOS.box,
			makeShape: () =>
				new AmmoLib.btBoxShape(new AmmoLib.btVector3(0.5, 0.5, 0.5)),
		},
		healer: {
			playable_by_user: true, // pour plus tard
			def: 5,
			mass: 0.8,
			speed: 2.4,
			energie: 99,
			distances: {
				vue: 25,
				max_distance_entre_membre_de_meme_faction: 20, // distance max des autres membre de la faction s'il en reste
			},
			turn: 180,
			makeMesh: () => GEOS.box,
			makeShape: () =>
				new AmmoLib.btBoxShape(new AmmoLib.btVector3(0.5, 0.5, 0.5)),
		},
	};
}

// Constantes pour les ressources
export const RES_COLOR = 0xff3b30;
export const RES_R = 0.2;
export const RES_PICK = 0.7;
export const RES_HEAL = 20;
export const INITIAL_RESOURCES = 12;
export const RESOURCE_SPAWN_RADIUS = 50;

// Constantes du monde
export const PLANE_SIZE = 400;
export const SPAWN_RADIUS = 6;

// Caches temporaires pour éviter les allocations
export function getTmpCache() {
	const AmmoLib = getAmmo();
	return {
		trans: new AmmoLib.btTransform(),
		vA: new AmmoLib.btVector3(0, 0, 0),
		vB: new AmmoLib.btVector3(0, 0, 0),
		one: new AmmoLib.btVector3(1, 1, 1),
		zero: new AmmoLib.btVector3(0, 0, 0),
		angY: new AmmoLib.btVector3(0, 1, 0),
	};
}

export const T3 = {
	v1: new THREE.Vector3(),
	v2: new THREE.Vector3(),
	q1: new THREE.Quaternion(),
};
