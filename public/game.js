// Three.js setup
const scene = new THREE.Scene();
const camera = new THREE.PerspectiveCamera(75, window.innerWidth / window.innerHeight, 0.1, 1000);
const renderer = new THREE.WebGLRenderer();
renderer.setSize(window.innerWidth, window.innerHeight);
document.body.appendChild(renderer.domElement);

// Socket.IO setup - make sure this URL matches your Render backend service
const socket = io('https://driving-game-server.onrender.com');

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
const groundGeometry = new THREE.PlaneGeometry(200, 200);
const groundMaterial = new THREE.MeshStandardMaterial({ color: 0x3a7d44 });
const ground = new THREE.Mesh(groundGeometry, groundMaterial);
ground.rotation.x = -Math.PI / 2;
ground.position.y = -0.1; // Lower the ground slightly below the track
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
camera.position.set(0, 5, 15);
camera.lookAt(car.position);

const players = {};
let localPlayer = null;

// Add to the constants section
const bullets = [];
const BULLET_SPEED = 2;
const BULLET_LIFETIME = 1000; // milliseconds
const BULLET_DAMAGE = 1; // 1% damage per hit
let playerHealth = 100;
const COLLISION_RADIUS = 3; // Increased collision radius for easier hits

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

// Event listeners for controls
window.addEventListener('keydown', (e) => {
    if (keys.hasOwnProperty(e.key)) {
        keys[e.key] = true;
    }
});

window.addEventListener('keyup', (e) => {
    if (keys.hasOwnProperty(e.key)) {
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
    document.getElementById('playerCount').textContent = Object.keys(serverPlayers).length;
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
    const playerCar = new THREE.Mesh(carGeometry, new THREE.MeshStandardMaterial({ color: 0xff0000 }));
    playerCar.position.copy(playerInfo.position);
    playerCar.rotation.y = playerInfo.rotation.y;
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
const RESPAWN_DELAY = 5000; // 5 seconds in milliseconds
let isPlayerDead = false;

// Add bullet creation function
function createBullet(gun) {
    const bulletGeometry = new THREE.SphereGeometry(0.2); // Made bullets bigger
    const bulletMaterial = new THREE.MeshStandardMaterial({ 
        color: 0xff0000,
        emissive: 0xff0000,
        emissiveIntensity: 0.5
    });
    const bullet = new THREE.Mesh(bulletGeometry, bulletMaterial);
    
    // Set position and rotation
    bullet.position.copy(gun.getWorldPosition(new THREE.Vector3()));
    bullet.rotation.copy(car.rotation);
    
    // Add metadata
    bullet.ownerId = socket.id;
    bullet.createdAt = Date.now();
    
    scene.add(bullet);
    bullets.push(bullet);
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

        // Apply turning
        if (left) car.rotation.y += rotationSpeed * (Math.abs(currentSpeed) / MAX_SPEED);
        if (right) car.rotation.y -= rotationSpeed * (Math.abs(currentSpeed) / MAX_SPEED);

        // Handle shooting
        if (shooting) {
            createBullet(gunLeft);
            createBullet(gunRight);
        }

        // Update camera position
        const cameraOffset = new THREE.Vector3(0, 3, 8);
        const cameraPosition = car.position.clone();
        const rotationMatrix = new THREE.Matrix4();
        rotationMatrix.makeRotationY(car.rotation.y);
        cameraOffset.applyMatrix4(rotationMatrix);
        cameraPosition.add(cameraOffset);
        
        camera.position.lerp(cameraPosition, 0.1);
        camera.lookAt(car.position);

        // Rotate wheels based on speed
        const wheelRotationSpeed = currentSpeed * 5;
        wheelFL.rotation.x += wheelRotationSpeed;
        wheelFR.rotation.x += wheelRotationSpeed;
        wheelBL.rotation.x += wheelRotationSpeed;
        wheelBR.rotation.x += wheelRotationSpeed;

        // Update bullets
        for (let i = bullets.length - 1; i >= 0; i--) {
            const bullet = bullets[i];
            
            // Move bullet
            bullet.position.x -= Math.sin(bullet.rotation.y) * BULLET_SPEED;
            bullet.position.z -= Math.cos(bullet.rotation.y) * BULLET_SPEED;
            
            // Check collision with local player's car
            if (bullet.ownerId !== socket.id) { // Only check other players' bullets
                const dx = bullet.position.x - car.position.x;
                const dz = bullet.position.z - car.position.z;
                const distance = Math.sqrt(dx * dx + dz * dz);
                
                if (distance < COLLISION_RADIUS) {
                    console.log('Bullet hit! Current health:', playerHealth); // Debug log
                    
                    // Remove bullet
                    scene.remove(bullet);
                    bullets.splice(i, 1);
                    
                    // Apply damage
                    playerHealth -= BULLET_DAMAGE;
                    
                    // Update health bar
                    updateHealthBar();
                    
                    // Check for death
                    if (playerHealth <= 0 && !isPlayerDead) {
                        playerDeath();
                    }
                }
            }
            
            // Remove bullets that have traveled too far
            if (bullet.createdAt && Date.now() - bullet.createdAt > BULLET_LIFETIME) {
                scene.remove(bullet);
                bullets.splice(i, 1);
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
        healthFill.style.backgroundColor = '#00ff00'; // Green
    } else if (playerHealth > 30) {
        healthFill.style.backgroundColor = '#ffff00'; // Yellow
    } else {
        healthFill.style.backgroundColor = '#ff0000'; // Red
    }
}

// Update the player death function
function playerDeath() {
    if (!isPlayerDead) {
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
    playerHealth = 100;
    updateHealthBar();
    car.position.set(0, 0.5, 0);
    car.rotation.y = 0;
    car.visible = true;
    isPlayerDead = false;
    currentSpeed = 0;
}

// Add socket event listeners for damage
socket.on('playerHit', () => {
    playerHealth -= 10; // Decrease health by 10
    updateHealthBar();
    
    if (playerHealth <= 0) {
        // Player is destroyed
        socket.emit('playerDestroyed');
        playerHealth = 100; // Reset health
        // Reset position
        car.position.set(0, 0.5, 0);
    }
});

// Add meta viewport tag to your HTML for proper mobile scaling
// Add this to your index.html <head> section:
// <meta name="viewport" content="width=device-width, initial-scale=1.0, maximum-scale=1.0, user-scalable=no"> 