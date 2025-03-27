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

// Touch states for controls
const touchStates = {
    ArrowUp: false,
    ArrowDown: false,
    ArrowLeft: false,
    ArrowRight: false,
    ' ': false  // Space for shooting
};

// Add touch event listeners
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