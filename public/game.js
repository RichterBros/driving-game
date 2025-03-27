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

// Add to the controls section
const keys = {
    ArrowUp: false,
    ArrowDown: false,
    ArrowLeft: false,
    ArrowRight: false,
    ' ': false  // Space bar
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
    Object.keys(serverPlayers).forEach((id) => {
        if (id !== socket.id) {
            addPlayer(id, serverPlayers[id]);
        }
    });
});

socket.on('newPlayer', (playerInfo) => {
    addPlayer(playerInfo.id, playerInfo);
});

socket.on('playerMoved', (playerInfo) => {
    if (players[playerInfo.id]) {
        players[playerInfo.id].position = playerInfo.position;
        players[playerInfo.id].rotation = playerInfo.rotation;
    }
});

socket.on('playerDisconnected', (playerId) => {
    if (players[playerId]) {
        scene.remove(players[playerId]);
        delete players[playerId];
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

// Add bullet creation function
function createBullet(gun) {
    const bulletGeometry = new THREE.SphereGeometry(0.1);
    const bulletMaterial = new THREE.MeshStandardMaterial({ 
        color: 0xff0000,
        emissive: 0xff0000,
        emissiveIntensity: 0.5
    });
    const bullet = new THREE.Mesh(bulletGeometry, bulletMaterial);
    
    // Position bullet at gun position
    bullet.position.copy(gun.getWorldPosition(new THREE.Vector3()));
    bullet.rotation.copy(car.rotation);
    
    // Add creation time for lifetime tracking
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

// Add damage system variables
const BULLET_DAMAGE = 10; // Damage per bullet hit

// Add health display to HTML
const healthDisplay = document.createElement('div');
healthDisplay.style.position = 'absolute';
healthDisplay.style.bottom = '20px';
healthDisplay.style.left = '20px';
healthDisplay.style.padding = '10px';
healthDisplay.style.backgroundColor = 'rgba(0, 0, 0, 0.5)';
healthDisplay.style.color = 'white';
healthDisplay.style.borderRadius = '5px';
healthDisplay.style.fontFamily = 'Arial';
document.body.appendChild(healthDisplay);

// Add health bar
const healthBar = document.createElement('div');
healthBar.style.width = '200px';
healthBar.style.height = '20px';
healthBar.style.border = '2px solid white';
healthBar.style.borderRadius = '10px';
healthBar.style.overflow = 'hidden';
healthDisplay.appendChild(healthBar);

const healthFill = document.createElement('div');
healthFill.style.width = '100%';
healthFill.style.height = '100%';
healthFill.style.backgroundColor = '#00ff00';
healthFill.style.transition = 'width 0.3s, background-color 0.3s';
healthBar.appendChild(healthFill);

// Add explosion effect function
function createExplosion(position) {
    const particleCount = 30;
    const particles = [];
    
    for (let i = 0; i < particleCount; i++) {
        const geometry = new THREE.SphereGeometry(0.3);
        const material = new THREE.MeshBasicMaterial({
            color: Math.random() < 0.5 ? 0xff4500 : 0xff8c00
        });
        const particle = new THREE.Mesh(geometry, material);
        
        particle.position.copy(position);
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
    
    return particles;
}

// Game loop
function animate() {
    requestAnimationFrame(animate);

    if (localPlayer) {
        const rotationSpeed = 0.03;

        // Store previous position
        const previousPosition = car.position.clone();

        // Handle acceleration and movement
        if (keys.ArrowUp) {
            currentSpeed = Math.min(currentSpeed + ACCELERATION, MAX_SPEED);
        } else if (keys.ArrowDown) {
            currentSpeed = Math.max(currentSpeed - ACCELERATION, -MAX_SPEED * 0.5);
        } else {
            // Decelerate when no input
            if (currentSpeed > 0) {
                currentSpeed = Math.max(0, currentSpeed - DECELERATION);
            } else if (currentSpeed < 0) {
                currentSpeed = Math.min(0, currentSpeed + DECELERATION);
            }
        }

        // Apply movement based on current speed
        car.position.x -= Math.sin(car.rotation.y) * currentSpeed;
        car.position.z -= Math.cos(car.rotation.y) * currentSpeed;

        // Turning
        if (keys.ArrowLeft) car.rotation.y += rotationSpeed * (Math.abs(currentSpeed) / MAX_SPEED);
        if (keys.ArrowRight) car.rotation.y -= rotationSpeed * (Math.abs(currentSpeed) / MAX_SPEED);

        // Handle shooting
        if (keys[' ']) {
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

        // Update bullets and check collisions
        const currentTime = Date.now();
        for (let i = bullets.length - 1; i >= 0; i--) {
            const bullet = bullets[i];
            
            // Move bullet
            bullet.position.x -= Math.sin(bullet.rotation.y) * BULLET_SPEED;
            bullet.position.z -= Math.cos(bullet.rotation.y) * BULLET_SPEED;
            
            // Check collision with other players
            Object.keys(players).forEach(id => {
                if (id !== socket.id) {
                    const player = players[id];
                    const dx = bullet.position.x - player.position.x;
                    const dz = bullet.position.z - player.position.z;
                    const distance = Math.sqrt(dx * dx + dz * dz);
                    
                    if (distance < 2) { // Hit detection radius
                        // Remove bullet
                        scene.remove(bullet);
                        bullets.splice(i, 1);
                        
                        // Update health
                        player.health -= BULLET_DAMAGE;
                        updateHealthBar(player.health);
                        
                        // Check for destruction
                        if (player.health <= 0) {
                            createExplosion(player.position);
                            scene.remove(player);
                            delete players[id];
                        }
                    }
                }
            });
            
            // Remove old bullets
            if (currentTime - bullet.createdAt > BULLET_LIFETIME) {
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

        // Emit position to server
        socket.emit('playerMovement', {
            position: car.position,
            rotation: car.rotation
        });
    }

    // Update other players
    Object.keys(players).forEach((id) => {
        if (players[id]) {
            const player = players[id];
            player.position.lerp(player.position, 0.1);
            player.rotation.y = player.rotation.y;
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
function updateHealthBar(health) {
    const percentage = Math.max(0, Math.min(100, health));
    healthFill.style.width = percentage + '%';
    
    // Change color based on health
    if (percentage > 60) {
        healthFill.style.backgroundColor = '#00ff00'; // Green
    } else if (percentage > 30) {
        healthFill.style.backgroundColor = '#ffff00'; // Yellow
    } else {
        healthFill.style.backgroundColor = '#ff0000'; // Red
    }
} 