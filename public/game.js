// Three.js setup
const scene = new THREE.Scene();
const camera = new THREE.PerspectiveCamera(75, window.innerWidth / window.innerHeight, 0.1, 1000);
const renderer = new THREE.WebGLRenderer({ antialias: true }); // Added antialias for smoother graphics
renderer.setSize(window.innerWidth, window.innerHeight);
renderer.setClearColor(0x87ceeb); // Set sky blue background color
document.body.appendChild(renderer.domElement);

// Error handling for Three.js
if (!renderer) {
    console.error('Failed to create WebGL renderer');
}

// Socket.IO setup with error handling
let socket;
try {
    socket = io('http://localhost:3000', {
        transports: ['websocket'],
        reconnection: true,
        reconnectionAttempts: 5,
        reconnectionDelay: 1000
    });
} catch (error) {
    console.error('Failed to create Socket.IO connection:', error);
}

// Add connection status logging and game state initialization
if (socket) {
    socket.on('connect', () => {
        console.log('Connected to server with ID:', socket.id);
        // Request current game state when connected
        socket.emit('requestGameState');
    });

    socket.on('connect_error', (error) => {
        console.error('Connection error:', error);
    });

    socket.on('error', (error) => {
        console.error('Socket error:', error);
    });

    socket.on('disconnect', (reason) => {
        console.log('Disconnected from server:', reason);
    });

    socket.on('reconnect', (attemptNumber) => {
        console.log('Reconnected to server after', attemptNumber, 'attempts');
        // Request game state again after reconnection
        socket.emit('requestGameState');
    });

    // Handle initial game state
    socket.on('gameState', (gameState) => {
        console.log('Received game state:', gameState);
        // Clear existing players
        Object.keys(players).forEach(id => {
            if (players[id]) {
                scene.remove(players[id]);
                delete players[id];
            }
        });

        // Add all players from the game state
        if (gameState.players) {
            Object.keys(gameState.players).forEach(id => {
                if (id !== socket.id) {
                    addPlayer(id, gameState.players[id]);
                }
            });
        }

        // Update player count
        if (document.getElementById('playerCount')) {
            document.getElementById('playerCount').textContent = Object.keys(gameState.players || {}).length;
        }
    });
}

// Lighting with error checking
const ambientLight = new THREE.AmbientLight(0xffffff, 1.0);
const directionalLight = new THREE.DirectionalLight(0xffffff, 1.0);
directionalLight.position.set(0, 20, 10);

if (!ambientLight || !directionalLight) {
    console.error('Failed to create lights');
} else {
    scene.add(ambientLight);
    scene.add(directionalLight);
}

// Track
const trackRadius = 30;
const trackWidth = 10;
const trackGeometry = new THREE.RingGeometry(trackRadius - trackWidth/2, trackRadius + trackWidth/2, 32);
const trackMaterial = new THREE.MeshStandardMaterial({ color: 0x666666 });
const track = new THREE.Mesh(trackGeometry, trackMaterial);
track.rotation.x = -Math.PI / 2;
scene.add(track);

// Add track borders
const innerBorderGeometry = new THREE.TorusGeometry(trackRadius - trackWidth/2, 0.5, 16, 32);
const outerBorderGeometry = new THREE.TorusGeometry(trackRadius + trackWidth/2, 0.5, 16, 32);
const borderMaterial = new THREE.MeshStandardMaterial({ color: 0xffffff });
const innerBorder = new THREE.Mesh(innerBorderGeometry, borderMaterial);
const outerBorder = new THREE.Mesh(outerBorderGeometry, borderMaterial);
innerBorder.rotation.x = Math.PI / 2;
outerBorder.rotation.x = Math.PI / 2;
scene.add(innerBorder);
scene.add(outerBorder);

// Add buildings
function createBuilding(x, z, width, height, depth) {
    const buildingGeometry = new THREE.BoxGeometry(width, height, depth);
    const buildingMaterial = new THREE.MeshStandardMaterial({ 
        color: Math.random() * 0xffffff,
        roughness: 0.7
    });
    const building = new THREE.Mesh(buildingGeometry, buildingMaterial);
    building.position.set(x, height/2, z);
    scene.add(building);
}

// Create buildings around the track
for (let i = 0; i < 12; i++) {
    const angle = (i / 12) * Math.PI * 2;
    const radius = trackRadius + trackWidth + 10;
    const x = Math.cos(angle) * radius;
    const z = Math.sin(angle) * radius;
    const height = 5 + Math.random() * 15;
    createBuilding(x, z, 8, height, 8);
}

// Update ground size and color
const groundGeometry = new THREE.PlaneGeometry(100, 100);
const groundMaterial = new THREE.MeshStandardMaterial({ color: 0x3a7d44 }); // Green color
const ground = new THREE.Mesh(groundGeometry, groundMaterial);
ground.rotation.x = -Math.PI / 2;
ground.position.y = -0.1; // Slightly below zero
scene.add(ground);

// Player car
const carGeometry = new THREE.BoxGeometry(2, 1, 4);
const carMaterial = new THREE.MeshStandardMaterial({ color: 0x00ff00 });
const car = new THREE.Mesh(carGeometry, carMaterial);
car.position.set(trackRadius, 0.5, 0);
car.rotation.y = Math.PI / 2;

// Wheels
const wheelGeometry = new THREE.CylinderGeometry(0.4, 0.4, 0.3, 16);
const wheelMaterial = new THREE.MeshStandardMaterial({ color: 0x333333 });

// Create wheels and position them relative to the car body
const wheelFL = new THREE.Mesh(wheelGeometry, wheelMaterial);
const wheelFR = new THREE.Mesh(wheelGeometry, wheelMaterial);
const wheelBL = new THREE.Mesh(wheelGeometry, wheelMaterial);
const wheelBR = new THREE.Mesh(wheelGeometry, wheelMaterial);

// Position wheels
wheelFL.position.set(-1.2, -0.3, 1.2);
wheelFR.position.set(1.2, -0.3, 1.2);
wheelBL.position.set(-1.2, -0.3, -1.2);
wheelBR.position.set(1.2, -0.3, -1.2);

// Rotate wheels to correct orientation
wheelFL.rotation.z = Math.PI / 2;
wheelFR.rotation.z = Math.PI / 2;
wheelBL.rotation.z = Math.PI / 2;
wheelBR.rotation.z = Math.PI / 2;

// Add wheels to car
car.add(wheelFL);
car.add(wheelFR);
car.add(wheelBL);
car.add(wheelBR);

scene.add(car);

// Camera position
camera.position.set(0, 5, 10);
camera.lookAt(0, 0, 0);

// Camera control variables
let cameraAngleX = 0;
let cameraAngleY = 0;
const CAMERA_DISTANCE = 10;

// Add these variables with other camera-related variables
let lastMouseX = 0;
let lastMouseY = 0;
const MOUSE_SENSITIVITY = 0.002;

const players = {};
let localPlayer = null;

// Constants
const COLLISION_FORCE = 2;
const COLLISION_SPIN = 0.1;
const BULLET_SPEED = 2;
const BULLET_LIFETIME = 1000;
const HIT_RADIUS = 3;
const PARTICLE_COUNT = 10;  // Number of particles for hit effects
const RESPAWN_DELAY = 3000;  // 3 seconds respawn delay
const BULLET_DAMAGE = 10;     // Damage per bullet hit (10%)
const BULLET_COOLDOWN = 250; // 250ms cooldown between shots (2x faster than before)
let lastShotTime = 0; // Track the last time a shot was fired

// Create health bar
const healthBar = document.createElement('div');
healthBar.style.position = 'fixed';
healthBar.style.bottom = '20px';  // Changed from top to bottom
healthBar.style.left = '20px';
healthBar.style.width = '200px';
healthBar.style.height = '20px';
healthBar.style.backgroundColor = '#333';
healthBar.style.border = '2px solid #fff';
healthBar.style.borderRadius = '10px';  // Added rounded corners
healthBar.style.overflow = 'hidden';    // Ensure rounded corners are visible

const healthFill = document.createElement('div');
healthFill.style.width = '100%';
healthFill.style.height = '100%';
healthFill.style.backgroundColor = '#00ff00';
healthFill.style.transition = 'width 0.3s';

healthBar.appendChild(healthFill);
document.body.appendChild(healthBar);

// Variables - these should be the ONLY declarations of these variables
let currentSpeed = 0;
let maxSpeed = 0.25;  // Reduced from 0.5 to 0.25 (50% reduction)
let acceleration = 0.005;  // Reduced from 0.01 to 0.005 (50% reduction)
let deceleration = 0.004;  // Reduced from 0.008 to 0.004 (50% reduction)
let isPlayerDead = false;
let isRightMouseDown = false;
let playerHealth = 100;
const bullets = [];

// Add gun models to the car
const gunGeometry = new THREE.BoxGeometry(0.1, 0.1, 0.5);
const gunMaterial = new THREE.MeshStandardMaterial({ color: 0x111111 });
const gunLeft = new THREE.Mesh(gunGeometry, gunMaterial);
const gunRight = new THREE.Mesh(gunGeometry, gunMaterial);

// Position guns at front of car
gunLeft.position.set(-0.8, 0, 2.2);
gunRight.position.set(0.8, 0, 2.2);
car.add(gunLeft);
car.add(gunRight);

// Add these control state objects near the top of your file
const keys = {
    ArrowUp: false,
    ArrowDown: false,
    ArrowLeft: false,
    ArrowRight: false,
    ' ': false
};

const touchStates = {
    ArrowUp: false,
    ArrowDown: false,
    ArrowLeft: false,
    ArrowRight: false,
    ' ': false
};

// Add this near the top of your file, after your constants
console.log('Game initialized!');

// Update the keyboard event listeners
window.addEventListener('keydown', (e) => {
    // Handle spacebar separately from other keys
    if (e.key === ' ') {
        keys[' '] = true;
    } else if (keys.hasOwnProperty(e.key)) {
        keys[e.key] = true;
    }
});

window.addEventListener('keyup', (e) => {
    // Handle spacebar separately from other keys
    if (e.key === ' ') {
        keys[' '] = false;
    } else if (keys.hasOwnProperty(e.key)) {
        keys[e.key] = false;
    }
});

// Handle window resize
window.addEventListener('resize', () => {
    camera.aspect = window.innerWidth / window.innerHeight;
    camera.updateProjectionMatrix();
    renderer.setSize(window.innerWidth, window.innerHeight);
});

// Socket.io event handlers
socket.on('currentPlayers', (serverPlayers) => {
    // Update player count
    document.getElementById('playerCount').textContent = Object.keys(serverPlayers).length;
    
    // Add other players to the scene
    Object.keys(serverPlayers).forEach((id) => {
        if (id !== socket.id) {
            addPlayer(id, serverPlayers[id]);
        }
    });
});

socket.on('newPlayer', (playerInfo) => {
    addPlayer(playerInfo.id, playerInfo);
    // Update player count
    const currentCount = parseInt(document.getElementById('playerCount').textContent);
    document.getElementById('playerCount').textContent = currentCount + 1;
});

socket.on('playerMoved', (playerInfo) => {
    if (players[playerInfo.id]) {
        const player = players[playerInfo.id];
        // Update position and rotation smoothly
        player.position.set(playerInfo.position.x, playerInfo.position.y, playerInfo.position.z);
        player.rotation.y = playerInfo.rotation.y;
    }
});

socket.on('playerDisconnected', (playerId) => {
    if (players[playerId]) {
        scene.remove(players[playerId]);
        delete players[playerId];
        // Update player count
        const currentCount = parseInt(document.getElementById('playerCount').textContent);
        document.getElementById('playerCount').textContent = Math.max(0, currentCount - 1);
    }
});

// Add this with your other constants/variables at the top
let playerCollision = null;

// Add these mouse event listeners after your other event listeners
document.addEventListener('mousedown', (e) => {
    // Right mouse button
    if (e.button === 2) {
        isRightMouseDown = true;
        // Store initial mouse position
        lastMouseX = e.clientX;
        lastMouseY = e.clientY;
        
        // Calculate initial camera angles based on current camera position
        const dx = camera.position.x - car.position.x;
        const dy = camera.position.y - car.position.y;
        const dz = camera.position.z - car.position.z;
        
        // Calculate initial angles from current camera position
        cameraAngleY = Math.atan2(dx, dz);
        cameraAngleX = Math.atan2(dy, Math.sqrt(dx * dx + dz * dz));
    }
});

document.addEventListener('mouseup', (e) => {
    if (e.button === 2) {
        isRightMouseDown = false;
    }
});

// Prevent context menu from showing on right click
document.addEventListener('contextmenu', (e) => {
    e.preventDefault();
});

// Add mouse move event listener
document.addEventListener('mousemove', (e) => {
    if (isRightMouseDown) {
        const deltaX = e.clientX - lastMouseX;
        const deltaY = e.clientY - lastMouseY;
        
        cameraAngleY += deltaX * MOUSE_SENSITIVITY;
        cameraAngleX += deltaY * MOUSE_SENSITIVITY;
        
        // Limit vertical rotation
        cameraAngleX = Math.max(-Math.PI/2, Math.min(Math.PI/2, cameraAngleX));
        
        lastMouseX = e.clientX;
        lastMouseY = e.clientY;
    }
});

// Update the collision check function
function checkPlayerCollisions(position) {
    for (const playerId in players) {
        if (playerId !== socket.id) {  // Don't check collision with self
            const otherPlayer = players[playerId];
            const dx = position.x - otherPlayer.position.x;
            const dz = position.z - otherPlayer.position.z;
            const distance = Math.sqrt(dx * dx + dz * dz);
            
            if (distance < 5) {  // Collision threshold
                return {
                    otherPosition: otherPlayer.position,
                    playerId: playerId
                };
            }
        }
    }
    return null;
}

// Socket listener for collisions
socket.on('carCollision', (data) => {
    // Move the car
    car.position.x += data.forceX;
    car.position.z += data.forceZ;
    
    // Add spin
    car.rotation.y += data.spin;
    
    // Reduce speed
    currentSpeed = 0;
    
    // Effects
    createHitEffect(car.position.clone());
});

// Update the createBullet function
function createBullet() {
    console.log('Creating bullet for player:', socket.id);
    
    // Create bullet geometry and material (smaller size)
    const bulletGeometry = new THREE.SphereGeometry(0.2, 8, 8);
    const bulletMaterial = new THREE.MeshBasicMaterial({ color: 0xff0000 });
    const bullet = new THREE.Mesh(bulletGeometry, bulletMaterial);

    // Position bullet 5 units in front of car
    bullet.position.copy(car.position);
    bullet.position.x += Math.sin(car.rotation.y) * 5;
    bullet.position.z += Math.cos(car.rotation.y) * 5;
    bullet.position.y += 1; // Slightly above the car

    // Set bullet direction based on car's rotation
    bullet.direction = new THREE.Vector3(
        -Math.sin(car.rotation.y),
        0,
        -Math.cos(car.rotation.y)
    );

    // Add creation timestamp and owner ID
    bullet.createdAt = Date.now();
    bullet.ownerId = socket.id;

    // Add to scene and bullets array
    scene.add(bullet);
    bullets.push(bullet);

    // Emit bullet creation to other players with serialized data
    const bulletData = {
        position: {
            x: bullet.position.x,
            y: bullet.position.y,
            z: bullet.position.z
        },
        direction: {
            x: bullet.direction.x,
            y: bullet.direction.y,
            z: bullet.direction.z
        },
        ownerId: socket.id
    };

    console.log('Emitting bulletCreated event:', bulletData);
    socket.emit('bulletCreated', bulletData);
    console.log('Bullet event emitted, waiting for server response...');
}

// Update the bulletCreated socket event handler
socket.on('bulletCreated', (data) => {
    console.log('Received bulletCreated event:', data);
    console.log('Current socket ID:', socket.id);
    
    // Don't create bullets for our own shots
    if (data.ownerId === socket.id) {
        console.log('Ignoring own bullet');
        return;
    }
    
    console.log('Creating bullet from network data');
    // Create bullet geometry and material
    const bulletGeometry = new THREE.SphereGeometry(0.2, 8, 8);
    const bulletMaterial = new THREE.MeshBasicMaterial({ color: 0xff0000 });
    const bullet = new THREE.Mesh(bulletGeometry, bulletMaterial);

    // Set bullet position and direction from the received data
    bullet.position.set(data.position.x, data.position.y, data.position.z);
    bullet.direction = new THREE.Vector3(data.direction.x, data.direction.y, data.direction.z);
    
    // Add creation timestamp and owner ID
    bullet.createdAt = Date.now();
    bullet.ownerId = data.ownerId;

    // Add to scene and bullets array
    scene.add(bullet);
    bullets.push(bullet);

    console.log('Created bullet from network:', bullet.position, bullet.direction);
});

// Add this function after the socket event handlers and before the animate function
function addPlayer(id, playerInfo) {
    // Create a new car for the other player
    const otherCarGeometry = new THREE.BoxGeometry(2, 1, 4);
    const otherCarMaterial = new THREE.MeshStandardMaterial({ color: 0xff0000 }); // Red color for other players
    const otherCar = new THREE.Mesh(otherCarGeometry, otherCarMaterial);
    
    // Set initial position and rotation
    otherCar.position.set(
        playerInfo.position.x,
        playerInfo.position.y,
        playerInfo.position.z
    );
    otherCar.rotation.y = playerInfo.rotation.y;
    
    // Add wheels to the other car
    const otherWheelGeometry = new THREE.CylinderGeometry(0.4, 0.4, 0.3, 16);
    const otherWheelMaterial = new THREE.MeshStandardMaterial({ color: 0x333333 });
    
    const otherWheelFL = new THREE.Mesh(otherWheelGeometry, otherWheelMaterial);
    const otherWheelFR = new THREE.Mesh(otherWheelGeometry, otherWheelMaterial);
    const otherWheelBL = new THREE.Mesh(otherWheelGeometry, otherWheelMaterial);
    const otherWheelBR = new THREE.Mesh(otherWheelGeometry, otherWheelMaterial);
    
    // Position wheels
    otherWheelFL.position.set(-1.2, -0.3, 1.2);
    otherWheelFR.position.set(1.2, -0.3, 1.2);
    otherWheelBL.position.set(-1.2, -0.3, -1.2);
    otherWheelBR.position.set(1.2, -0.3, -1.2);
    
    // Rotate wheels to correct orientation
    otherWheelFL.rotation.z = Math.PI / 2;
    otherWheelFR.rotation.z = Math.PI / 2;
    otherWheelBL.rotation.z = Math.PI / 2;
    otherWheelBR.rotation.z = Math.PI / 2;
    
    // Add wheels to other car
    otherCar.add(otherWheelFL);
    otherCar.add(otherWheelFR);
    otherCar.add(otherWheelBL);
    otherCar.add(otherWheelBR);
    
    // Add the car to the scene
    scene.add(otherCar);
    
    // Store the player in the players object
    players[id] = otherCar;
}

// Game loop
function animate() {
    if (!isPlayerDead) {  // Only animate if player is alive
        try {
            requestAnimationFrame(animate);

            // Only proceed with animation if we have a valid local player
            if (localPlayer && !isPlayerDead) {
                const rotationSpeed = 0.03;

                // Store previous position and rotation
                const previousPosition = car.position.clone();
                const previousRotation = car.rotation.y;

                // Combine keyboard and touch inputs
                const up = keys.ArrowUp || touchStates.ArrowUp;
                const down = keys.ArrowDown || touchStates.ArrowDown;
                const left = keys.ArrowLeft || touchStates.ArrowLeft;
                const right = keys.ArrowRight || touchStates.ArrowRight;
                const shooting = keys[' '] || touchStates[' '];

                // Use combined inputs for movement
                if (up) {
                    currentSpeed = Math.min(currentSpeed + acceleration, maxSpeed);
                } else if (down) {
                    currentSpeed = Math.max(currentSpeed - acceleration, -maxSpeed);
                } else {
                    if (currentSpeed > 0) {
                        currentSpeed = Math.max(0, currentSpeed - deceleration);
                    } else if (currentSpeed < 0) {
                        currentSpeed = Math.min(0, currentSpeed + deceleration);
                    }
                }

                // Move car
                car.position.x -= Math.sin(car.rotation.y) * currentSpeed;
                car.position.z -= Math.cos(car.rotation.y) * currentSpeed;

                // Check for collisions AFTER movement
                const collision = checkPlayerCollisions(car.position);
                
                if (collision) {
                    // Calculate collision direction
                    const dx = car.position.x - collision.otherPosition.x;
                    const dz = car.position.z - collision.otherPosition.z;
                    const distance = Math.sqrt(dx * dx + dz * dz);
                    
                    // Normalize direction
                    const dirX = dx / distance;
                    const dirZ = dz / distance;
                    
                    // Calculate forces
                    const forceX = dirX * COLLISION_FORCE;
                    const forceZ = dirZ * COLLISION_FORCE;
                    const spin = (Math.random() > 0.5 ? 1 : -1) * COLLISION_SPIN;

                    // Apply to this car
                    car.position.x += forceX;
                    car.position.z += forceZ;
                    car.rotation.y += spin;
                    currentSpeed = 0;
                    
                    // Effects for this car
                    createHitEffect(car.position.clone());

                    // Send to other car (opposite direction)
                    socket.emit('carCollision', {
                        forceX: -forceX,  // Opposite direction for other car
                        forceZ: -forceZ,  // Opposite direction for other car
                        spin: -spin       // Opposite spin for other car
                    });
                }

                // Handle turning
                if (left) car.rotation.y += rotationSpeed;
                if (right) car.rotation.y -= rotationSpeed;

                // Handle shooting separately
                if (shooting) {
                    const currentTime = Date.now();
                    if (currentTime - lastShotTime >= BULLET_COOLDOWN) {
                        console.log('Shooting!');
                        createBullet();
                        lastShotTime = currentTime;
                    }
                }

                // Update camera position
                if (!isRightMouseDown) {
                    // Normal following camera
                    const cameraOffset = new THREE.Vector3(0, 5, 10);
                    const cameraPosition = car.position.clone();
                    const rotationMatrix = new THREE.Matrix4();
                    rotationMatrix.makeRotationY(car.rotation.y);
                    cameraOffset.applyMatrix4(rotationMatrix);
                    cameraPosition.add(cameraOffset);
                    camera.position.lerp(cameraPosition, 0.1);
                } else {
                    // Free rotating camera
                    const cameraOffset = new THREE.Vector3(
                        Math.sin(cameraAngleY) * CAMERA_DISTANCE * Math.cos(cameraAngleX),
                        Math.sin(cameraAngleX) * CAMERA_DISTANCE,
                        Math.cos(cameraAngleY) * CAMERA_DISTANCE * Math.cos(cameraAngleX)
                    );
                    camera.position.copy(car.position).add(cameraOffset);
                }
                
                camera.lookAt(car.position);

                // Rotate wheels based on speed
                const wheelRotationSpeed = currentSpeed * 5;
                wheelFL.rotation.x += wheelRotationSpeed;
                wheelFR.rotation.x += wheelRotationSpeed;
                wheelBL.rotation.x += wheelRotationSpeed;
                wheelBR.rotation.x += wheelRotationSpeed;

                // Update bullets and check collisions
                for (let i = bullets.length - 1; i >= 0; i--) {
                    const bullet = bullets[i];
                    
                    // Move bullet
                    bullet.position.x += bullet.direction.x * BULLET_SPEED;
                    bullet.position.z += bullet.direction.z * BULLET_SPEED;
                    
                    // Check collision with other players
                    Object.keys(players).forEach(id => {
                        if (id !== socket.id && bullet.ownerId === socket.id) {
                            const player = players[id];
                            const dx = bullet.position.x - player.position.x;
                            const dz = bullet.position.z - player.position.z;
                            const distance = Math.sqrt(dx * dx + dz * dz);

                            if (distance < HIT_RADIUS) {
                                // Create hit effect
                                createHitEffect(bullet.position.clone());
                                
                                // Remove bullet
                                scene.remove(bullet);
                                bullets.splice(i, 1);
                                
                                // Emit hit event with damage
                                socket.emit('playerHit', {
                                    hitPlayerId: id,
                                    shooterId: socket.id,
                                    damage: BULLET_DAMAGE  // Use constant 10% damage
                                });
                            }
                        }
                    });

                    // Check if bullet hit local player
                    if (bullet.ownerId !== socket.id) {  // Only check collision if bullet wasn't shot by local player
                        const localDx = bullet.position.x - car.position.x;
                        const localDz = bullet.position.z - car.position.z;
                        const localDistance = Math.sqrt(localDx * localDx + localDz * localDz);
                        
                        if (localDistance < HIT_RADIUS) {
                            // Create hit effect
                            createHitEffect(bullet.position.clone());
                            
                            // Remove bullet and apply damage
                            scene.remove(bullet);
                            bullets.splice(i, 1);
                            
                            // Apply damage directly to local player
                            playerHealth = Math.max(0, playerHealth - BULLET_DAMAGE);
                            console.log('Local player hit! Health:', playerHealth);
                            updateHealthBar();
                            
                            // Emit hit event to server
                            socket.emit('playerHit', {
                                hitPlayerId: socket.id,
                                shooterId: socket.id,
                                damage: BULLET_DAMAGE  // Use constant 10% damage
                            });
                            
                            if (playerHealth <= 0) {
                                playerDeath();
                            }
                        }
                    }

                    // Remove old bullets
                    if (Date.now() - bullet.createdAt > BULLET_LIFETIME) {
                        scene.remove(bullet);
                        bullets.splice(i, 1);
                    }
                }

                // Check building collisions
                const buildingCollision = checkBuildingCollision(car.position);
                if (buildingCollision) {
                    // Move back to previous position
                    car.position.copy(previousPosition);
                    
                    // Apply bounce
                    const bounceForce = 0.3; // Adjust for bounciness
                    car.position.x += buildingCollision.x * bounceForce;
                    car.position.z += buildingCollision.y * bounceForce;
                    
                    // Reduce speed on collision
                    currentSpeed *= -0.5; // Bounce back at half speed
                }

                // Emit position more frequently and with complete data
                socket.emit('playerMovement', {
                    position: {
                        x: car.position.x,
                        y: car.position.y,
                        z: car.position.z
                    },
                    rotation: {
                        y: car.rotation.y
                    }
                });
            }

            // Update other players' positions
            Object.keys(players).forEach((id) => {
                if (players[id]) {
                    const player = players[id];
                    // Remove the lerp to fix static position issue
                    // Just ensure the position and rotation are updated from socket events
                }
            });

            renderer.render(scene, camera);
        } catch (error) {
            console.error('Animation error:', error);
        }
    }
}

// Start game
localPlayer = car;
animate();

// Make sure renderer is using the correct color
renderer.setClearColor(0x87ceeb); // Light blue sky color 

// Update the socket event listener for damage
socket.on('playerHit', (data) => {
    console.log('Received hit event:', data);
    
    // Only apply damage if this client is the one that got hit
    if (data.hitPlayerId === socket.id) {
        playerHealth = Math.max(0, playerHealth - BULLET_DAMAGE);
        console.log('I was hit! Health:', playerHealth);
        updateHealthBar();
        
        if (playerHealth <= 0) {
            playerDeath();
        }
    }
});

// Update the health bar update function
function updateHealthBar() {
    console.log('Updating health bar to:', playerHealth);
    const healthPercentage = Math.max(0, Math.min(100, playerHealth));
    healthFill.style.width = `${healthPercentage}%`;
    
    // Change color based on health
    if (healthPercentage > 60) {
        healthFill.style.backgroundColor = '#00ff00';
    } else if (healthPercentage > 30) {
        healthFill.style.backgroundColor = '#ffff00';
    } else {
        healthFill.style.backgroundColor = '#ff0000';
    }
}

// Update the player death function
function playerDeath() {
    isPlayerDead = true;
    
    // Create explosion effect
    createExplosion(car.position.clone());
    
    // Hide the car
    car.visible = false;
    
    // Start respawn timer
    setTimeout(() => {
        // Reset player state
        isPlayerDead = false;
        playerHealth = 100;
        updateHealthBar();
        
        // Reset position to spawn point
        car.position.set(trackRadius, 0.5, 0);
        car.rotation.y = Math.PI / 2;
        
        // Reset speed
        currentSpeed = 0;
        
        // Make car visible again
        car.visible = true;
        
        // Emit position update
        socket.emit('playerMovement', {
            position: {
                x: car.position.x,
                y: car.position.y,
                z: car.position.z
            },
            rotation: {
                y: car.rotation.y
            }
        });
    }, RESPAWN_DELAY);  // 3 seconds delay before respawn
}

// Add explosion effect function
function createExplosion(position) {
    const particleCount = 30;
    const particles = [];
    
    for (let i = 0; i < particleCount; i++) {
        const geometry = new THREE.SphereGeometry(0.3);
        const material = new THREE.MeshBasicMaterial({
            color: Math.random() < 0.5 ? 0xff4500 : 0xff8c00 // Orange/red colors
        });
        const particle = new THREE.Mesh(geometry, material);
        
        // Set particle position to explosion center
        particle.position.copy(position);
        
        // Add random velocity
        particle.velocity = new THREE.Vector3(
            (Math.random() - 0.5) * 2,
            Math.random() * 2,
            (Math.random() - 0.5) * 2
        );
        
        scene.add(particle);
        particles.push(particle);
        
        // Remove particle after 1 second
        setTimeout(() => {
            scene.remove(particle);
            const index = particles.indexOf(particle);
            if (index > -1) particles.splice(index, 1);
        }, 1000);
    }
    
    // Animate particles
    function animateParticles() {
        particles.forEach(particle => {
            particle.position.add(particle.velocity);
            particle.velocity.y -= 0.1; // Add gravity effect
        });
        
        if (particles.length > 0) {
            requestAnimationFrame(animateParticles);
        }
    }
    
    animateParticles();
}

// Add respawn function
function respawnPlayer() {
    isPlayerDead = false;
    
    // Reset health and damage
    playerHealth = 100;
    updateHealthBar();
    
    // Reset position
    car.position.set(0, 0.5, 0);
    car.rotation.y = 0;
    
    // Reset speed
    currentSpeed = 0;
    
    // Make car visible again
    car.visible = true;
    
    // Emit position update
    socket.emit('playerMovement', {
        position: car.position,
        rotation: car.rotation
    });
}

// Add hit effect function
function createHitEffect(position) {
    for (let i = 0; i < PARTICLE_COUNT; i++) {
        const particle = new THREE.Mesh(
            new THREE.SphereGeometry(0.1),
            new THREE.MeshBasicMaterial({ 
                color: 0xffff00, // Bright yellow color
                transparent: true,
                opacity: 1
            })
        );
        
        particle.position.copy(position);
        particle.velocity = new THREE.Vector3(
            (Math.random() - 0.5) * 0.5,
            Math.random() * 0.5,
            (Math.random() - 0.5) * 0.5
        );
        
        scene.add(particle);
        
        // Animate particle
        const animate = () => {
            particle.position.add(particle.velocity);
            particle.velocity.y -= 0.01; // Add gravity
            particle.scale.multiplyScalar(0.95); // Shrink particle
            particle.material.opacity *= 0.95; // Fade out
        };

        // Add to animation loop
        const particleInterval = setInterval(animate, 16);
        
        // Remove particle and clear interval after 500ms
        setTimeout(() => {
            scene.remove(particle);
            clearInterval(particleInterval);
        }, 500);
    }
}

// Add meta viewport tag to your HTML for proper mobile scaling
// Add this to your index.html <head> section:
// <meta name="viewport" content="width=device-width, initial-scale=1.0, maximum-scale=1.0, user-scalable=no"> 

// Add this to handle player death if needed
function killPlayer() {
    isPlayerDead = true;
    // Add any death effects or respawn logic here
}

function respawnPlayer() {
    isPlayerDead = false;
    // Add respawn logic here
}

// Update the initialization check
window.addEventListener('load', () => {
    console.log('Window loaded, initializing game...');
    try {
        // Start game
        localPlayer = car;
        animate();
        console.log('Game initialized successfully');
        
        // Emit initial position
        if (socket) {
            socket.emit('playerMovement', {
                position: {
                    x: car.position.x,
                    y: car.position.y,
                    z: car.position.z
                },
                rotation: {
                    y: car.rotation.y
                }
            });
        }
    } catch (error) {
        console.error('Failed to initialize game:', error);
    }
});

function checkBuildingCollision(position) {
    // Get building positions from the building creation loop
    for (let i = 0; i < 12; i++) {
        const angle = (i / 12) * Math.PI * 2;
        const radius = trackRadius + trackWidth + 10;
        const buildingX = Math.cos(angle) * radius;
        const buildingZ = Math.sin(angle) * radius;
        
        // Building dimensions
        const buildingWidth = 8;
        const buildingDepth = 8;
        
        // Calculate distance from car to building center
        const dx = position.x - buildingX;
        const dz = position.z - buildingZ;
        
        // Check if car is within building bounds (box collision)
        if (Math.abs(dx) < buildingWidth/2 + 1 && // +1 for car width
            Math.abs(dz) < buildingDepth/2 + 2) {  // +2 for car length
            
            // Return collision normal
            return {
                x: dx > 0 ? 1 : -1,
                y: dz > 0 ? 1 : -1
            };
        }
    }
    return false;
}

