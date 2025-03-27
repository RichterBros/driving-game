// Three.js setup
const scene = new THREE.Scene();
const camera = new THREE.PerspectiveCamera(75, window.innerWidth / window.innerHeight, 0.1, 1000);
const renderer = new THREE.WebGLRenderer();
renderer.setSize(window.innerWidth, window.innerHeight);
document.body.appendChild(renderer.domElement);

// Lighting
const ambientLight = new THREE.AmbientLight(0xffffff, 0.5);
scene.add(ambientLight);
const directionalLight = new THREE.DirectionalLight(0xffffff, 0.5);
directionalLight.position.set(0, 20, 0);
scene.add(directionalLight);

// Ground
const groundGeometry = new THREE.PlaneGeometry(100, 100);
const groundMaterial = new THREE.MeshStandardMaterial({ color: 0x3a7d44 });
const ground = new THREE.Mesh(groundGeometry, groundMaterial);
ground.rotation.x = -Math.PI / 2;
ground.position.y = -0.1;
scene.add(ground);

// Car body
const carGeometry = new THREE.BoxGeometry(2, 1, 4);
const carMaterial = new THREE.MeshStandardMaterial({ color: 0x00ff00 });
const car = new THREE.Mesh(carGeometry, carMaterial);
car.position.y = 0.5;
scene.add(car);

// Add wheels to local player's car
const wheelGeometry = new THREE.CylinderGeometry(0.4, 0.4, 0.3, 16);
const wheelMaterial = new THREE.MeshStandardMaterial({ color: 0x333333 });

// Create wheels for local player
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

// Store wheels for animation
car.wheels = [wheelFL, wheelFR, wheelBL, wheelBR];

// Function to add other players
function addPlayer(id, playerInfo) {
    const playerCarGeometry = new THREE.BoxGeometry(2, 1, 4);
    const playerCarMaterial = new THREE.MeshStandardMaterial({ color: 0xff0000 });
    const playerCar = new THREE.Mesh(playerCarGeometry, playerCarMaterial);
    
    // Add wheels to remote player's car
    const remoteWheelFL = new THREE.Mesh(wheelGeometry, wheelMaterial);
    const remoteWheelFR = new THREE.Mesh(wheelGeometry, wheelMaterial);
    const remoteWheelBL = new THREE.Mesh(wheelGeometry, wheelMaterial);
    const remoteWheelBR = new THREE.Mesh(wheelGeometry, wheelMaterial);
    
    remoteWheelFL.position.set(-1.2, -0.3, 1.2);
    remoteWheelFR.position.set(1.2, -0.3, 1.2);
    remoteWheelBL.position.set(-1.2, -0.3, -1.2);
    remoteWheelBR.position.set(1.2, -0.3, -1.2);
    
    remoteWheelFL.rotation.z = Math.PI / 2;
    remoteWheelFR.rotation.z = Math.PI / 2;
    remoteWheelBL.rotation.z = Math.PI / 2;
    remoteWheelBR.rotation.z = Math.PI / 2;
    
    playerCar.add(remoteWheelFL);
    playerCar.add(remoteWheelFR);
    playerCar.add(remoteWheelBL);
    playerCar.add(remoteWheelBR);
    
    playerCar.wheels = [remoteWheelFL, remoteWheelFR, remoteWheelBL, remoteWheelBR];
    
    playerCar.position.copy(playerInfo.position);
    playerCar.rotation.y = playerInfo.rotation.y;
    playerCar.position.y = 0.5;
    scene.add(playerCar);
    players[id] = playerCar;
}

// Camera setup
camera.position.set(0, 5, 10);
camera.lookAt(car.position);

// Handle window resize
window.addEventListener('resize', () => {
    camera.aspect = window.innerWidth / window.innerHeight;
    camera.updateProjectionMatrix();
    renderer.setSize(window.innerWidth, window.innerHeight);
});

// Animation loop
function animate() {
    requestAnimationFrame(animate);
    renderer.render(scene, camera);
}

animate(); 