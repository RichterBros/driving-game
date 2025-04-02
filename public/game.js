import * as THREE from 'three'
import {OrbitControls} from 'three/addons/controls/OrbitControls.js'
import {GLTFLoader} from 'three/addons/loaders/GLTFLoader.js'

// Constants
const FORWARD_FORCE = 500;
const BACKWARD_FORCE = -500;
const WHEEL_ROTATION_SPEED = 20;
const DECELERATION_RATE = 0.05;     // How quickly the car slows down
const MAX_SPEED = 1.0;              // Maximum speed multiplier
const MIN_SPEED = 0.0;              // Minimum speed multiplier
const RAMP_ANGLE = Math.PI / 6;  // 30 degrees
const RAMP_DIMENSIONS = {
    width: 5,    // Width of the ramp
    height: 1,   // Reduced from 2 to 1 for lower height
    length: 8    // Length of the ramp
};

// Add these constants for car movement
const MOVE_SPEED = 0.1;
const TURN_SPEED = 0.03;
const BRAKE_RATE = 0.01;
const MAX_SPEED_LIMIT = 50;  // Maximum speed limit
const ACCELERATION = 1000;  // How quickly the car speeds up
const DECELERATION = 500;   // How quickly the car slows down

// Add these constants for bullets
const BULLET_RADIUS = 0.3;  // Increased from 0.1 to 0.3 for bigger bullets
const BULLET_SPEED = 50;
const BULLET_LIFETIME = 2000; // 2 seconds
const BULLET_COOLDOWN = 100; // milliseconds between shots

// Add these constants for smoke particles
const SMOKE_PARTICLES = 10;  // Number of particles per shot
const SMOKE_LIFETIME = 500; // Reduced from 1000 to 500ms for faster fade out
const SMOKE_SPREAD = 2.0;    // Increased from 0.5 to 2.0 for wider spread

// Add skid mark constants
const SKID_MARK_PARTICLES = 5;  // Number of particles per skid mark
const SKID_MARK_LIFETIME = 2000; // How long skid marks last (ms)
const SKID_MARK_SPREAD = 0.2;    // Reduced from 0.5 to 0.2 for tighter spread
const SKID_MARK_THRESHOLD = 0.5;  // Minimum angular velocity to create skid marks

// Declare variables at the top
let carMesh = null;
let carBody = null;
let currentSpeed = 0;
let currentRotation = 0;
let targetSpeed = 0;

// Add these variables for bullet management
let bullets = [];
let lastBulletTime = 0;

// Add this with other variables at the top
let smokeParticles = [];

// Add this after other material definitions
const smokeGeometry = new THREE.SphereGeometry(0.3, 8, 8);
const smokeMaterial = new THREE.MeshStandardMaterial({
    color: 0x888888,
    transparent: true,
    opacity: 0.8,
    roughness: 0.9,
    metalness: 0.1
});

// Add skid mark material
const skidMarkMaterial = new THREE.MeshStandardMaterial({
    color: 0x333333,
    transparent: true,
    opacity: 0.8,
    roughness: 0.9,
    metalness: 0.1
});

// Scene setup
const scene = new THREE.Scene();
scene.background = new THREE.Color(0x87ceeb); // Sky blue

// Camera
const camera = new THREE.PerspectiveCamera(75, window.innerWidth / window.innerHeight, 0.1, 1000);
camera.position.set(10, 10, 10);
camera.lookAt(0, 0, 0);

// Renderer
const renderer = new THREE.WebGLRenderer({ antialias: true });
renderer.setSize(window.innerWidth, window.innerHeight);
renderer.shadowMap.enabled = true;
renderer.shadowMap.type = THREE.PCFSoftShadowMap;
document.body.appendChild(renderer.domElement);

// Orbit Controls
const controls = new OrbitControls(camera, renderer.domElement);
controls.enableDamping = true; // Smooth camera movement
controls.dampingFactor = 0.05;

// Lights
const ambientLight = new THREE.AmbientLight(0xffffff, 0.6);
scene.add(ambientLight);

const dirLight = new THREE.DirectionalLight(0xffffff, 0.8);
dirLight.position.set(10, 10, 10);
dirLight.castShadow = true;
scene.add(dirLight);

// Physics World
const world = new CANNON.World();
world.gravity.set(0, -30, 0);  // Increased gravity
world.solver.iterations = 10;
world.solver.tolerance = 0.001;
world.defaultContactMaterial.friction = 0.001;

// Car dimensions
const carDimensions = {
    width: 2,
    height: 0.5,
    length: 4,
    wheelRadius: 0.4
};

// Wheel positions relative to car center
const wheelPositions = [
    { x: -1.5, y: -0.25, z: 1.2 },  // Front Left
    { x: -1.5, y: -0.25, z: -1.2 }, // Front Right
    { x: 1.5, y: -0.25, z: 1.2 },   // Back Left
    { x: 1.5, y: -0.25, z: -1.2 }   // Back Right
];

// Arrays to store objects
const wheelBodies = [];
const wheelMeshes = [];
const frontWheels = [];
const backWheels = [];

// Physics Materials
const groundPhysMaterial = new CANNON.Material('ground');
const wheelMaterial = new CANNON.Material('wheel');
const carPhysMaterial = new CANNON.Material('car');
const spherePhysMaterial = new CANNON.Material('sphere');  // Add sphere material

// Contact material
const wheelGroundContact = new CANNON.ContactMaterial(
    groundPhysMaterial,
    wheelMaterial,
    {
        friction: 0.8,
        restitution: 0.1,
        contactEquationStiffness: 1e8,
        contactEquationRelaxation: 3
    }
);
world.addContactMaterial(wheelGroundContact);

// Contact material for sphere
const sphereGroundContact = new CANNON.ContactMaterial(
    groundPhysMaterial,
    spherePhysMaterial,
    {
        friction: 0.3,
        restitution: 0.8,  // More bouncy
        contactEquationStiffness: 1e8,
        contactEquationRelaxation: 3
    }
);
world.addContactMaterial(sphereGroundContact);

// Contact material for sphere and car
const sphereCarContact = new CANNON.ContactMaterial(
    carPhysMaterial,
    spherePhysMaterial,
    {
        friction: 0.5,
        restitution: 0.7,
        contactEquationStiffness: 1e8,
        contactEquationRelaxation: 3
    }
);
world.addContactMaterial(sphereCarContact);

// Ground body
const groundBody = new CANNON.Body({
    mass: 0,
    material: groundPhysMaterial,
    shape: new CANNON.Plane(),
    position: new CANNON.Vec3(0, 0, 0)
});
groundBody.quaternion.setFromEuler(-Math.PI / 2, 0, 0);
world.addBody(groundBody);

// Ground mesh
const groundGeometry = new THREE.PlaneGeometry(500, 500);
const groundVisualMaterial = new THREE.MeshStandardMaterial({ 
    color: 0x00ff00,
    roughness: 0.8,
    metalness: 0.2
});
const groundMesh = new THREE.Mesh(groundGeometry, groundVisualMaterial);
groundMesh.receiveShadow = true;
groundMesh.rotation.x = -Math.PI / 2;
scene.add(groundMesh);

// Grid Helper
const gridHelper = new THREE.GridHelper(500, 50);
scene.add(gridHelper);

// Ramp - Visual
const rampGeometry = new THREE.BoxGeometry(
    RAMP_DIMENSIONS.length,
    RAMP_DIMENSIONS.height,
    RAMP_DIMENSIONS.width
);
const rampMaterial = new THREE.MeshStandardMaterial({ 
    color: 0x444444,
    roughness: 0.7
});

// Create array to store all ramps
const ramps = [
    { position: new THREE.Vector3(-20, RAMP_DIMENSIONS.height/2, 0), rotation: -RAMP_ANGLE },     // Original ramp, moved further left
    { position: new THREE.Vector3(20, RAMP_DIMENSIONS.height/2, 0), rotation: RAMP_ANGLE },       // Opposite direction, moved further right
    { position: new THREE.Vector3(0, RAMP_DIMENSIONS.height/2, 20), rotation: -RAMP_ANGLE/2 },    // Forward ramp, moved further forward
    { position: new THREE.Vector3(0, RAMP_DIMENSIONS.height/2, -20), rotation: RAMP_ANGLE/2 }     // Backward ramp, moved further back
];

// Create visual and physics bodies for all ramps
ramps.forEach(ramp => {
    // Visual ramp
    const rampMesh = new THREE.Mesh(rampGeometry, rampMaterial);
    rampMesh.position.copy(ramp.position);
    rampMesh.rotation.z = ramp.rotation;
    rampMesh.castShadow = true;
    rampMesh.receiveShadow = true;
    scene.add(rampMesh);

    // Physics ramp
    const rampShape = new CANNON.Box(new CANNON.Vec3(
        RAMP_DIMENSIONS.length/2,
        RAMP_DIMENSIONS.height/2,
        RAMP_DIMENSIONS.width/2
    ));
    const rampBody = new CANNON.Body({
        mass: 0,
        material: groundPhysMaterial,
        shape: rampShape,
        position: new CANNON.Vec3(ramp.position.x, ramp.position.y, ramp.position.z)
    });
    rampBody.quaternion.setFromEuler(0, 0, ramp.rotation);
    world.addBody(rampBody);
});

// Optional: Add guide arrows or markers
const arrowHelper = new THREE.ArrowHelper(
    new THREE.Vector3(-1, 0, 0),
    new THREE.Vector3(-20, 0.5, 0),
    5,
    0xff0000,
    1,
    0.5
);
scene.add(arrowHelper);

// Optional: Add some decorative elements around the ramp
//function addBarrier(x, z, rotation = 0) {
//    const barrierGeometry = new THREE.BoxGeometry(0.5, 1, 2);
//    const barrierMaterial = new THREE.MeshStandardMaterial({ color: 0xff0000 });
//    const barrier = new THREE.Mesh(barrierGeometry, barrierMaterial);
//    barrier.position.set(x, 0.5, z);
//    barrier.rotation.y = rotation;
    //barrier.castShadow = true;
//    scene.add(barrier);

    // Add physics body for barrier
    //const barrierBody = new CANNON.Body({
    //    mass: 0,
    //    shape: new CANNON.Box(new CANNON.Vec3(0.25, 0.5, 1)),
    //    position: new CANNON.Vec3(x, 0.5, z)
    //});
    //barrierBody.quaternion.setFromEuler(0, rotation, 0);
    //world.addBody(barrierBody);
//}

// Add barriers around the ramp
//addBarrier(-10, RAMP_DIMENSIONS.width/2 + 1, 0);
//addBarrier(-10, -RAMP_DIMENSIONS.width/2 - 1, 0);

// Optional: Add landing zone marker
const landingZoneGeometry = new THREE.PlaneGeometry(5, 5);
const landingZoneMaterial = new THREE.MeshStandardMaterial({ 
    color: 0x00ff00,
    transparent: true,
    opacity: 0.5
});
const landingZone = new THREE.Mesh(landingZoneGeometry, landingZoneMaterial);
landingZone.rotation.x = -Math.PI / 2;
landingZone.position.set(-15, 0.01, 0);  // Slightly above ground to prevent z-fighting
scene.add(landingZone);

// Optional: Add spotlights to highlight the ramp
const spotLight = new THREE.SpotLight(0xffffff, 1);
spotLight.position.set(-20, 10, 0);
spotLight.angle = Math.PI / 6;
spotLight.penumbra = 0.5;
spotLight.decay = 2;
spotLight.distance = 30;

// Create a target object for the spotlight
const spotLightTarget = new THREE.Object3D();
spotLightTarget.position.set(-20, 0, 0);
scene.add(spotLightTarget);
spotLight.target = spotLightTarget;
spotLight.castShadow = true;
scene.add(spotLight);

// Add more spotlights for other ramps
const spotLight2 = new THREE.SpotLight(0xffffff, 1);
spotLight2.position.set(20, 10, 0);
spotLight2.angle = Math.PI / 6;
spotLight2.penumbra = 0.5;
spotLight2.decay = 2;
spotLight2.distance = 30;

const spotLightTarget2 = new THREE.Object3D();
spotLightTarget2.position.set(20, 0, 0);
scene.add(spotLightTarget2);
spotLight2.target = spotLightTarget2;
spotLight2.castShadow = true;
scene.add(spotLight2);

const spotLight3 = new THREE.SpotLight(0xffffff, 1);
spotLight3.position.set(0, 10, 20);
spotLight3.angle = Math.PI / 6;
spotLight3.penumbra = 0.5;
spotLight3.decay = 2;
spotLight3.distance = 30;

const spotLightTarget3 = new THREE.Object3D();
spotLightTarget3.position.set(0, 0, 20);
scene.add(spotLightTarget3);
spotLight3.target = spotLightTarget3;
spotLight3.castShadow = true;
scene.add(spotLight3);

const spotLight4 = new THREE.SpotLight(0xffffff, 1);
spotLight4.position.set(0, 10, -20);
spotLight4.angle = Math.PI / 6;
spotLight4.penumbra = 0.5;
spotLight4.decay = 2;
spotLight4.distance = 30;

const spotLightTarget4 = new THREE.Object3D();
spotLightTarget4.position.set(0, 0, -20);
scene.add(spotLightTarget4);
spotLight4.target = spotLightTarget4;
spotLight4.castShadow = true;
scene.add(spotLight4);

// Load the car model
const loader = new GLTFLoader();
loader.load(
    '/car2.glb',
    function (gltf) {
        carMesh = gltf.scene;
        carMesh.position.set(0, 3, 0);
        carMesh.scale.set(0.5, 0.5, 0.5);
        
        carMesh.rotation.y = Math.PI;
        
        // Adjusted car physics body
        const carShape = new CANNON.Box(new CANNON.Vec3(1, 0.3, 2)); // Made car lower
        carBody = new CANNON.Body({
            mass: 2000,              // Increased mass
            material: carPhysMaterial,
            shape: carShape,
            position: new CANNON.Vec3(0, 3, 0),
            angularDamping: 0.5,     // Reduced to allow more rotation
            linearDamping: 0.3,
            fixedRotation: false,    // Allow rotation from collisions
            allowSleep: false        // Never let the body sleep
        });
        
        carBody.quaternion.setFromEuler(0, Math.PI, 0);
        
        // Lower center of mass more
        carBody.shapeOffsets[0].y = -0.3;
        carBody.updateMassProperties();
        
        world.addBody(carBody);
        scene.add(carMesh);
        
        console.log('Car loaded successfully');
    },
    function (xhr) {
        console.log((xhr.loaded / xhr.total * 100) + '% loaded');
    },
    function (error) {
        console.error('Error loading car:', error);
    }
);

// Wheel geometry and material for visual wheels


// Create wheels


    // Create wheel visual mesh
   

   

    // Connect wheel to car


// Add keyboard state tracking
const keysPressed = {
    w: false,
    s: false,
    a: false,
    d: false,
    space: false
};

// Add keyboard event listeners
document.addEventListener('keydown', (event) => {
    console.log('Key pressed:', event.key);
    switch(event.key.toLowerCase()) {
        case 'w': keysPressed.w = true; break;
        case 's': keysPressed.s = true; break;
        case 'a': keysPressed.a = true; break;
        case 'd': keysPressed.d = true; break;
        case ' ': keysPressed.space = true; break;
    }
});

document.addEventListener('keyup', (event) => {
    switch(event.key.toLowerCase()) {
        case 'w': keysPressed.w = false; break;
        case 's': keysPressed.s = false; break;
        case 'a': keysPressed.a = false; break;
        case 'd': keysPressed.d = false; break;
        case ' ': keysPressed.space = false; break;
    }
});

// Update physics world properties
world.gravity.set(0, -30, 0);  // Increased gravity
world.defaultContactMaterial.friction = 0.001;
world.solver.iterations = 10;
world.broadphase = new CANNON.NaiveBroadphase();

// Add jump constants
const JUMP_FORCE = 15000;
const JUMP_COOLDOWN = 500; // milliseconds
let lastJumpTime = 0;

// Create sphere
const sphereRadius = 1;
const sphereGeometry = new THREE.SphereGeometry(sphereRadius, 32, 32);
const sphereMaterial = new THREE.MeshStandardMaterial({ 
    color: 0xff0000,
    wireframe: false 
});

// Create arrays to store multiple spheres
const sphereMeshes = [];
const sphereBodies = [];

// Create 5 spheres at different positions
const spherePositions = [
    { x: 5, y: 10, z: 5 },    // Original position
    { x: -5, y: 10, z: 5 },   // Left side
    { x: 5, y: 10, z: -5 },   // Back
    { x: -5, y: 10, z: -5 },  // Back left
    { x: 0, y: 10, z: 0 }     // Center
];

// Create all spheres
spherePositions.forEach(pos => {
    const sphereMesh = new THREE.Mesh(sphereGeometry, sphereMaterial);
    sphereMesh.castShadow = true;
    sphereMesh.position.set(pos.x, pos.y, pos.z);
    scene.add(sphereMesh);
    sphereMeshes.push(sphereMesh);

    const sphereBody = new CANNON.Body({
        mass: 5,
        material: spherePhysMaterial,
        shape: new CANNON.Sphere(sphereRadius),
        position: new CANNON.Vec3(pos.x, pos.y, pos.z),
        linearDamping: 0.2,
        angularDamping: 0.2
    });
    world.addBody(sphereBody);
    sphereBodies.push(sphereBody);
});

// Add this variable with your other declarations
let speedMultiplier = 0;

// Add these variables near the top with other declarations
let cameraOffset = new THREE.Vector3(0, 10, 15); // Camera position relative to car
let cameraLerpFactor = 0.1; // How quickly camera follows (0-1, lower = more lag)

// Animation loop
const timeStep = 1/60;
function animate() {
    requestAnimationFrame(animate);
    
    world.step(1/60);
    
    if (carMesh && carBody) {
        // Handle speed changes
        if (keysPressed.w) {
            targetSpeed = MAX_SPEED_LIMIT;
        } else if (keysPressed.s) {
            targetSpeed = -MAX_SPEED_LIMIT;
        } else {
            targetSpeed = 0;
        }

        // Smoothly adjust current speed
        if (currentSpeed < targetSpeed) {
            currentSpeed = Math.min(currentSpeed + ACCELERATION * timeStep, targetSpeed);
        } else if (currentSpeed > targetSpeed) {
            currentSpeed = Math.max(currentSpeed - DECELERATION * timeStep, targetSpeed);
        }

        // Apply the force based on current speed
        if (currentSpeed !== 0) {
            const force = new CANNON.Vec3(0, 0, currentSpeed * 1000);
            carBody.applyLocalForce(force, new CANNON.Vec3(0, 0, 0));
        }
        
        // Improved turning with reduced speed
        if (keysPressed.a) {
            carBody.angularVelocity.set(0, 2, 0);  // Increased from 1 to 2 for faster left turns
        } else if (keysPressed.d) {
            carBody.angularVelocity.set(0, -2, 0); // Increased from -1 to -2 for faster right turns
        } else {
            carBody.angularVelocity.scale(0.9);   // Smoother rotation stop
        }

        // Update wheel positions and rotations
        wheelBodies.forEach((wheelBody, index) => {
            wheelMeshes[index].position.copy(wheelBody.position);
            wheelMeshes[index].quaternion.copy(wheelBody.quaternion);
        });

        // Only keep car upright if not in collision
        const velocity = carBody.velocity.length();
        if (velocity < 1) {
            // Keep car upright when moving slowly
            const carRotation = new CANNON.Vec3();
            carBody.quaternion.toEuler(carRotation);
            carBody.quaternion.setFromEuler(0, carRotation.y, 0);
        }

        // Update visual mesh
        carMesh.position.copy(carBody.position);
        carMesh.quaternion.copy(carBody.quaternion);

        // Handle bullet firing
        if (keysPressed.space) {
            const currentTime = Date.now();
            if (currentTime - lastBulletTime >= BULLET_COOLDOWN) {
                // Get car's forward direction
                const carDirection = new THREE.Vector3(0, 0, 1);
                carDirection.applyQuaternion(carMesh.quaternion);
                
                // Get bullet spawn position (slightly in front of the car)
                const spawnOffset = new THREE.Vector3(0, 0, 2);
                spawnOffset.applyQuaternion(carMesh.quaternion);
                const spawnPosition = new THREE.Vector3(
                    carMesh.position.x + spawnOffset.x,
                    carMesh.position.y + spawnOffset.y,
                    carMesh.position.z + spawnOffset.z
                );

                // Create smoke effect
                createSmokeEffect(spawnPosition);

                // Create and add new bullet
                bullets.push(createBullet(spawnPosition, carDirection));
                lastBulletTime = currentTime;
            }
        }

        // Add skid mark creation during turns
        const angularVelocity = carBody.angularVelocity.y;
        if (Math.abs(angularVelocity) > SKID_MARK_THRESHOLD) {
            // Get car's rear position
            const rearOffset = new THREE.Vector3(0, 0, -2); // 2 units behind the car's center
            rearOffset.applyQuaternion(carMesh.quaternion);
            const rearPosition = new THREE.Vector3(
                carBody.position.x + rearOffset.x,
                carBody.position.y + rearOffset.y,
                carBody.position.z + rearOffset.z
            );
            
            // Create skid marks at the rear
            createSkidMark(rearPosition);
        }
    }

    // Update bullets
    updateBullets();

    // Update all sphere positions
    sphereMeshes.forEach((mesh, index) => {
        mesh.position.copy(sphereBodies[index].position);
        mesh.quaternion.copy(sphereBodies[index].quaternion);
    });

    // Update smoke
    updateSmoke();

    // Camera look at car from fixed position
    if (carMesh && carBody) {
        // Keep camera in fixed position
        camera.position.set(0, 15, 25); // Lower height for a closer view
        
        // Make camera look at car
        camera.lookAt(carMesh.position);
    }

    renderer.render(scene, camera);
}

// Handle window resize
window.addEventListener('resize', () => {
    camera.aspect = window.innerWidth / window.innerHeight;
    camera.updateProjectionMatrix();
    renderer.setSize(window.innerWidth, window.innerHeight);
});

// Function to remove specific objects
function removeWheels() {
    const objectsToRemove = [];
    scene.traverse((object) => {
        // Check if the object is one of the old wheels
        if (object.name.includes('wheel') || 
            (object.geometry && object.geometry.type === 'CylinderGeometry')) {
            objectsToRemove.push(object);
        }
    });
    
    objectsToRemove.forEach((object) => {
        scene.remove(object);
    });
}

// Remove the wheels
removeWheels();

// Start animation
animate();

// Add bullet material
const bulletMaterial = new CANNON.Material('bullet');

// Add contact material for bullets
const bulletGroundContact = new CANNON.ContactMaterial(
    groundPhysMaterial,
    bulletMaterial,
    {
        friction: 0.3,
        restitution: 0.3,
        contactEquationStiffness: 1e8,
        contactEquationRelaxation: 3
    }
);
world.addContactMaterial(bulletGroundContact);

// Function to create a bullet
function createBullet(position, direction) {
    const bulletGeometry = new THREE.SphereGeometry(BULLET_RADIUS, 8, 8);
    const bulletVisualMaterial = new THREE.MeshStandardMaterial({ 
        color: 0xffff00,
        metalness: 0.8,
        roughness: 0.2
    });
    const bulletMesh = new THREE.Mesh(bulletGeometry, bulletVisualMaterial);
    bulletMesh.position.copy(position);
    bulletMesh.castShadow = true;
    scene.add(bulletMesh);

    const bulletBody = new CANNON.Body({
        mass: 0.1,
        material: bulletMaterial,
        shape: new CANNON.Sphere(BULLET_RADIUS),
        position: new CANNON.Vec3(position.x, position.y, position.z),
        linearDamping: 0.1,
        angularDamping: 0.1
    });

    // Apply initial velocity in the direction the car is facing
    const velocity = new CANNON.Vec3(direction.x, direction.y, direction.z);
    velocity.scale(BULLET_SPEED, bulletBody.velocity);
    
    world.addBody(bulletBody);

    return {
        mesh: bulletMesh,
        body: bulletBody,
        time: Date.now()
    };
}

// Function to update bullets
function updateBullets() {
    const currentTime = Date.now();
    
    // Remove old bullets
    bullets = bullets.filter(bullet => {
        const age = currentTime - bullet.time;
        if (age >= BULLET_LIFETIME) {
            scene.remove(bullet.mesh);
            world.removeBody(bullet.body);
            return false;
        }
        return true;
    });

    // Update bullet positions
    bullets.forEach(bullet => {
        bullet.mesh.position.copy(bullet.body.position);
        bullet.mesh.quaternion.copy(bullet.body.quaternion);
    });
}

// Add this function before the animation loop
function createSmokeEffect(position) {
    for (let i = 0; i < SMOKE_PARTICLES; i++) {
        const particle = new THREE.Mesh(smokeGeometry, smokeMaterial.clone());
        particle.position.copy(position);
        
        // Random spread
        particle.position.x += (Math.random() - 0.5) * SMOKE_SPREAD;
        particle.position.y += (Math.random() - 0.5) * SMOKE_SPREAD;
        particle.position.z += (Math.random() - 0.5) * SMOKE_SPREAD;
        
        // Random rotation
        particle.rotation.x = Math.random() * Math.PI;
        particle.rotation.y = Math.random() * Math.PI;
        particle.rotation.z = Math.random() * Math.PI;
        
        scene.add(particle);
        
        smokeParticles.push({
            mesh: particle,
            time: Date.now(),
            velocity: new THREE.Vector3(
                (Math.random() - 0.5) * 0.2,
                Math.random() * 0.2,
                (Math.random() - 0.5) * 0.2
            )
        });
    }
}

// Add this function before the animation loop
function updateSmoke() {
    const currentTime = Date.now();
    
    smokeParticles = smokeParticles.filter(particle => {
        const age = currentTime - particle.time;
        const lifetime = particle.isSkidMark ? SKID_MARK_LIFETIME : SMOKE_LIFETIME;
        
        if (age >= lifetime) {
            scene.remove(particle.mesh);
            return false;
        }
        
        // Update position
        particle.mesh.position.add(particle.velocity);
        
        // Update opacity
        const opacity = 1 - (age / lifetime);
        particle.mesh.material.opacity = opacity;
        
        // Update size - skid marks stay smaller and more consistent
        const size = particle.isSkidMark ? 
            0.2 + (age / lifetime) * 0.1 : // Skid marks
            0.3 + (age / lifetime) * 0.6;  // Smoke
        particle.mesh.scale.set(size, size, size);
        
        return true;
    });
}

// Add this function for creating skid marks
function createSkidMark(position) {
    for (let i = 0; i < SKID_MARK_PARTICLES; i++) {
        const particle = new THREE.Mesh(smokeGeometry, skidMarkMaterial.clone());
        particle.position.copy(position);
        
        // Random spread along the ground - reduced spread
        particle.position.x += (Math.random() - 0.5) * SKID_MARK_SPREAD;
        particle.position.y = 0.1; // Slightly above ground to prevent z-fighting
        particle.position.z += (Math.random() - 0.5) * SKID_MARK_SPREAD;
        
        // Random rotation
        particle.rotation.x = Math.random() * Math.PI;
        particle.rotation.y = Math.random() * Math.PI;
        particle.rotation.z = Math.random() * Math.PI;
        
        scene.add(particle);
        
        smokeParticles.push({
            mesh: particle,
            time: Date.now(),
            velocity: new THREE.Vector3(
                (Math.random() - 0.5) * 0.05,  // Reduced from 0.1 to 0.05
                0, // No vertical movement
                (Math.random() - 0.5) * 0.05   // Reduced from 0.1 to 0.05
            ),
            isSkidMark: true
        });
    }
}