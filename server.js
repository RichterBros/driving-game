const express = require('express');
const app = express();
const http = require('http').createServer(app);
const io = require('socket.io')(http, {
    cors: {
        origin: ["http://localhost:3000"],
        methods: ["GET", "POST"],
        credentials: true
    }
});

app.use(express.static('public'));

const players = {};
const bullets = {};
const MAX_HEALTH = 100;
const MAX_SCORE = 3;

const SPAWN_POSITIONS = [
    { x: -10, y: 2, z: 0 },
    { x: 10, y: 2, z: 0 }
];

const gameState = {
    scores: {},
    playerCount: 0
};

io.on('connection', (socket) => {
    const playerId = socket.id;
    gameState.playerCount++;

    console.log('🖥️ SERVER DEBUG: New player connected:', playerId);
    console.log('🖥️ SERVER DEBUG: Total players:', gameState.playerCount);
    console.log('🖥️ SERVER DEBUG: Current player IDs:', Object.keys(players));

    const spawnIndex = Object.keys(players).length % SPAWN_POSITIONS.length;
    const spawnPosition = SPAWN_POSITIONS[spawnIndex];

    players[playerId] = {
        id: playerId,
        position: spawnPosition,
        rotation: { x: 0, y: 0, z: 0 },
        health: MAX_HEALTH,
        score: 0,
        spawnIndex: spawnIndex
    };

    gameState.scores[playerId] = 0;

    console.log(`🖥️ SERVER DEBUG: Sending 'initialize' to new player ${playerId}`);
    socket.emit('initialize', {
        id: playerId,
        players: players,
        position: spawnPosition,
        health: MAX_HEALTH,
        score: 0,
        playerCount: gameState.playerCount
    });

    console.log(`🖥️ SERVER DEBUG: Broadcasting 'playerJoined' for ${playerId} to other players`);
    socket.broadcast.emit('playerJoined', players[playerId]);
    io.emit('playerCountUpdate', gameState.playerCount);

    socket.on('updatePosition', (data) => {
        if (players[playerId]) {
            // Log position updates occasionally to avoid console spam
            if (Math.random() < 0.01) {
                console.log(`🖥️ SERVER DEBUG: Player ${playerId} position update:`, {
                    x: data.position.x.toFixed(2),
                    y: data.position.y.toFixed(2),
                    z: data.position.z.toFixed(2)
                });
            }
            
            players[playerId].position = data.position;
            players[playerId].rotation = data.rotation;
            
            // Debug broadcast of 'playerMoved' events
            if (Math.random() < 0.01) {
                console.log(`🖥️ SERVER DEBUG: Broadcasting 'playerMoved' for ${playerId} to ${gameState.playerCount - 1} other players`);
            }
            
            socket.broadcast.emit('playerMoved', {
                id: playerId,
                position: data.position,
                rotation: data.rotation,
                timestamp: Date.now()
            });
        }
    });

    socket.on('createBullet', (data) => {
        const bulletId = `${playerId}-${Date.now()}`;
        bullets[bulletId] = {
            id: bulletId,
            position: data.position,
            velocity: data.velocity,
            owner: playerId
        };
        io.emit('bulletCreated', bullets[bulletId]);

        // Auto-remove after 3 seconds
        setTimeout(() => {
            if (bullets[bulletId]) {
                delete bullets[bulletId];
                io.emit('bulletRemoved', bulletId);
            }
        }, 3000);
    });

    socket.on('bulletHit', (data) => {
        const { bulletId, hitPlayerId } = data;
        const bullet = bullets[bulletId];

        if (bullet && players[hitPlayerId] && bullet.owner !== hitPlayerId) {
            delete bullets[bulletId];
            io.emit('bulletRemoved', bulletId);

            players[hitPlayerId].health -= 25;

            if (players[hitPlayerId].health <= 0) {
                const shooterId = bullet.owner;
                players[shooterId].score += 1;
                gameState.scores[shooterId] = players[shooterId].score;

                if (players[shooterId].score >= MAX_SCORE) {
                    io.emit('gameOver', { winner: shooterId });
                    Object.keys(players).forEach(id => {
                        players[id].score = 0;
                        gameState.scores[id] = 0;
                    });
                    io.emit('newRound', {
                        message: "New round starting!",
                        scores: gameState.scores
                    });
                }

                players[hitPlayerId].health = MAX_HEALTH;
                const index = players[hitPlayerId].spawnIndex;
                players[hitPlayerId].position = SPAWN_POSITIONS[index];

                io.emit('playerRespawned', {
                    id: hitPlayerId,
                    position: players[hitPlayerId].position,
                    health: MAX_HEALTH
                });
            }

            io.emit('playerHealthUpdate', {
                id: hitPlayerId,
                health: players[hitPlayerId].health
            });

            io.emit('scoreUpdate', gameState.scores);
        }
    });

    // Check connections every 5 seconds
    const pingInterval = setInterval(() => {
        socket.emit('ping', { time: Date.now() });
        console.log(`🖥️ SERVER DEBUG: Ping sent to ${playerId}`);
    }, 5000);

    socket.on('disconnect', () => {
        clearInterval(pingInterval);
        console.log(`🖥️ SERVER DEBUG: Player ${playerId} disconnected`);
        
        delete players[playerId];
        delete gameState.scores[playerId];
        gameState.playerCount--;
        
        console.log(`🖥️ SERVER DEBUG: Broadcasting 'playerLeft' for ${playerId} to remaining players`);
        socket.broadcast.emit('playerLeft', playerId);
        io.emit('playerCountUpdate', gameState.playerCount);
        
        console.log('🖥️ SERVER DEBUG: Remaining players:', Object.keys(players));
    });
});

const PORT = process.env.PORT || 3000;
http.listen(PORT, () => {
    console.log(`Server running on port ${PORT}`);
});