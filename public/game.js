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
camera.position.set(0, 30, 50);
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
controls.maxDistance = 100;
controls.maxPolarAngle = Math.PI / 2;
controls.target.set(0, 0, 0);

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

// Load landscape
function loadLandscape() {
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
        },
        (xhr) => {
            console.log((xhr.loaded / xhr.total * 100) + '% loaded');
        },
        (error) => {
            console.error('Error loading landscape:', error);
        }
    );
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

// Animation loop
function animate() {
    requestAnimationFrame(animate);

    try {
        // Step physics simulation
        physicsWorld.step();

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
                    
                    // Update debug helper
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

    controls.update();
    renderer.render(scene, camera);
}

// Initialize physics and create spheres
physicsWorld.init().then(() => {
    loadLandscape();
    
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
});

// Cleanup on page unload
window.addEventListener('beforeunload', () => {
    physicsWorld.cleanup();
});
