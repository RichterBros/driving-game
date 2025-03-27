// Three.js setup
const scene = new THREE.Scene();
const camera = new THREE.PerspectiveCamera(75, window.innerWidth / window.innerHeight, 0.1, 1000);
const renderer = new THREE.WebGLRenderer();
renderer.setSize(window.innerWidth, window.innerHeight);
renderer.setClearColor(0x87ceeb); // Set sky blue background color
document.body.appendChild(renderer.domElement);

// Socket.IO setup - make sure this URL matches your Render backend service
const socket = io('http://localhost:3000');

// Lighting
const ambientLight = new THREE.AmbientLight(0xffffff, 1.0);
scene.add(ambientLight);
const directionalLight = new THREE.DirectionalLight(0xffffff, 1.0);
directionalLight.position.set(0, 20, 10);
scene.add(directionalLight);

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

const players = {};
let localPlayer = null;

// Add to the constants section
const bullets = [];
const BULLET_SPEED = 1.5;
const BULLET_LIFETIME = 1000; // milliseconds

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

// Helper functions
function addPlayer(id, playerInfo) {
    // Create player car body
    const carGeometry = new THREE.BoxGeometry(2, 1, 4);
    const carMaterial = new THREE.MeshStandardMaterial({ color: 0xff0000 });
    const playerCar = new THREE.Mesh(carGeometry, carMaterial);
    
    // Create wheels
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
    playerCar.add(wheelFL);
    playerCar.add(wheelFR);
    playerCar.add(wheelBL);
    playerCar.add(wheelBR);

    // Set car position and rotation
    playerCar.position.copy(playerInfo.position);
    playerCar.rotation.y = playerInfo.rotation.y;
    
    // Add to scene and players object
    scene.add(playerCar);
    players[id] = playerCar;
}

// Add these helper functions before the animate function
function getCarDirection() {
    return new THREE.Vector2(
        -Math.sin(car.rotation.y),
        -Math.cos(car.rotation.y)
    ).normalize();
}

function bounceOffWall(position, normal) {
    const direction = getCarDirection();
    const dot = direction.dot(normal);
    direction.x -= 2 * dot * normal.x;
    direction.y -= 2 * dot * normal.y;
    return direction.normalize();
}

// Add these variables at the top with other constants
const MAX_SPEED = 0.5;      // Maximum speed
const ACCELERATION = 0.005;  // How quickly the car speeds up
const DECELERATION = 0.01;  // How quickly the car slows down
let currentSpeed = 0;       // Current speed of the car

// Add at the top with other constants
const BULLET_DAMAGE = 1; // 1% damage per hit
const HIT_RADIUS = 1.5; // Smaller radius for more precise hits
const PARTICLE_COUNT = 8; // Number of particles per hit
let playerHealth = 100;

// Add at the top with other constants
const RESPAWN_DELAY = 5000; // 5 seconds in milliseconds
let isPlayerDead = false;

// Add these variables at the top with your other constants
let isRightMouseDown = false;
let previousMouseX = 0;
let previousMouseY = 0;
let cameraAngleX = 0;
let cameraAngleY = 0;
const CAMERA_ROTATION_SPEED = 0.005;
const CAMERA_DISTANCE = 10;

// Add this at the top of your file with other constants
const hitSound = new Audio();
hitSound.src = 'https://assets.mixkit.co/active_storage/sfx/2571/2571-preview.mp3';
hitSound.volume = 0.3;

// Add bullet creation function
function createBullet(gun) {
    console.log('Creating bullet!');
    const bulletGeometry = new THREE.SphereGeometry(0.2);
    const bulletMaterial = new THREE.MeshStandardMaterial({ 
        color: 0xff0000,
        emissive: 0xff0000,
        emissiveIntensity: 0.5
    });
    const bullet = new THREE.Mesh(bulletGeometry, bulletMaterial);
    
    bullet.position.copy(gun.getWorldPosition(new THREE.Vector3()));
    bullet.position.y = 0.5;
    bullet.rotation.copy(car.rotation);
    bullet.ownerId = socket.id;
    bullet.createdAt = Date.now();
    
    scene.add(bullet);
    bullets.push(bullet);

    console.log('Bullet fired! 🔫');
}

// Add collision helper function
function checkBuildingCollision(carPosition) {
    for (let i = 0; i < 12; i++) {
        const angle = (i / 12) * Math.PI * 2;
        const radius = trackRadius + trackWidth + 10;
        const buildingX = Math.cos(angle) * radius;
        const buildingZ = Math.sin(angle) * radius;
        
        // Calculate distance between car and building
        const dx = carPosition.x - buildingX;
        const dz = carPosition.z - buildingZ;
        const distance = Math.sqrt(dx * dx + dz * dz);
        
        // Building bounds (half width of building is 4 units)
        if (distance < 6) {  // 4 (building radius) + 2 (car radius) = 6
            // Calculate bounce direction
            const bounceDirection = new THREE.Vector2(dx, dz).normalize();
            return bounceDirection;
        }
    }
    return null;
}

// Update the player collision check function
function checkPlayerCollisions(position) {
    // Check collision with other players
    for (let id in players) {
        if (id !== socket.id) { // Don't check collision with self
            const otherPlayer = players[id];
            const dx = position.x - otherPlayer.position.x;
            const dz = position.z - otherPlayer.position.z;
            const distance = Math.sqrt(dx * dx + dz * dz);
            
            // Adjust collision radius to match car dimensions
            // Car is 2 units wide and 4 units long, so we'll use 3 units as average
            if (distance < 3) { // Reduced from 6 to 3 for tighter collision
                // Calculate bounce direction
                const bounceDirection = new THREE.Vector2(dx, dz).normalize();
                return bounceDirection;
            }
        }
    }
    return null;
}

// Make sure this health bar code appears after your Three.js setup
const healthDisplay = document.createElement('div');
healthDisplay.style.position = 'fixed';
healthDisplay.style.bottom = '120px'; // Increased distance from bottom to be above touch controls
healthDisplay.style.left = '50%';
healthDisplay.style.transform = 'translateX(-50%)';
healthDisplay.style.width = '300px'; // Made it a bit wider
healthDisplay.style.height = '20px';
healthDisplay.style.backgroundColor = 'rgba(0, 0, 0, 0.5)';
healthDisplay.style.border = '2px solid white';
healthDisplay.style.borderRadius = '10px';
healthDisplay.style.overflow = 'hidden';
healthDisplay.style.zIndex = '1000';

const healthFill = document.createElement('div');
healthFill.style.width = '100%';
healthFill.style.height = '100%';
healthFill.style.backgroundColor = '#00ff00';
healthFill.style.transition = 'width 0.3s, background-color 0.3s';

// Remove any existing health display first
const existingHealthDisplay = document.querySelector('#healthDisplay');
if (existingHealthDisplay) {
    existingHealthDisplay.remove();
}

// Add ID to new health display
healthDisplay.id = 'healthDisplay';
healthDisplay.appendChild(healthFill);
document.body.appendChild(healthDisplay);

// Create touch controls container
const touchControls = document.createElement('div');
touchControls.style.position = 'fixed';
touchControls.style.bottom = '20px';
touchControls.style.left = '20px';
touchControls.style.width = '100%';
touchControls.style.display = 'none'; // Initially hidden

// Create button style
const buttonStyle = `
    width: 60px;
    height: 60px;
    background: rgba(255, 255, 255, 0.3);
    border: 2px solid white;
    border-radius: 50%;
    margin: 10px;
    display: inline-block;
    color: white;
    font-size: 24px;
    line-height: 60px;
    text-align: center;
    user-select: none;
    -webkit-user-select: none;
`;

// Create movement buttons container
const moveControls = document.createElement('div');
moveControls.style.display = 'inline-block';
moveControls.style.position = 'absolute';
moveControls.style.left = '20px';
moveControls.style.bottom = '20px';

// Create buttons
const buttons = {
    up: createButton('↑'),
    down: createButton('↓'),
    left: createButton('←'),
    right: createButton('→')
};

// Add buttons to moveControls
Object.values(buttons).forEach(button => {
    moveControls.appendChild(button);
});

// Create and style shoot button
const shootButton = createButton('🔫');
shootButton.style.backgroundColor = 'rgba(255, 0, 0, 0.3)';
shootButton.style.width = '80px';
shootButton.style.height = '80px';
shootButton.style.lineHeight = '80px';
shootButton.style.fontSize = '32px';
shootButton.style.position = 'absolute';
shootButton.style.right = '40px';
shootButton.style.bottom = '20px';

// Add everything to the page
document.body.appendChild(touchControls);
touchControls.appendChild(moveControls);
touchControls.appendChild(shootButton);

// Show controls only on touch devices
if ('ontouchstart' in window) {
    touchControls.style.display = 'block';
}

// Helper function to create buttons
function createButton(text) {
    const button = document.createElement('div');
    button.style.cssText = buttonStyle;
    button.innerText = text;
    return button;
}

// Make sure touch event listeners are added
buttons.up.addEventListener('touchstart', (e) => {
    e.preventDefault();
    touchStates.ArrowUp = true;
});
buttons.up.addEventListener('touchend', () => touchStates.ArrowUp = false);

buttons.down.addEventListener('touchstart', (e) => {
    e.preventDefault();
    touchStates.ArrowDown = true;
});
buttons.down.addEventListener('touchend', () => touchStates.ArrowDown = false);

buttons.left.addEventListener('touchstart', (e) => {
    e.preventDefault();
    touchStates.ArrowLeft = true;
});
buttons.left.addEventListener('touchend', () => touchStates.ArrowLeft = false);

buttons.right.addEventListener('touchstart', (e) => {
    e.preventDefault();
    touchStates.ArrowRight = true;
});
buttons.right.addEventListener('touchend', () => touchStates.ArrowRight = false);

shootButton.addEventListener('touchstart', (e) => {
    e.preventDefault();
    touchStates[' '] = true;
});
shootButton.addEventListener('touchend', () => touchStates[' '] = false);

// Update mouse down event listener
document.addEventListener('mousedown', (e) => {
    if (e.button === 2) { // Right mouse button
        isRightMouseDown = true;
        previousMouseX = e.clientX;
        previousMouseY = e.clientY;
        
        // Calculate initial camera angles based on current camera position
        const relativePos = camera.position.clone().sub(car.position);
        cameraAngleY = Math.atan2(relativePos.x, relativePos.z);
        cameraAngleX = Math.asin(relativePos.y / CAMERA_DISTANCE);
    }
});

// Rest of the mouse event listeners remain the same
document.addEventListener('mouseup', (e) => {
    if (e.button === 2) {
        isRightMouseDown = false;
    }
});

document.addEventListener('mousemove', (e) => {
    if (isRightMouseDown) {
        const deltaX = e.clientX - previousMouseX;
        const deltaY = e.clientY - previousMouseY;
        
        cameraAngleY += deltaX * CAMERA_ROTATION_SPEED;
        cameraAngleX = Math.max(-Math.PI/3, Math.min(Math.PI/3, cameraAngleX + deltaY * CAMERA_ROTATION_SPEED));
        
        previousMouseX = e.clientX;
        previousMouseY = e.clientY;
    }
});

// Prevent context menu from appearing on right click
document.addEventListener('contextmenu', (e) => {
    e.preventDefault();
});

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

// Game loop
function animate() {
    requestAnimationFrame(animate);

    if (localPlayer && !isPlayerDead) {
        const rotationSpeed = 0.03;

        // Store previous position
        const previousPosition = car.position.clone();

        // Combine keyboard and touch inputs
        const up = keys.ArrowUp || touchStates.ArrowUp;
        const down = keys.ArrowDown || touchStates.ArrowDown;
        const left = keys.ArrowLeft || touchStates.ArrowLeft;
        const right = keys.ArrowRight || touchStates.ArrowRight;
        const shooting = keys[' '] || touchStates[' '];

        // Use combined inputs for movement
        if (up) {
            currentSpeed = Math.min(currentSpeed + ACCELERATION, MAX_SPEED);
        } else if (down) {
            currentSpeed = Math.max(currentSpeed - ACCELERATION, -MAX_SPEED * 0.5);
        } else {
            if (currentSpeed > 0) {
                currentSpeed = Math.max(0, currentSpeed - DECELERATION);
            } else if (currentSpeed < 0) {
                currentSpeed = Math.min(0, currentSpeed + DECELERATION);
            }
        }

        // Apply movement
        car.position.x -= Math.sin(car.rotation.y) * currentSpeed;
        car.position.z -= Math.cos(car.rotation.y) * currentSpeed;

        // Check player collisions
        const playerCollision = checkPlayerCollisions(car.position);
        if (playerCollision) {
            // Move back to previous position
            car.position.copy(previousPosition);
            
            // Apply bounce
            const bounceForce = 0.3; // Adjust for bounciness
            car.position.x += playerCollision.x * bounceForce;
            car.position.z += playerCollision.y * bounceForce;
            
            // Reduce speed on collision
            currentSpeed *= -0.5; // Bounce back at half speed
        }

        // Apply turning
        if (left) car.rotation.y += rotationSpeed * (Math.abs(currentSpeed) / MAX_SPEED);
        if (right) car.rotation.y -= rotationSpeed * (Math.abs(currentSpeed) / MAX_SPEED);

        // Handle shooting separately
        if (shooting) {
            console.log('Shooting!');
            createBullet(gunLeft);
            createBullet(gunRight);
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
            bullet.position.x -= Math.sin(bullet.rotation.y) * BULLET_SPEED;
            bullet.position.z -= Math.cos(bullet.rotation.y) * BULLET_SPEED;
            
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
                        
                        // Play hit sound
                        hitSound.currentTime = 0;
                        hitSound.play().catch(e => console.log('Sound play failed:', e));
                        
                        // Remove bullet
                        scene.remove(bullet);
                        bullets.splice(i, 1);
                        
                        // Emit hit event
                        socket.emit('playerHit', {
                            hitPlayerId: id,
                            damage: BULLET_DAMAGE
                        });
                    }
                }
            });

            // Check if bullet hit local player
            if (bullet.ownerId !== socket.id) {
                const localDx = bullet.position.x - car.position.x;
                const localDz = bullet.position.z - car.position.z;
                const localDistance = Math.sqrt(localDx * localDx + localDz * localDz);
                
                if (localDistance < HIT_RADIUS) {
                    // Create hit effect
                    createHitEffect(bullet.position.clone());
                    
                    // Play hit sound
                    hitSound.currentTime = 0;
                    hitSound.play().catch(e => console.log('Sound play failed:', e));
                    hitSound.play();
                    
                    // Remove bullet and apply damage
                    scene.remove(bullet);
                    bullets.splice(i, 1);
                    playerHealth = Math.max(0, playerHealth - 1);
                    updateHealthBar();
                    
                    if (playerHealth <= 0) {
                        playerDeath();
                    }
                }
            }
        }

        // Check building collisions
        const collision = checkBuildingCollision(car.position);
        if (collision) {
            // Move back to previous position
            car.position.copy(previousPosition);
            
            // Apply bounce
            const bounceForce = 0.3; // Adjust for bounciness
            car.position.x += collision.x * bounceForce;
            car.position.z += collision.y * bounceForce;
            
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
}

// Start game
localPlayer = car;
animate();

// Make sure renderer is using the correct color
renderer.setClearColor(0x87ceeb); // Light blue sky color 

// Add health bar update function
function updateHealthBar() {
    healthFill.style.width = `${playerHealth}%`;
    
    // Change color based on health
    if (playerHealth > 60) {
        healthFill.style.backgroundColor = '#00ff00';
    } else if (playerHealth > 30) {
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
        respawnPlayer();
    }, RESPAWN_DELAY);
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
    // Reset health
    playerHealth = 100;
    updateHealthBar();
    
    // Reset position
    car.position.set(0, 0.5, 0);
    car.rotation.y = 0;
    
    // Reset speed
    currentSpeed = 0;
    
    // Make car visible again
    car.visible = true;
    
    // Reset dead state
    isPlayerDead = false;
    
    // Emit position update
    socket.emit('playerMovement', {
        position: car.position,
        rotation: car.rotation
    });
}

// Add socket event listeners for damage
socket.on('playerHit', () => {
    // Decrease local player's health when hit
    playerHealth = Math.max(0, playerHealth - 1);
    updateHealthBar();
    
    if (playerHealth <= 0) {
        playerDeath();
    }
});

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