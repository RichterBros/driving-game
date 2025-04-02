import * as THREE from 'three'
import {OrbitControls} from 'three/addons/controls/OrbitControls.js'
import {GLTFLoader} from 'three/addons/loaders/GLTFLoader.js'

// Constants
const FORWARD_FORCE = 500;
const BACKWARD_FORCE = -500;
const WHEEL_ROTATION_SPEED = 20;
const ACCELERATION_RATE = 0.1;      // How quickly the car speeds up
const DECELERATION_RATE = 0.05;     // How quickly the car slows down
const MAX_SPEED = 3.0;              // Maximum speed multiplier
const MIN_SPEED = 0.0;              // Minimum speed multiplier
const RAMP_ANGLE = Math.PI / 6;  // 30 degrees
const RAMP_DIMENSIONS = {
    width: 5,    // Width of the ramp
    height: 2,   // Height at the tall end
    length: 8    // Length of the ramp
};

// Declare variables at the top
let carMesh = null;

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
world.gravity.set(0, -9.82, 0);
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
const groundMaterial = new CANNON.Material('ground');
const wheelMaterial = new CANNON.Material('wheel');

// Contact material
const wheelGroundContact = new CANNON.ContactMaterial(
    groundMaterial,
    wheelMaterial,
    {
        friction: 0.8,
        restitution: 0.1,
        contactEquationStiffness: 1e8,
        contactEquationRelaxation: 3
    }
);
world.addContactMaterial(wheelGroundContact);

// Ground body
const groundBody = new CANNON.Body({
    mass: 0,
    material: groundMaterial,
    shape: new CANNON.Plane(),
    position: new CANNON.Vec3(0, 0, 0)
});
groundBody.quaternion.setFromEuler(-Math.PI / 2, 0, 0);
world.addBody(groundBody);

// Ground mesh
const groundGeometry = new THREE.PlaneGeometry(50, 50);
const groundVisualMaterial = new THREE.MeshStandardMaterial({ 
    color: 0x808080,
    roughness: 0.8,
    metalness: 0.2
});
const groundMesh = new THREE.Mesh(groundGeometry, groundVisualMaterial);
groundMesh.receiveShadow = true;
groundMesh.rotation.x = -Math.PI / 2;
scene.add(groundMesh);

// Grid Helper
const gridHelper = new THREE.GridHelper(50, 50);
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
const rampMesh = new THREE.Mesh(rampGeometry, rampMaterial);
rampMesh.position.set(-10, RAMP_DIMENSIONS.height/2, 0); // Position in front of starting position
rampMesh.rotation.z = -RAMP_ANGLE;  // Tilt the ramp
rampMesh.castShadow = true;
rampMesh.receiveShadow = true;
scene.add(rampMesh);

// Ramp - Physics
const rampShape = new CANNON.Box(new CANNON.Vec3(
    RAMP_DIMENSIONS.length/2,
    RAMP_DIMENSIONS.height/2,
    RAMP_DIMENSIONS.width/2
));
const rampBody = new CANNON.Body({
    mass: 0,  // Static body
    material: groundMaterial,
    shape: rampShape,
    position: new CANNON.Vec3(-10, RAMP_DIMENSIONS.height/2, 0)
});
rampBody.quaternion.setFromEuler(-0, 0, -RAMP_ANGLE);  // Match visual rotation
world.addBody(rampBody);

// Create contact material for better ramp interaction
const rampContactMaterial = new CANNON.ContactMaterial(
    groundMaterial,
    wheelMaterial,
    {
        friction: 0.5,
        restitution: 0.3,
        contactEquationStiffness: 1e8,
        contactEquationRelaxation: 3
    }
);
world.addContactMaterial(rampContactMaterial);

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
function addBarrier(x, z, rotation = 0) {
    const barrierGeometry = new THREE.BoxGeometry(0.5, 1, 2);
    const barrierMaterial = new THREE.MeshStandardMaterial({ color: 0xff0000 });
    const barrier = new THREE.Mesh(barrierGeometry, barrierMaterial);
    barrier.position.set(x, 0.5, z);
    barrier.rotation.y = rotation;
    barrier.castShadow = true;
    scene.add(barrier);

    // Add physics body for barrier
    const barrierBody = new CANNON.Body({
        mass: 0,
        shape: new CANNON.Box(new CANNON.Vec3(0.25, 0.5, 1)),
        position: new CANNON.Vec3(x, 0.5, z)
    });
    barrierBody.quaternion.setFromEuler(0, rotation, 0);
    world.addBody(barrierBody);
}

// Add barriers around the ramp
addBarrier(-10, RAMP_DIMENSIONS.width/2 + 1, 0);
addBarrier(-10, -RAMP_DIMENSIONS.width/2 - 1, 0);

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
spotLight.position.set(-10, 10, 0);
spotLight.angle = Math.PI / 6;
spotLight.penumbra = 0.5;
spotLight.decay = 2;
spotLight.distance = 30;
spotLight.target = rampMesh;
spotLight.castShadow = true;
scene.add(spotLight);

// Car body - PHYSICS
const carBody = new CANNON.Body({
    mass: 1500,
    material: wheelMaterial,
    shape: new CANNON.Box(new CANNON.Vec3(carDimensions.length/2, carDimensions.height/2, carDimensions.width/2)),
    position: new CANNON.Vec3(0, 3, 0),
    angularDamping: 0.5,
    linearDamping: 0.5
});
world.addBody(carBody);

// Car body - VISUAL
const loader = new GLTFLoader();

// Load the car model
loader.load(
    '/car2.glb',
    function (gltf) {
        carMesh = gltf.scene;
        carMesh.position.set(0, 2, 0);
        scene.add(carMesh);
        console.log('Model loaded successfully');
    },
    function (xhr) {
        console.log((xhr.loaded / xhr.total * 100) + '% loaded');
    },
    function (error) {
        console.error('Error loading model:', error);
    }
);

// Wheel geometry and material for visual wheels
const wheelGeometry = new THREE.CylinderGeometry(
    carDimensions.wheelRadius,
    carDimensions.wheelRadius,
    carDimensions.width * 0.2,
    32
);
wheelGeometry.rotateZ(Math.PI / 2);
const wheelVisualMaterial = new THREE.MeshStandardMaterial({ color: 0x202020 });

// Create wheels
wheelPositions.forEach((pos, index) => {
    // Create wheel physics body
    const wheelBody = new CANNON.Body({
        mass: 50,
        material: wheelMaterial,
        shape: new CANNON.Sphere(carDimensions.wheelRadius),
        position: new CANNON.Vec3(
            carBody.position.x + pos.x,
            carBody.position.y + pos.y,
            carBody.position.z + pos.z
        ),
        angularDamping: 0.4,
        linearDamping: 0.4
    });
    
    world.addBody(wheelBody);
    wheelBodies.push(wheelBody);

    // Create wheel visual mesh
    const wheelMesh = new THREE.Mesh(wheelGeometry, wheelVisualMaterial);
    wheelMesh.castShadow = true;
    scene.add(wheelMesh);
    wheelMeshes.push(wheelMesh);

    // Store wheels in their respective arrays
    if (index < 2) {
        frontWheels.push(wheelBody);
    } else {
        backWheels.push(wheelBody);
    }

    // Connect wheel to car
    const constraint = new CANNON.HingeConstraint(carBody, wheelBody, {
        pivotA: new CANNON.Vec3(pos.x, pos.y, pos.z),
        axisA: new CANNON.Vec3(0, 0, 1),
        maxForce: 1e6
    });
    world.addConstraint(constraint);
});

// Connect wheels on each axle
function connectWheels(wheel1, wheel2) {
    const constraint = new CANNON.DistanceConstraint(wheel1, wheel2, 2.4);
    world.addConstraint(constraint);
}

// Connect front and back axles
connectWheels(frontWheels[0], frontWheels[1]);
connectWheels(backWheels[0], backWheels[1]);

// Keyboard controls
const keysPressed = {
    w: false,
    s: false,
    a: false,
    d: false,
    e: false  // Added for hop
};

// Add keyboard event listeners
document.addEventListener('keydown', (event) => {
    switch(event.key.toLowerCase()) {
        case 'w': keysPressed.w = true; break;
        case 's': keysPressed.s = true; break;
        case 'a': keysPressed.a = true; break;
        case 'd': keysPressed.d = true; break;
        case 'e': keysPressed.e = true; break;
    }
});

document.addEventListener('keyup', (event) => {
    switch(event.key.toLowerCase()) {
        case 'w': keysPressed.w = false; break;
        case 's': keysPressed.s = false; break;
        case 'a': keysPressed.a = false; break;
        case 'd': keysPressed.d = false; break;
        case 'e': keysPressed.e = false; break;
    }
});

// Update physics world properties to match sphere behavior
world.gravity.set(0, -9.82, 0);
world.solver.iterations = 20;
world.defaultContactMaterial.contactEquationStiffness = 1e8;
world.defaultContactMaterial.contactEquationRelaxation = 3;

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
const sphereMesh = new THREE.Mesh(sphereGeometry, sphereMaterial);
sphereMesh.castShadow = true;
sphereMesh.position.set(5, 10, 5); // Position it above and to the side of the car
scene.add(sphereMesh);

// Create sphere physics body
const sphereBody = new CANNON.Body({
    mass: 5,
    material: wheelMaterial, // Use same material as vehicle
    shape: new CANNON.Sphere(sphereRadius),
    position: new CANNON.Vec3(5, 10, 5),
    linearDamping: 0.3,
    angularDamping: 0.3
});
world.addBody(sphereBody);

// Add this variable with your other declarations
let speedMultiplier = 0;

// Animation loop
const timeStep = 1/60;
function animate() {
    requestAnimationFrame(animate);
    
    // Only try to update the car if it's loaded
    if (carMesh) {
        // Update car position and rotation
        carMesh.position.copy(carBody.position);
        carMesh.quaternion.copy(carBody.quaternion);
    }

    // Handle acceleration and deceleration
    if (keysPressed.w) {
        // Accelerate while W is held
        speedMultiplier = Math.min(speedMultiplier + ACCELERATION_RATE, MAX_SPEED);
    } else {
        // Decelerate when W is released
        speedMultiplier = Math.max(speedMultiplier - DECELERATION_RATE, MIN_SPEED);
    }

    // Apply damping to wheel rotation when no input
    if (!keysPressed.w && !keysPressed.s) {
        wheelBodies.forEach(wheel => {
            wheel.angularVelocity.scale(0.95);
        });
    }

    // Forward movement with acceleration
    if (keysPressed.w) {
        const currentForce = FORWARD_FORCE * speedMultiplier;
        const currentRotation = WHEEL_ROTATION_SPEED * speedMultiplier;
        
        backWheels.forEach(wheel => {
            wheel.applyLocalForce(new CANNON.Vec3(currentForce, 0, 0), new CANNON.Vec3(0, 0, 0));
            wheel.angularVelocity.set(0, 0, -currentRotation);
        });
        frontWheels.forEach(wheel => {
            wheel.angularVelocity.set(0, 0, -currentRotation);
        });
    }

    // Backward movement (keeping it simple for now)
    if (keysPressed.s) {
        backWheels.forEach(wheel => {
            wheel.applyLocalForce(new CANNON.Vec3(BACKWARD_FORCE, 0, 0), new CANNON.Vec3(0, 0, 0));
            wheel.angularVelocity.set(0, 0, WHEEL_ROTATION_SPEED);
        });
        frontWheels.forEach(wheel => {
            wheel.angularVelocity.set(0, 0, WHEEL_ROTATION_SPEED);
        });
    }

    // Handle steering
    if (keysPressed.a || keysPressed.d) {
        const steeringAngle = keysPressed.a ? Math.PI / 6 : -Math.PI / 6;
        
        // Create quaternion for steering
        const steeringQuaternion = new CANNON.Quaternion();
        steeringQuaternion.setFromAxisAngle(new CANNON.Vec3(0, 1, 0), steeringAngle);
        
        // Apply steering to front wheels
        const baseRotation = new CANNON.Quaternion();
        baseRotation.setFromAxisAngle(new CANNON.Vec3(1, 0, 0), Math.PI / 2);
        
        const finalRotation = steeringQuaternion.mult(baseRotation);
        wheelBodies[0].quaternion.copy(finalRotation);
        wheelBodies[1].quaternion.copy(finalRotation);
    }

    // Handle hop
    if (keysPressed.e) {
        const currentTime = Date.now();
        if (currentTime - lastJumpTime > JUMP_COOLDOWN) {
            // Apply upward force to car body
            carBody.applyLocalImpulse(
                new CANNON.Vec3(0, JUMP_FORCE, 0),
                new CANNON.Vec3(0, 0, 0)
            );
            lastJumpTime = currentTime;
        }
    }

    // Update physics
    world.step(1/60);

    // Update visuals
    wheelBodies.forEach((wheelBody, i) => {
        wheelMeshes[i].position.copy(wheelBody.position);
        wheelMeshes[i].quaternion.copy(wheelBody.quaternion);
    });

    // Update sphere position
    sphereMesh.position.copy(sphereBody.position);
    sphereMesh.quaternion.copy(sphereBody.quaternion);

    controls.update();
    renderer.render(scene, camera);
}

// Handle window resize
window.addEventListener('resize', () => {
    camera.aspect = window.innerWidth / window.innerHeight;
    camera.updateProjectionMatrix();
    renderer.setSize(window.innerWidth, window.innerHeight);
});

animate();