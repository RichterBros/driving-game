import * as RAPIER from '@dimforge/rapier3d-compat';

let world;

export const physicsWorld = {
    async init() {
        await RAPIER.init();
        
        const gravity = new RAPIER.Vector3(0, -9.81, 0);
        world = new RAPIER.World(gravity);
        this.world = world;
        
        return this;
    },

    step() {
        if (world) {
            world.step();
        }
    },

    createGroundCuboid({ width = 100, height = 1, depth = 100, position = { x: 0, y: -1, z: 0 } } = {}) {
        if (!world) return;

        const groundBodyDesc = RAPIER.RigidBodyDesc.fixed().setTranslation(position.x, position.y, position.z);
        const groundBody = world.createRigidBody(groundBodyDesc);

        const groundColliderDesc = RAPIER.ColliderDesc.cuboid(width / 2, height / 2, depth / 2)
            .setRestitution(0.1)
            .setFriction(1.0);
        world.createCollider(groundColliderDesc, groundBody);

        return groundBody.handle;
    },

    createSphereBody(position, radius = 2) {
        if (!world) return null;

        const bodyDesc = RAPIER.RigidBodyDesc.dynamic()
            .setTranslation(position.x, position.y, position.z)
            .setLinearDamping(0.01)
            .setAngularDamping(0.01)
            .setCanSleep(true)
            .setCcdEnabled(true);

        const body = world.createRigidBody(bodyDesc);

        const colliderDesc = RAPIER.ColliderDesc.ball(radius)
            .setRestitution(0.6)
            .setFriction(0.4)
            .setDensity(1.0);

        world.createCollider(colliderDesc, body);

        return body.handle;
    },

    getBodyState(handle) {
        if (!world || !world.bodies.contains(handle)) return null;

        const body = world.bodies.get(handle);
        const pos = body.translation();
        const rot = body.rotation();

        return {
            position: { x: pos.x, y: pos.y, z: pos.z },
            rotation: { x: rot.x, y: rot.y, z: rot.z, w: rot.w }
        };
    },

    containsBody(handle) {
        return world && world.bodies.contains(handle);
    },

    removeRigidBody(handle) {
        if (world && world.bodies.contains(handle)) {
            world.removeRigidBody(world.bodies.get(handle), true);
        }
    },

    cleanup() {
        if (world) {
            world.free();
            world = null;
            this.world = null;
        }
    }
}; 