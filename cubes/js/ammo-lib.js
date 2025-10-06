let AmmoLib;

export function setAmmo(ammo) {
    AmmoLib = ammo;
}

export function getAmmo() {
    if (!AmmoLib) {
        throw new Error("Ammo has not been initialized. Call setAmmo first.");
    }
    return AmmoLib;
}