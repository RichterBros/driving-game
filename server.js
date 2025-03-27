const express = require('express');
const app = express();
const http = require('http').createServer(app);
const io = require('socket.io')(http, {
    cors: {
        origin: ["https://driving-game-frontend.onrender.com", "http://localhost:3000"],
        methods: ["GET", "POST"],
        credentials: true
    }
});

app.use(express.static('public'));

const players = {};

// Create a grid of spawn points with plenty of space between each point
function generateSpawnPoints() {
    const points = [];
    const gridSize = 5;  // 5x5 grid = 25 possible spawn points
    const spacing = 200; // 200 units between each point
    
    for (let i = 0; i < gridSize; i++) {
        for (let j = 0; j < gridSize; j++) {
            points.push({
                x: (i - Math.floor(gridSize/2)) * spacing,
                y: 0,
                z: (j - Math.floor(gridSize/2)) * spacing
            });
        }
    }
    
    // Shuffle the points array for random but unique spawns
    return points.sort(() => Math.random() - 0.5);
}

const spawnPoints = generateSpawnPoints();
let currentSpawnIndex = 0;

function getNextSpawnPoint() {
    const spawnPoint = spawnPoints[currentSpawnIndex];
    currentSpawnIndex = (currentSpawnIndex + 1) % spawnPoints.length;
    return spawnPoint;
}

// Clean up spawn points when players disconnect
io.on('disconnect', (socket) => {
    const player = players[socket.id];
    if (player) {
        const pointKey = `${player.position.x},${player.position.z}`;
        usedSpawnPoints.delete(pointKey);
    }
    // ... rest of disconnect handling ...
});

// Keep track of connected players and their positions
let playerCount = 0;

// Just two fixed spawn positions, 1000 units apart
const SPAWN_POSITIONS = [
    { x: -500, y: 0, z: 0 },  // First car
    { x: 500, y: 0, z: 0 }    // Second car
];

let spawnIndex = 0;

io.on('connection', (socket) => {
    const playerId = socket.id;
    playerCount++;
    
    // Alternate between the two spawn positions
    const spawnPosition = SPAWN_POSITIONS[spawnIndex];
    spawnIndex = (spawnIndex + 1) % 2;  // Toggle between 0 and 1
    
    // Initialize the new player
    players[playerId] = {
        id: playerId,
        position: spawnPosition,
        rotation: { x: 0, y: 0, z: 0 }
    };

    // When a player disconnects, don't decrease playerCount to keep spawn positions unique
    socket.on('disconnect', () => {
        delete players[socket.id];
        // ... rest of disconnect handling ...
    });

    // Emit the initial position to the new player
    socket.emit('initialize', {
        id: playerId,
        players: players,
        position: spawnPosition
    });

    // ... rest of your connection handling code ...

    // Add this with your other socket event handlers
    socket.on('requestGameState', () => {
        // Send current game state to the requesting client
        socket.emit('gameState', {
            players: players
        });
    });

    // Update the player connection handler
    socket.on('playerMovement', (playerInfo) => {
        if (players[socket.id]) {
            players[socket.id].position = playerInfo.position;
            players[socket.id].rotation = playerInfo.rotation;
            // Broadcast to all other players
            socket.broadcast.emit('playerMoved', {
                id: socket.id,
                position: playerInfo.position,
                rotation: playerInfo.rotation
            });
        }
    });

    // Add bullet event handler
    socket.on('bulletCreated', (data) => {
        console.log('Server received bulletCreated event from:', socket.id);
        console.log('Bullet data:', data);
        console.log('Connected clients:', Object.keys(players));
        
        // Broadcast the bullet to all other clients
        socket.broadcast.emit('bulletCreated', data);
        console.log('Server broadcasted bullet to other clients');
        
        // Log the number of connected clients
        const connectedClients = Object.keys(players).length;
        console.log('Total connected clients:', connectedClients);
    });

    // Handle player hits
    socket.on('playerHit', (data) => {
        console.log('Server received hit:', data);
        // Broadcast the hit to all clients
        io.emit('playerHit', data);
    });

    // Handle player kills
    socket.on('playerKilled', (data) => {
        console.log('Server received kill:', data);
        // Broadcast the kill to all clients
        io.emit('playerKilled', data);
    });
});

const PORT = 3000;
http.listen(PORT, () => {
    console.log(`Server running on port ${PORT}`);
});