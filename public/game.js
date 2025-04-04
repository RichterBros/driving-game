import * as THREE from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { physicsWorld } from './physics.js';
import * as RAPIER from '@dimforge/rapier3d-compat';
// Socket.IO will be loaded via script tag in HTML

// Scene setup
const scene = new THREE.Scene();
scene.background = new THREE.Color(0x87ceeb); // Sky blue

// Camera
const camera = new THREE.PerspectiveCamera(75, window.innerWidth / window.innerHeight, 0.1, 1000);
camera.position.set(0, 100, 200); // Increased height and distance for better visibility
camera.lookAt(0, 0, 0);

// Add grid helper for better spatial awareness
const gridHelper = new THREE.GridHelper(100, 20);
scene.add(gridHelper);

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
controls.maxDistance = 500;
controls.maxPolarAngle = Math.PI / 2;
controls.enabled = true; // Enable controls by default for debugging

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
let groundBodyHandle = null;

// Car controls
const carControls = {
    w: false,
    s: false,
    a: false,
    d: false,
    f: false,
    space: false
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

// Global variables for multiplayer
let socket;
let playerId;
const otherPlayers = {}; // Store other players' cars
let myPlayerId = null;

// Add after the scene setup, before the socket initialization
// Player count display
const playerCountDiv = document.createElement('div');
playerCountDiv.style.position = 'absolute';
playerCountDiv.style.top = '10px';
playerCountDiv.style.right = '10px';
playerCountDiv.style.color = 'white';
playerCountDiv.style.fontFamily = 'Arial';
playerCountDiv.style.fontSize = '20px';
playerCountDiv.style.backgroundColor = 'rgba(0, 0, 0, 0.5)';
playerCountDiv.style.padding = '10px';
playerCountDiv.style.borderRadius = '5px';
document.body.appendChild(playerCountDiv);

// Update the player count display
function updatePlayerCount() {
    const otherPlayerCount = Object.keys(otherPlayers).length;
    const totalPlayers = otherPlayerCount + 1; // +1 for local player
    console.log('Updating player count:', {
        otherPlayers: otherPlayerCount,
        totalPlayers: totalPlayers,
        playerIds: Object.keys(otherPlayers)
    });
    playerCountDiv.textContent = `Players in game: ${totalPlayers}`;
}

// Initialize socket connection
function initSocket() {
    console.log('🔄 CORE DEBUG: Initializing socket connection...');
    socket = io('http://localhost:3000');

    socket.on('connect', () => {
        console.log('🔄 CORE DEBUG: Connected to server with ID:', socket.id);
        console.log('🔄 CORE DEBUG: Socket connected status:', socket.connected);
        myPlayerId = socket.id;
        updatePlayerCount();
    });

    socket.on('connect_error', (error) => {
        console.error('Socket connection error:', error);
    });

    socket.on('disconnect', (reason) => {
        console.log('Disconnected from server:', reason);
    });

    socket.on('initialize', (data) => {
        console.log('🔄 CORE DEBUG: Game initialized with data:', data);
        myPlayerId = data.id;
        console.log('🔄 CORE DEBUG: My player ID SET TO:', myPlayerId);
        
        // Create cars for existing players
        let playerIndex = 0;
        for (const id in data.players) {
            if (id !== myPlayerId) {
                console.log('🔄 CORE DEBUG: Another player is already in the game:', id);
                console.log('🔄 CORE DEBUG: Player data:', data.players[id]);
                createOtherPlayerCar({
                    id: id,
                    position: data.players[id].position,
                    rotation: data.players[id].rotation,
                    index: playerIndex++
                });
            }
        }
        updatePlayerCount();
    });

    socket.on('playerJoined', (playerData) => {
        if (playerData.id !== myPlayerId) {
            console.log('Another player joined the game:', playerData.id);
            console.log('Player data:', playerData);
            createOtherPlayerCar({
                ...playerData,
                index: Object.keys(otherPlayers).length
            });
            updatePlayerCount();
        }
    });

    socket.on('playerMoved', (data) => {
        console.log('🔄 UPDATE DEBUG: Received playerMoved event for player:', data.id);
        
        const otherPlayer = otherPlayers[data.id];
        
        if (!otherPlayer) {
            console.warn('🔄 UPDATE DEBUG: Could not find remote player for update:', data.id);
            console.log('🔄 UPDATE DEBUG: Available remote players:', Object.keys(otherPlayers));
            return;
        }
        
        if (!data.position) {
            console.warn('🔄 UPDATE DEBUG: No position data received for player:', data.id);
            return;
        }
        
        // Get previous position for logging
        const oldPos = otherPlayer.mesh ? otherPlayer.mesh.position.clone() : null;
        
        // Update the mesh position and rotation
        if (otherPlayer.mesh) {
            otherPlayer.mesh.position.set(
                data.position.x,
                data.position.y,
                data.position.z
            );
            
            if (data.rotation) {
                otherPlayer.mesh.quaternion.set(
                    data.rotation.x,
                    data.rotation.y,
                    data.rotation.z,
                    data.rotation.w
                );
            }
            
            console.log('🔄 UPDATE DEBUG: Updated remote car position from', 
                oldPos ? `(${oldPos.x.toFixed(2)}, ${oldPos.y.toFixed(2)}, ${oldPos.z.toFixed(2)})` : 'unknown',
                'to', 
                `(${data.position.x.toFixed(2)}, ${data.position.y.toFixed(2)}, ${data.position.z.toFixed(2)})`
            );
        }
        
        // Update the physics body if it exists
        if (otherPlayer.body) {
            otherPlayer.body.setTranslation(data.position, true);
            if (data.rotation) {
                otherPlayer.body.setRotation(data.rotation, true);
            }
        }
    });

    socket.on('playerLeft', (id) => {
        if (otherPlayers[id]) {
            scene.remove(otherPlayers[id].mesh);
            physicsWorld.world.removeRigidBody(otherPlayers[id].body);
            delete otherPlayers[id];
            console.log('Player left the game:', id);
            updatePlayerCount();
        }
    });

    socket.on('ping', (data) => {
        const latency = Date.now() - data.time;
        console.log(`🔄 PING DEBUG: Received ping from server, latency: ${latency}ms`);
        
        // Log player positions to confirm they're being tracked
        if (car) {
            console.log('🔄 PING DEBUG: Local car position:', 
                car.position.x.toFixed(2), 
                car.position.y.toFixed(2), 
                car.position.z.toFixed(2)
            );
        }
        
        // List all remote players we know about
        console.log('🔄 PING DEBUG: Remote players:', Object.keys(otherPlayers).length);
        for (const id in otherPlayers) {
            const player = otherPlayers[id];
            if (player && player.mesh) {
                console.log(`🔄 PING DEBUG: Remote player ${id} position:`, 
                    player.mesh.position.x.toFixed(2),
                    player.mesh.position.y.toFixed(2),
                    player.mesh.position.z.toFixed(2)
                );
            }
        }
        
        // Confirm scene structure
        console.log('🔄 PING DEBUG: Scene children count:', scene.children.length);
    });
}

// Update mesh positions from physics bodies with enhanced debugging
let updateCounter = 0;
function updateMeshPositionsFromPhysics() {
    // Log periodically to avoid spamming
    updateCounter++;
    if (updateCounter % 60 === 0) {
        console.log("📣 updateMeshPositionsFromPhysics() is running - count:", updateCounter);
    }
    
    // Only log position updates every ~5 seconds
    const shouldLog = Math.random() < 0.01;
    
    // Update local car position
    if (car && carBodyHandle) {
        const body = physicsWorld.world.bodies.get(carBodyHandle);
        if (body) {
            const pos = body.translation();
            const rot = body.rotation();
            
            car.position.set(pos.x, pos.y, pos.z);
            car.quaternion.set(rot.x, rot.y, rot.z, rot.w);

            // Send position update to server every frame
            if (socket && myPlayerId) {
                if (shouldLog) {
                    console.log("📤 SENDING DEBUG: Emitting position update for local player:", {
                        id: myPlayerId,
                        socketConnected: socket.connected,
                        pos: `(${pos.x.toFixed(2)}, ${pos.y.toFixed(2)}, ${pos.z.toFixed(2)})`
                    });
                }
                
                const positionData = {
                    id: myPlayerId,
                    position: { x: pos.x, y: pos.y, z: pos.z },
                    rotation: { x: rot.x, y: rot.y, z: rot.z, w: rot.w }
                };
                socket.emit('updatePosition', positionData);
            } else {
                if (shouldLog) {
                    console.warn("⚠️ SENDING DEBUG: Cannot emit position update:", {
                        socket: !!socket,
                        myPlayerId: myPlayerId
                    });
                }
            }
        }
    }

    // Update other players' positions
    for (const id in otherPlayers) {
        const otherPlayer = otherPlayers[id];
        
        // Update both temporary and permanent cars
        if (otherPlayer && otherPlayer.mesh) {
            if (otherPlayer.body) {
                const pos = otherPlayer.body.translation();
                const rot = otherPlayer.body.rotation();
                
                otherPlayer.mesh.position.set(pos.x, pos.y, pos.z);
                otherPlayer.mesh.quaternion.set(rot.x, rot.y, rot.z, rot.w);
                
                if (shouldLog) {
                    console.log(`🔄 UPDATE DEBUG: Updated remote player ${id} position from physics:`, 
                        pos.x.toFixed(2), pos.y.toFixed(2), pos.z.toFixed(2));
                }
            }
        }
    }

    // Update bullets
    for (let i = bullets.length - 1; i >= 0; i--) {
        const bullet = bullets[i];
        if (bullet.body && bullet.mesh) {
            const pos = bullet.body.translation();
            const rot = bullet.body.rotation();
            
            bullet.mesh.position.set(pos.x, pos.y, pos.z);
            bullet.mesh.quaternion.set(rot.x, rot.y, rot.z, rot.w);
            
            const now = Date.now();
            if (now - bullet.spawnTime > BULLET_LIFETIME || 
                Math.abs(pos.x) > 1000 || 
                Math.abs(pos.y) > 1000 || 
                Math.abs(pos.z) > 1000) {
                removeBullet(bullet);
            }
        }
    }
}

// Create another player's car - simplified version with enhanced debugging
function createOtherPlayerCar(playerData) {
    console.log('🚨 CORE DEBUG: Creating remote car for player:', playerData.id);
    console.log('🚨 CORE DEBUG: Scene children count BEFORE:', scene.children.length);
    
    // Create a simple box for immediate visibility
    const color = playerData.index % 2 === 0 ? 0xff0000 : 0x0000ff; // red or blue
    const geo = new THREE.BoxGeometry(4, 2, 8);
    const mat = new THREE.MeshStandardMaterial({ color });
    const tempMesh = new THREE.Mesh(geo, mat);
    tempMesh.castShadow = true;
    tempMesh.receiveShadow = true;
    
    // Set initial position
    const position = {
        x: playerData.position?.x ?? 0,
        y: playerData.position?.y ?? 2,
        z: playerData.position?.z ?? 0
    };
    
    tempMesh.position.set(position.x, position.y, position.z);
    
    // Add temporary mesh to scene
    scene.add(tempMesh);
    console.log('🚨 CORE DEBUG: Scene children count AFTER adding tempMesh:', scene.children.length);
    console.log('🚨 CORE DEBUG: Added temporary car at position:', position);
    
    // Store the temp mesh
    otherPlayers[playerData.id] = { 
        mesh: tempMesh,
        isTemporary: true
    };
    
    console.log('🚨 CORE DEBUG: Stored remote player with ID:', playerData.id);
    console.log('🚨 CORE DEBUG: otherPlayers keys:', Object.keys(otherPlayers));
    
    // SKIP GLTF LOADING FOR TESTING - Just use the box mesh temporarily
    console.log('🚨 CORE DEBUG: SKIPPING GLTF loading for debugging - using box mesh');
    otherPlayers[playerData.id] = {
        mesh: tempMesh,
        isTemporary: false
    };
    
    // ADD FORCED ANIMATION to remote car to confirm visibility
    console.log('🚨 CORE DEBUG: Adding forced animation to remote car');
    setInterval(() => {
        const other = otherPlayers[playerData.id];
        if (other && other.mesh) {
            const pos = other.mesh.position;
            pos.y += Math.sin(Date.now() / 500) * 0.1; // Bounce up and down
            pos.x += 0.05; // Slowly move right
            console.log(`🚨 FORCED ANIMATION: Moving remote car ${playerData.id} to:`, 
                pos.x.toFixed(2), pos.y.toFixed(2), pos.z.toFixed(2));
        } else {
            console.warn('🚨 FORCED ANIMATION: Cannot find remote car:', playerData.id);
        }
    }, 1000);
    
    // Add debug interval to monitor positions
    if (!window.positionDebugInterval) {
        window.positionDebugInterval = setInterval(() => {
            console.log('📊 POSITION DEBUG: ---- Remote Player Positions ----');
            for (const id in otherPlayers) {
                const remotePlayer = otherPlayers[id];
                if (remotePlayer && remotePlayer.mesh) {
                    console.log(`📍 Remote player ${id} at position:`, 
                        remotePlayer.mesh.position.x.toFixed(2), 
                        remotePlayer.mesh.position.y.toFixed(2), 
                        remotePlayer.mesh.position.z.toFixed(2)
                    );
                }
            }
            console.log('📊 POSITION DEBUG: ---- Scene Information ----');
            console.log('📊 POSITION DEBUG: Total scene children:', scene.children.length);
            console.log('📊 POSITION DEBUG: Total other players:', Object.keys(otherPlayers).length);
            
            // Check if car is visible and at the right position
            if (car) {
                console.log('📊 POSITION DEBUG: Local car position:', 
                    car.position.x.toFixed(2), 
                    car.position.y.toFixed(2), 
                    car.position.z.toFixed(2)
                );
            }
        }, 2000);
    }
    
    updatePlayerCount();
}

// Set up keyboard controls
function setupControls() {
    document.addEventListener('keydown', (event) => {
        switch(event.key.toLowerCase()) {
            case 'w':
                carControls.w = true;
                break;
            case 's':
                carControls.s = true;
                break;
            case 'a':
                carControls.a = true;
                break;
            case 'd':
                carControls.d = true;
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
            case 'f': // Flip car
                carControls.f = true;
                flipCar();
                break;
            case ' ': // Spacebar for shooting
                carControls.space = true;
                fireBullet();
                break;
        }
    });

    document.addEventListener('keyup', (event) => {
        switch(event.key.toLowerCase()) {
            case 'w':
                carControls.w = false;
                break;
            case 's':
                carControls.s = false;
                break;
            case 'a':
                carControls.a = false;
                break;
            case 'd':
                carControls.d = false;
                break;
            case 'f':
                carControls.f = false;
                break;
            case ' ':
                carControls.space = false;
                break;
        }
    });
}

// Function to flip the car back over
function flipCar() {
    if (!car || !carBodyHandle) return;
    
    const body = physicsWorld.world.bodies.get(carBodyHandle);
    if (!body) return;

    // Get car's current orientation
    const rot = body.rotation();
    const quaternion = new THREE.Quaternion(rot.x, rot.y, rot.z, rot.w);
    const up = new THREE.Vector3(0, 1, 0);
    const carUp = new THREE.Vector3(0, 1, 0).applyQuaternion(quaternion);
    
    // Check if car is upside down (dot product < 0)
    if (up.dot(carUp) < 0) {
        // Apply upward force and rotation to flip the car
        const pos = body.translation();
        
        // Stop current movement
        body.setLinvel({ x: 0, y: 0, z: 0 }, true);
        body.setAngvel({ x: 0, y: 0, z: 0 }, true);
        
        // Lift the car slightly
        body.setTranslation({ x: pos.x, y: pos.y + 2, z: pos.z }, true);
        
        // Apply rotation to right the car
        const targetRotation = new THREE.Quaternion().setFromEuler(
            new THREE.Euler(0, quaternion.y, 0)
        );
        body.setRotation(targetRotation, true);
        
        console.log("Flipping car back over");
    }
}

// Update car physics based on controls
function updateCarPhysics() {
    if (!car || !carBodyHandle) {
        console.log("Car or carBodyHandle not initialized");
        return;
    }
    
    const body = physicsWorld.world.bodies.get(carBodyHandle);
    if (!body) {
        console.log("Could not get physics body for car");
        return;
    }

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

    // Get current velocity and angular velocity
    const linvel = body.linvel();
    const angvel = body.angvel();

    // Limit angular velocity to prevent excessive spinning
    const maxAngularVelocity = 3.0; // Reduced from 5.0
    if (Math.abs(angvel.x) > maxAngularVelocity || 
        Math.abs(angvel.y) > maxAngularVelocity || 
        Math.abs(angvel.z) > maxAngularVelocity) {
        const scale = maxAngularVelocity / Math.max(
            Math.abs(angvel.x),
            Math.abs(angvel.y),
            Math.abs(angvel.z)
        );
        body.setAngvel({
            x: angvel.x * scale,
            y: angvel.y * scale,
            z: angvel.z * scale
        }, true);
    }

    // Forward vector based on car's rotation
    const forward = new THREE.Vector3(0, 0, 1); // +Z is forward
    const quaternion = new THREE.Quaternion(rot.x, rot.y, rot.z, rot.w);
    const rotatedForward = forward.clone().applyQuaternion(quaternion).normalize();

    let impulse = new THREE.Vector3(0, 0, 0);

    if (carControls.w) {
        console.log("W key pressed - applying forward impulse");
        impulse.add(rotatedForward.clone().multiplyScalar(8000.0)); // Increased from 800.0
    }
    if (carControls.s) {
        console.log("S key pressed - applying backward impulse");
        impulse.add(rotatedForward.clone().multiplyScalar(-5000.0)); // Increased from -500.0
    }

    // Apply stabilizing torque to keep car upright
    const up = new THREE.Vector3(0, 1, 0);
    const carUp = new THREE.Vector3(0, 1, 0).applyQuaternion(quaternion);
    const cross = new THREE.Vector3().crossVectors(up, carUp);
    const stabilizationTorque = cross.multiplyScalar(100.0); // Increased from 50.0

    if (carControls.a) {
        console.log("A key pressed - applying left turn");
        body.applyTorqueImpulse({ x: 0, y: 5000.0, z: 0 }, true); // Reduced from 500.0
    }
    if (carControls.d) {
        console.log("D key pressed - applying right turn");
        body.applyTorqueImpulse({ x: 0, y: -5000.0, z: 0 }, true); // Reduced from -500.0
    }

    // Apply stabilization torque
    body.applyTorqueImpulse({
        x: stabilizationTorque.x,
        y: stabilizationTorque.y,
        z: stabilizationTorque.z
    }, true);

    if (!impulse.equals(new THREE.Vector3(0, 0, 0))) {
        console.log("Applying impulse:", impulse);
        body.applyImpulse({ x: impulse.x, y: impulse.y, z: impulse.z }, true);
    }

    // Update car mesh position and rotation
    car.position.set(pos.x, pos.y, pos.z);
    car.quaternion.set(rot.x, rot.y, rot.z, rot.w);
}

// Update camera to follow car
function updateCamera() {
    if (!car || !carBodyHandle) return;
    
    const body = physicsWorld.world.bodies.get(carBodyHandle);
    if (!body) return;
    
    const pos = body.translation();
    
    // Calculate camera position
    const cameraOffset = new THREE.Vector3(0, 20, 30);
    const cameraPosition = new THREE.Vector3(
        pos.x + cameraOffset.x,
        pos.y + cameraOffset.y,
        pos.z + cameraOffset.z
    );
    
    // Smoothly move camera
    camera.position.lerp(cameraPosition, 0.1);
    camera.lookAt(pos.x, pos.y + 2, pos.z);
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

                        // Remove old ground body if it exists
                        if (groundBodyHandle) {
                            const oldBody = physicsWorld.world.bodies.get(groundBodyHandle);
                            if (oldBody) {
                                physicsWorld.world.removeRigidBody(oldBody);
                            }
                        }

                        // Create ground body + TriMesh collider
                        const groundBodyDesc = RAPIER.RigidBodyDesc.fixed();
                        const groundBody = physicsWorld.world.createRigidBody(groundBodyDesc);

                        const colliderDesc = RAPIER.ColliderDesc.trimesh(verticesArray, indicesArray);
                        physicsWorld.world.createCollider(colliderDesc, groundBody);

                        groundBodyHandle = groundBody.handle;

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

// Function to reload landscape
function reloadLandscape() {
    return new Promise((resolve, reject) => {
        // Remove old landscape meshes from scene
        scene.traverse((child) => {
            if (child.isMesh && child !== car) {
                scene.remove(child);
            }
        });

        // Load new landscape
        loadLandscape()
            .then(() => {
                console.log('Landscape reloaded successfully');
                resolve();
            })
            .catch((error) => {
                console.error('Error reloading landscape:', error);
                reject(error);
            });
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
                
                console.log("Creating car physics body with size:", size);
                
                // Create physics body with improved stability settings
                const bodyDesc = RAPIER.RigidBodyDesc.dynamic()
                    .setTranslation(center.x, center.y, center.z)
                    .setLinearDamping(0.3)
                    .setAngularDamping(0.8)
                    .setCanSleep(false)
                    .setCcdEnabled(true)
                    .setGravityScale(1.2);
                
                const body = physicsWorld.world.createRigidBody(bodyDesc);
                if (!body) {
                    console.error("Failed to create physics body for car");
                    reject(new Error("Failed to create physics body"));
                    return;
                }
                
                carBodyHandle = body.handle;
                console.log('Car physics body created with handle:', carBodyHandle);
                
                // Create collider with improved stability settings
                const colliderDesc = RAPIER.ColliderDesc.cuboid(size.x / 2, size.y / 2, size.z / 2)
                    .setRestitution(0.1)
                    .setFriction(0.95)
                    .setDensity(50.0);
                
                physicsWorld.world.createCollider(colliderDesc, body);
                
                console.log('Car loaded with physics, handle:', carBodyHandle);
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
let bullets = []; // Add this near the top with other global variables
const MAX_BULLETS = 100; // Maximum number of bullets in the scene
const BULLET_SPEED = 100.0; // Speed of bullets
const BULLET_LIFETIME = 3000; // Bullet lifetime in milliseconds

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

// Function to create and fire a bullet
function fireBullet() {
    if (!car || !carBodyHandle) return;
    
    const body = physicsWorld.world.bodies.get(carBodyHandle);
    if (!body) return;

    // Get car's position and rotation
    const pos = body.translation();
    const rot = body.rotation();
    
    // Create bullet geometry and material
    const bulletGeometry = new THREE.SphereGeometry(0.2, 8, 8);
    const bulletMaterial = new THREE.MeshBasicMaterial({ color: 0xff0000 });
    const bulletMesh = new THREE.Mesh(bulletGeometry, bulletMaterial);
    
    // Position bullet at the front of the car
    const forward = new THREE.Vector3(0, 0, 1);
    const quaternion = new THREE.Quaternion(rot.x, rot.y, rot.z, rot.w);
    const rotatedForward = forward.clone().applyQuaternion(quaternion).normalize();
    
    // Calculate bullet spawn position (slightly in front of the car)
    const spawnPos = {
        x: pos.x + rotatedForward.x * 2,
        y: pos.y + 0.5,
        z: pos.z + rotatedForward.z * 2
    };
    
    bulletMesh.position.set(spawnPos.x, spawnPos.y, spawnPos.z);
    scene.add(bulletMesh);
    
    // Create physics body for bullet
    const bulletBodyDesc = RAPIER.RigidBodyDesc.dynamic()
        .setTranslation(spawnPos.x, spawnPos.y, spawnPos.z)
        .setLinearDamping(0.0)
        .setAngularDamping(0.0);
    
    const bulletBody = physicsWorld.world.createRigidBody(bulletBodyDesc);
    
    const bulletColliderDesc = RAPIER.ColliderDesc.ball(0.2)
        .setRestitution(0.2)
        .setFriction(0.0)
        .setDensity(0.1);
    
    physicsWorld.world.createCollider(bulletColliderDesc, bulletBody);
    
    // Apply initial velocity in the direction the car is facing
    const velocity = {
        x: rotatedForward.x * BULLET_SPEED,
        y: rotatedForward.y * BULLET_SPEED,
        z: rotatedForward.z * BULLET_SPEED
    };
    bulletBody.setLinvel(velocity, true);
    
    // Store bullet data
    const bullet = {
        mesh: bulletMesh,
        body: bulletBody,
        spawnTime: Date.now()
    };
    
    bullets.push(bullet);
    
    // Remove oldest bullet if we've reached the maximum
    if (bullets.length > MAX_BULLETS) {
        removeBullet(bullets[0]);
    }
}

// Function to remove a bullet
function removeBullet(bullet) {
    if (!bullet) return;
    
    // Remove from physics world
    physicsWorld.world.removeRigidBody(bullet.body);
    
    // Remove from scene
    scene.remove(bullet.mesh);
    
    // Remove from bullets array
    const index = bullets.indexOf(bullet);
    if (index !== -1) {
        bullets.splice(index, 1);
    }
}

// Update bullets in animation loop
function updateBullets() {
    const currentTime = Date.now();
    
    // Update each bullet
    bullets.forEach((bullet, index) => {
        // Update bullet position
        const pos = bullet.body.translation();
        bullet.mesh.position.set(pos.x, pos.y, pos.z);
        
        // Remove bullet if it's too old
        if (currentTime - bullet.spawnTime > BULLET_LIFETIME) {
            removeBullet(bullet);
        }
    });
}

// Update controls based on keyboard input
function updateControls() {
    if (!car || !carBodyHandle) return;

    const body = physicsWorld.world.bodies.get(carBodyHandle);
    if (!body) return;

    // Get current velocity and angular velocity
    const linvel = body.linvel();
    const angvel = body.angvel();

    // Limit angular velocity to prevent excessive spinning
    const maxAngularVelocity = 3.0;
    if (Math.abs(angvel.x) > maxAngularVelocity || 
        Math.abs(angvel.y) > maxAngularVelocity || 
        Math.abs(angvel.z) > maxAngularVelocity) {
        const scale = maxAngularVelocity / Math.max(
            Math.abs(angvel.x),
            Math.abs(angvel.y),
            Math.abs(angvel.z)
        );
        body.setAngvel({
            x: angvel.x * scale,
            y: angvel.y * scale,
            z: angvel.z * scale
        }, true);
    }

    // Get car's rotation
    const rot = body.rotation();
    const quaternion = new THREE.Quaternion(rot.x, rot.y, rot.z, rot.w);

    // Forward vector based on car's rotation
    const forward = new THREE.Vector3(0, 0, 1);
    const rotatedForward = forward.clone().applyQuaternion(quaternion).normalize();

    let impulse = new THREE.Vector3(0, 0, 0);

    if (carControls.w) {
        impulse.add(rotatedForward.clone().multiplyScalar(8000.0));
    }
    if (carControls.s) {
        impulse.add(rotatedForward.clone().multiplyScalar(-5000.0));
    }

    // Apply stabilizing torque to keep car upright
    const up = new THREE.Vector3(0, 1, 0);
    const carUp = new THREE.Vector3(0, 1, 0).applyQuaternion(quaternion);
    const cross = new THREE.Vector3().crossVectors(up, carUp);
    const stabilizationTorque = cross.multiplyScalar(100.0);

    if (carControls.a) {
        body.applyTorqueImpulse({ x: 0, y: 5000.0, z: 0 }, true);
    }
    if (carControls.d) {
        body.applyTorqueImpulse({ x: 0, y: -5000.0, z: 0 }, true);
    }

    // Apply stabilization torque
    body.applyTorqueImpulse({
        x: stabilizationTorque.x,
        y: stabilizationTorque.y,
        z: stabilizationTorque.z
    }, true);

    if (!impulse.equals(new THREE.Vector3(0, 0, 0))) {
        body.applyImpulse({ x: impulse.x, y: impulse.y, z: impulse.z }, true);
    }
}

// Apply forces to the car based on physics
function applyCarForces() {
    if (!car || !carBodyHandle) return;

    const body = physicsWorld.world.bodies.get(carBodyHandle);
    if (!body) return;

    // Get car's current position and rotation
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

    // Get current velocity
    const linvel = body.linvel();
    const speed = Math.sqrt(linvel.x * linvel.x + linvel.z * linvel.z);

    // Apply drag force (air resistance)
    const dragForce = 0.1;
    const drag = {
        x: -linvel.x * dragForce,
        y: -linvel.y * dragForce,
        z: -linvel.z * dragForce
    };
    body.applyImpulse(drag, true);

    // Apply gravity
    const gravity = { x: 0, y: -9.81, z: 0 };
    body.applyImpulse(gravity, true);

    // Apply ground friction
    if (pos.y < 1.0) { // If car is close to ground
        const friction = 0.5;
        const frictionForce = {
            x: -linvel.x * friction,
            y: 0,
            z: -linvel.z * friction
        };
        body.applyImpulse(frictionForce, true);
    }
}

// Function to create a debug box next to the car
function createDebugBox() {
    // Create a simple red box
    const geometry = new THREE.BoxGeometry(4, 4, 4);
    const material = new THREE.MeshBasicMaterial({ color: 0xff0000, wireframe: true });
    const debugBox = new THREE.Mesh(geometry, material);
    
    // Position it next to the player's car
    if (car) {
        debugBox.position.set(
            car.position.x + 10, 
            car.position.y + 5,
            car.position.z
        );
    } else {
        debugBox.position.set(10, 5, 0);
    }
    
    // Add to scene
    scene.add(debugBox);
    console.log('🟥 DEBUG: Added red debug box to scene at position:', debugBox.position);
    console.log('🟥 DEBUG: Scene children count after adding box:', scene.children.length);
    
    // Create an update function to keep the box near the car
    function updateDebugBox() {
        if (car) {
            debugBox.position.set(
                car.position.x + 10,
                car.position.y + 5,
                car.position.z
            );
        }
        requestAnimationFrame(updateDebugBox);
    }
    
    // Start updating the debug box
    updateDebugBox();
    
    return debugBox;
}

// Modify the animate function to confirm it's running
function animate() {
    requestAnimationFrame(animate);

    // Add a one-time log to confirm animate is running
    if (!window.animateConfirmed) {
        console.log('🔄 CORE DEBUG: Animate function is running');
        window.animateConfirmed = true;
    }

    try {
        // 1. Handle input and game logic
        updateControls();

        // 2. Apply forces or impulses to bodies
        applyCarForces();

        // 3. Step physics
        if (physicsWorld && physicsWorld.world) {
            try {
                physicsWorld.step();
            } catch (error) {
                console.error("Physics step error:", error);
                return;
            }
        }

        // 4. Update mesh positions from physics
        updateMeshPositionsFromPhysics();

        // 5. Update camera
        updateCamera();

        // 6. Render
        renderer.render(scene, camera);
    } catch (error) {
        console.error("Error in animation loop:", error);
    }
}

// Modify the initialization to include socket setup
physicsWorld.init().then(async () => {
    try {
        initSocket(); // Initialize socket connection
        setupControls();
        await loadLandscape();
        await loadCar();
        
        // Create debug box after car is loaded
        const debugBox = createDebugBox();
        console.log('🟥 DEBUG: Debug box created:', debugBox);
        
        animate();
    } catch (error) {
        console.error('Error during initialization:', error);
    }
});

// Cleanup on page unload
window.addEventListener('beforeunload', () => {
    physicsWorld.cleanup();
});