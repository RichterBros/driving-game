import * as THREE from 'three'
import {OrbitControls} from 'three/addons/controls/OrbitControls.js'

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
document.body.appendChild(renderer.domElement);

// Orbit Controls
const controls = new OrbitControls(camera, renderer.domElement);
controls.enableDamping = true; // Smooth camera movement
controls.dampingFactor = 0.05;

// Lights
const ambientLight = new THREE.AmbientLight(0xffffff, 0.5);
scene.add(ambientLight);

const dirLight = new THREE.DirectionalLight(0xffffff, 1);
dirLight.position.set(10, 10, 10);
dirLight.castShadow = true;
scene.add(dirLight);

// Physics World
const world = new CANNON.World();
world.gravity.set(0, -9.82, 0);
world.broadphase = new CANNON.NaiveBroadphase();
world.solver.iterations = 10;

// Ground
const groundGeometry = new THREE.PlaneGeometry(20, 20);
const groundMaterial = new THREE.MeshStandardMaterial({ color: 0x808080 });
const groundMesh = new THREE.Mesh(groundGeometry, groundMaterial);
groundMesh.rotation.x = -Math.PI / 2;
groundMesh.receiveShadow = true;
scene.add(groundMesh);

const groundBody = new CANNON.Body({
    mass: 0,
    shape: new CANNON.Plane()
});
groundBody.quaternion.setFromAxisAngle(new CANNON.Vec3(1, 0, 0), -Math.PI / 2);
world.addBody(groundBody);

// Car body
const carWidth = 2;
const carHeight = 0.5;
const carLength = 4;

const carGeometry = new THREE.BoxGeometry(carLength, carHeight, carWidth);
const carMaterial = new THREE.MeshStandardMaterial({ color: 0x0000ff });
const carMesh = new THREE.Mesh(carGeometry, carMaterial);
carMesh.position.y = 2;
carMesh.castShadow = true;
scene.add(carMesh);

const carBody = new CANNON.Body({
    mass: 1500,
    shape: new CANNON.Box(new CANNON.Vec3(carLength/2, carHeight/2, carWidth/2))
});
carBody.position.copy(carMesh.position);
world.addBody(carBody);

// Wheels
const wheelRadius = 0.4;
const wheelThickness = 0.3;
const wheelPositions = [
    { x: -carLength/3, y: -carHeight/2, z: carWidth/2 + wheelThickness/2 },  // Front Left
    { x: -carLength/3, y: -carHeight/2, z: -carWidth/2 - wheelThickness/2 }, // Front Right
    { x: carLength/3, y: -carHeight/2, z: carWidth/2 + wheelThickness/2 },   // Back Left
    { x: carLength/3, y: -carHeight/2, z: -carWidth/2 - wheelThickness/2 }   // Back Right
];

const wheels = [];
const wheelBodies = [];

wheelPositions.forEach((pos) => {
    // Visual wheel
    const wheelGeometry = new THREE.CylinderGeometry(wheelRadius, wheelRadius, wheelThickness, 32);
    const wheelMaterial = new THREE.MeshStandardMaterial({ color: 0x202020 });
    const wheelMesh = new THREE.Mesh(wheelGeometry, wheelMaterial);
    
    // Update wheel rotation: first Z rotation for wheel orientation, then Y rotation to face forward
    wheelMesh.rotation.z = Math.PI / 2;
    wheelMesh.rotation.y = Math.PI / 2;
    
    wheelMesh.position.set(pos.x, pos.y, pos.z);
    wheelMesh.castShadow = true;
    carMesh.add(wheelMesh);
    wheels.push(wheelMesh);

    // Physical wheel - also update the physics body rotation
    const wheelShape = new CANNON.Cylinder(wheelRadius, wheelRadius, wheelThickness, 20);
    const wheelBody = new CANNON.Body({
        mass: 50,
        material: new CANNON.Material()
    });
    wheelBody.addShape(wheelShape);
    
    // Update physics body rotation to match visual rotation
    const q = new CANNON.Quaternion();
    q.setFromAxisAngle(new CANNON.Vec3(0, 0, 1), Math.PI / 2);
    const q2 = new CANNON.Quaternion();
    q2.setFromAxisAngle(new CANNON.Vec3(0, 1, 0), Math.PI / 2);
    q.mult(q2, q);
    wheelBody.quaternion.copy(q);
    
    wheelBody.position.set(
        carBody.position.x + pos.x,
        carBody.position.y + pos.y,
        carBody.position.z + pos.z
    );
    world.addBody(wheelBody);
    wheelBodies.push(wheelBody);

    // Update constraint axis to match new wheel orientation
    const constraint = new CANNON.HingeConstraint(carBody, wheelBody, {
        pivotA: new CANNON.Vec3(pos.x, pos.y, pos.z),
        axisA: new CANNON.Vec3(1, 0, 0), // Changed to X-axis for proper rotation
        maxForce: 1e6
    });
    world.addConstraint(constraint);
});

// Animation loop
const timeStep = 1/60;
function animate() {
    requestAnimationFrame(animate);

    // Update physics
    world.step(timeStep);

    // Update car position
    carMesh.position.copy(carBody.position);
    carMesh.quaternion.copy(carBody.quaternion);

    // Update controls
    controls.update();
    
    // Render
    renderer.render(scene, camera);
}

// Handle window resize
window.addEventListener('resize', () => {
    camera.aspect = window.innerWidth / window.innerHeight;
    camera.updateProjectionMatrix();
    renderer.setSize(window.innerWidth, window.innerHeight);
});

animate();
