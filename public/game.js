import * as THREE from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { physicsWorld } from './physics.js';
import * as RAPIER from '@dimforge/rapier3d-compat';

// Scene setup
const scene = new THREE.Scene();
scene.background = new THREE.Color(0x87ceeb); // Sky blue

// Camera
const camera = new THREE.PerspectiveCamera(75, window.innerWidth / window.innerHeight, 0.1, 1000);
camera.position.set(0, 50, 100);
camera.lookAt(0, 25, 0);

// Renderer
const renderer = new THREE.WebGLRenderer({ antialias: true });
renderer.setSize(window.innerWidth, window.innerHeight);
renderer.shadowMap.enabled = true;
renderer.shadowMap.type = THREE.PCFSoftShadowMap;
document.body.appendChild(renderer.domElement);

// Orbit Controls
const controls = new OrbitControls(camera, renderer.domElement);
controls.enableDamping = true;
controls.dampingFactor = 0.05;
controls.minDistance = 20;
controls.maxDistance = 200;
controls.maxPolarAngle = Math.PI / 2;
controls.enabled = false; // Start with orbit controls disabled

// Lights
const ambientLight = new THREE.AmbientLight(0xffffff, 0.6);
scene.add(ambientLight);

const dirLight = new THREE.DirectionalLight(0xffffff, 1.0);
dirLight.position.set(50, 100, 50);
dirLight.castShadow = true;
dirLight.shadow.mapSize.width = 2048;
dirLight.shadow.mapSize.height = 2048;
dirLight.shadow.camera.near = 0.5;
dirLight.shadow.camera.far = 500;
dirLight.shadow.camera.left = -100;
dirLight.shadow.camera.right = 100;
dirLight.shadow.camera.top = 100;
dirLight.shadow.camera.bottom = -100;
scene.add(dirLight);

// Initialize loader and car
const loader = new GLTFLoader();
let car = null;
let carBodyHandle = null;

// Car controls
const carControls = {
    forward: false,
    backward: false,
    left: false,
    right: false,
    brake: false
};

// Control mode
let isOrbitMode = false;

// Car physics properties
const carProperties = {
    maxSpeed: 30,
    acceleration: 50,
    turnSpeed: 3.0,
    brakeForce: 30
};

// Set up keyboard controls
function setupControls() {
    document.addEventListener('keydown', (event) => {
        switch(event.key.toLowerCase()) {
            case 'w':
                carControls.forward = true;
                break;
            case 's':
                carControls.backward = true;
                break;
            case 'a':
                carControls.left = true;
                break;
            case 'd':
                carControls.right = true;
                break;
            case ' ':
                carControls.brake = true;
                break;
            case 'c': // Toggle between car and orbit controls
                isOrbitMode = !isOrbitMode;
                controls.enabled = isOrbitMode;
                if (isOrbitMode && car && carBodyHandle) {
                    const body = physicsWorld.world.bodies.get(carBodyHandle);
                    if (body) {
                        const pos = body.translation();
                        controls.target.set(pos.x, pos.y + 1, pos.z);
                        camera.position.set(pos.x, pos.y + 20, pos.z + 30);
                    }
                }
                break;
        }
    });

    document.addEventListener('keyup', (event) => {
        switch(event.key.toLowerCase()) {
            case 'w':
                carControls.forward = false;
                break;
            case 's':
                carControls.backward = false;
                break;
            case 'a':
                carControls.left = false;
                break;
            case 'd':
                carControls.right = false;
                break;
            case ' ':
                carControls.brake = false;
                break;
        }
    });
}

// Update car physics based on controls
function updateCarPhysics() {
    if (!car || !carBodyHandle) return;
    
    const body = physicsWorld.world.bodies.get(carBodyHandle);
    if (!body) return;

    const pos = body.translation();
    const rot = body.rotation();

    // Reset if invalid
    if (!isFinite(pos.x) || !isFinite(pos.y) || !isFinite(pos.z)) {
        console.warn("Invalid car position detected, resetting position");
        body.setTranslation({ x: 0, y: 15, z: 0 }, true);
        body.setLinvel({ x: 0, y: 0, z: 0 }, true);
        body.setAngvel({ x: 0, y: 0, z: 0 }, true);
        return;
    }

    // Forward vector based on car's rotation
    const forward = new THREE.Vector3(0, 0, -1);
    const quaternion = new THREE.Quaternion(rot.x, rot.y, rot.z, rot.w);
    const rotatedForward = forward.clone().applyQuaternion(quaternion).normalize();

    let impulse = new THREE.Vector3(0, 0, 0);

    if (carControls.forward) {
        impulse.add(rotatedForward.clone().multiplyScalar(carProperties.acceleration * 1.0));
    }
    if (carControls.backward) {
        impulse.add(rotatedForward.clone().multiplyScalar(-carProperties.acceleration * 0.5));
    }

    if (carControls.left) {
        body.applyTorqueImpulse({ x: 0, y: carProperties.turnSpeed * 1.0, z: 0 }, true);
    }
    if (carControls.right) {
        body.applyTorqueImpulse({ x: 0, y: -carProperties.turnSpeed * 1.0, z: 0 }, true);
    }

    if (!impulse.equals(new THREE.Vector3(0, 0, 0))) {
        body.applyImpulse({ x: impulse.x, y: impulse.y, z: impulse.z }, true);
    }

    // Apply downforce to prevent flipping
    body.applyImpulse({ x: 0, y: -1.0, z: 0 }, true);

    // Update car mesh position and rotation
    car.position.set(pos.x, pos.y, pos.z);
    car.quaternion.set(rot.x, rot.y, rot.z, rot.w);
}

// Update camera to follow car
function updateCamera() {
    if (!car || !carBodyHandle) return;
    
    const body = physicsWorld.world.bodies.get(carBodyHandle);
    if (!body) return;
    
    // Get car's position and rotation
    const position = body.translation();
    const rotation = body.rotation();
    
    // Calculate camera offset (increased distance)
    const offset = new RAPIER.Vector3(0, 15, 30);
    const rotatedOffset = new RAPIER.Vector3(
        offset.x * (1 - 2 * rotation.y * rotation.y - 2 * rotation.z * rotation.z) +
        offset.y * (2 * rotation.x * rotation.y - 2 * rotation.w * rotation.z) +
        offset.z * (2 * rotation.x * rotation.z + 2 * rotation.w * rotation.y),
        
        offset.x * (2 * rotation.x * rotation.y + 2 * rotation.w * rotation.z) +
        offset.y * (1 - 2 * rotation.x * rotation.x - 2 * rotation.z * rotation.z) +
        offset.z * (2 * rotation.y * rotation.z - 2 * rotation.w * rotation.x),
        
        offset.x * (2 * rotation.x * rotation.z - 2 * rotation.w * rotation.y) +
        offset.y * (2 * rotation.y * rotation.z + 2 * rotation.w * rotation.x) +
        offset.z * (1 - 2 * rotation.x * rotation.x - 2 * rotation.y * rotation.y)
    );
    
    // Set camera position
    camera.position.set(
        position.x - rotatedOffset.x,
        position.y + rotatedOffset.y,
        position.z - rotatedOffset.z
    );
    
    // Look at car
    camera.lookAt(position.x, position.y + 1, position.z);
}

// Load landscape
function loadLandscape() {
    return new Promise((resolve, reject) => {
        const loader = new GLTFLoader();
        loader.load(
            'landscape.glb',
            (gltf) => {
                const model = gltf.scene;
                model.traverse((child) => {
                    if (child.isMesh) {
                        child.castShadow = true;
                        child.receiveShadow = true;
                        scene.add(child);

                        // Update world matrix to ensure correct transformations
                        child.updateMatrixWorld(true);
                        
                        // Convert to non-indexed geometry if needed
                        const geometry = child.geometry.index !== null
                            ? child.geometry.toNonIndexed()
                            : child.geometry;

                        geometry.computeVertexNormals();

                        // Extract transformed vertices
                        const positionAttr = geometry.attributes.position;
                        const vertices = [];
                        for (let i = 0; i < positionAttr.count; i++) {
                            const vertex = new THREE.Vector3();
                            vertex.fromBufferAttribute(positionAttr, i);
                            vertex.applyMatrix4(child.matrixWorld); // 🔥 apply world transform!
                            vertices.push(vertex.x, vertex.y, vertex.z);
                        }

                        // Create sequential indices for non-indexed geometry
                        const indices = [];
                        for (let i = 0; i < positionAttr.count; i++) {
                            indices.push(i);
                        }

                        const verticesArray = new Float32Array(vertices);
                        const indicesArray = new Uint32Array(indices);

                        // Create ground body + TriMesh collider
                        const groundBodyDesc = RAPIER.RigidBodyDesc.fixed();
                        const groundBody = physicsWorld.world.createRigidBody(groundBodyDesc);

                        const colliderDesc = RAPIER.ColliderDesc.trimesh(verticesArray, indicesArray);
                        physicsWorld.world.createCollider(colliderDesc, groundBody);

                        // Debug visualization
                        //child.material.wireframe = true;
                        //child.material.opacity = 0.5;
                        //child.material.transparent = true;

                        console.log('Created trimesh collider with', positionAttr.count, 'vertices');
                    }
                });
                console.log('Landscape loaded');
                resolve();
            },
            (xhr) => {
                console.log((xhr.loaded / xhr.total * 100) + '% loaded');
            },
            (error) => {
                console.error('Error loading landscape:', error);
                reject(error);
            }
        );
    });
}

// Load car model
function loadCar() {
    return new Promise((resolve, reject) => {
        loader.load(
            'car2.glb',
            (gltf) => {
                car = gltf.scene;
                
                // Enable shadows
                car.traverse((child) => {
                    if (child.isMesh) {
                        child.castShadow = true;
                        child.receiveShadow = true;
                    }
                });
                
                // Position car
                car.position.set(0, 2, 0);
                scene.add(car);
                
                // Create physics body for car
                const boundingBox = new THREE.Box3().setFromObject(car);
                const size = new THREE.Vector3();
                boundingBox.getSize(size);
                const center = new THREE.Vector3();
                boundingBox.getCenter(center);
                
                // Create physics body
                const bodyDesc = RAPIER.RigidBodyDesc.dynamic()
                    .setTranslation(center.x, center.y, center.z)
                    .setLinearDamping(0.5)
                    .setAngularDamping(0.5)
                    .setCanSleep(true)
                    .setCcdEnabled(true); // Enable continuous collision detection
                
                const body = physicsWorld.world.createRigidBody(bodyDesc);
                
                // Create collider
                const colliderDesc = RAPIER.ColliderDesc.cuboid(size.x / 2, size.y / 2, size.z / 2)
                    .setRestitution(0.2)
                    .setFriction(0.8)
                    .setDensity(1.0);
                
                physicsWorld.world.createCollider(colliderDesc, body);
                
                carBodyHandle = body.handle;
                
                console.log('Car loaded with physics');
                resolve();
            },
            (xhr) => {
                console.log((xhr.loaded / xhr.total * 100) + '% loaded');
            },
            (error) => {
                console.error('Error loading car:', error);
                reject(error);
            }
        );
    });
}

// Create a physics sphere
function createPhysicsSphere(color = 0xff0000, position = { x: 0, y: 20, z: 0 }) {
    const radius = 2; // Consistent radius for both visual and physics
    
    // Create the visual sphere
    const geometry = new THREE.SphereGeometry(radius, 32, 32);
    const material = new THREE.MeshPhongMaterial({ 
        color: color,
        shininess: 100,
        specular: 0x444444,
        emissive: color,
        emissiveIntensity: 0.2
    });
    const sphere = new THREE.Mesh(geometry, material);
    sphere.castShadow = true;
    sphere.receiveShadow = true;
    
    // Position the sphere
    sphere.position.set(position.x, position.y, position.z);
    scene.add(sphere);
    
    // Add a point light to each sphere
    const sphereLight = new THREE.PointLight(color, 1, 10);
    sphereLight.position.set(position.x, position.y, position.z);
    scene.add(sphereLight);
    
    // Create physics body with matching radius
    const rigidBodyHandle = physicsWorld.createSphereBody(position, radius);
    
    // Add debug helper
    const helper = new THREE.BoxHelper(sphere, 0xffff00);
    scene.add(helper);
    
    return {
        mesh: sphere,
        rigidBodyHandle,
        light: sphereLight,
        helper: helper
    };
}

// Start the game
let spheres = [];

// Safe wrapper to remove rigid bodies
function safeRemoveRigidBody(handle) {
    physicsWorld.removeRigidBody(handle);
}

// Update car position based on physics
function updateCar() {
    if (car && carBodyHandle) {
        const state = physicsWorld.getBodyState(carBodyHandle);
        if (state) {
            car.position.set(
                state.position.x,
                state.position.y,
                state.position.z
            );
            
            car.quaternion.set(
                state.rotation.x,
                state.rotation.y,
                state.rotation.z,
                state.rotation.w
            );
        }
    }
}

// Animation loop
function animate() {
    requestAnimationFrame(animate);
    
    try {
        // Step physics simulation
        physicsWorld.step();
        
        // Update car physics
        updateCarPhysics();
        
        // Update car position
        updateCar();
        
        // Update camera based on current mode
        if (isOrbitMode) {
            // Update orbit controls target to follow car
            if (car && carBodyHandle) {
                const body = physicsWorld.world.bodies.get(carBodyHandle);
                if (body) {
                    const pos = body.translation();
                    controls.target.set(pos.x, pos.y + 1, pos.z);
                }
            }
            controls.update();
        } else {
            // Use car follow camera
            updateCamera();
        }
        
        // Update sphere positions and rotations
        spheres.forEach((sphere, index) => {
            try {
                const state = physicsWorld.getBodyState(sphere.rigidBodyHandle);
                if (state) {
                    sphere.mesh.position.set(
                        state.position.x,
                        state.position.y,
                        state.position.z
                    );
                    
                    sphere.mesh.quaternion.set(
                        state.rotation.x,
                        state.rotation.y,
                        state.rotation.z,
                        state.rotation.w
                    );
                    
                    if (sphere.light) {
                        sphere.light.position.copy(sphere.mesh.position);
                    }
                    
                    if (sphere.helper) {
                        sphere.helper.update();
                    }
                }
            } catch (error) {
                console.error(`Error updating sphere ${index}:`, error);
            }
        });
    } catch (err) {
        console.error('Physics step error:', err);
    }
    
    renderer.render(scene, camera);
}

// Initialize physics and create game objects
physicsWorld.init().then(async () => {
    try {
        // Set up controls
        setupControls();
        
        // Load landscape first
        await loadLandscape();
        
        // Load car
        await loadCar();
        
        // Create spheres after a delay
        setTimeout(() => {
            try {
                spheres.push(createPhysicsSphere(0xff0000, { x: -10, y: 30, z: 0 }));
                spheres.push(createPhysicsSphere(0x0000ff, { x: 0, y: 30, z: 10 }));
                spheres.push(createPhysicsSphere(0x00ff00, { x: 10, y: 30, z: -10 }));
                spheres.push(createPhysicsSphere(0xffff00, { x: 0, y: 30, z: 0 }));
                
                console.log('Created', spheres.length, 'spheres with physics');
                
                spheres.forEach((sphere, index) => {
                    const pos = sphere.mesh.position;
                    console.log(`Sphere ${index} initial position:`, pos);
                });
            } catch (error) {
                console.error('Error creating spheres:', error);
            }
        }, 1000);
        
        animate();
    } catch (error) {
        console.error('Error during initialization:', error);
    }
});

// Cleanup on page unload
window.addEventListener('beforeunload', () => {
    physicsWorld.cleanup();
});