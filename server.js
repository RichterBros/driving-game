const express = require('express');
const app = express();
const http = require('http').createServer(app);
const io = require('socket.io')(http, {
    cors: {
        origin: "https://driving-game-frontend.onrender.com", // Your frontend URL
        methods: ["GET", "POST"],
        credentials: true
    }
});

app.use(express.static('public'));

const players = {};

io.on('connection', (socket) => {
    console.log('A player connected');

    // Initialize player
    players[socket.id] = {
        position: { x: 0, y: 0, z: 0 },
        rotation: { y: 0 }
    };

    // Send current players to new player
    socket.emit('currentPlayers', players);

    // Broadcast new player to all other players
    socket.broadcast.emit('newPlayer', {
        id: socket.id,
        position: players[socket.id].position,
        rotation: players[socket.id].rotation
    });

    // Handle player movement
    socket.on('playerMovement', (movementData) => {
        players[socket.id].position = movementData.position;
        players[socket.id].rotation = movementData.rotation;
        socket.broadcast.emit('playerMoved', {
            id: socket.id,
            position: players[socket.id].position,
            rotation: players[socket.id].rotation
        });
    });

    // Handle disconnection
    socket.on('disconnect', () => {
        console.log('A player disconnected');
        delete players[socket.id];
        io.emit('playerDisconnected', socket.id);
    });
});

const PORT = process.env.PORT || 3000;
http.listen(PORT, () => {
    console.log(`Server running on port ${PORT}`);
}); 