const express = require('express');
const http = require('http');
const { Server } = require("socket.io");

const app = express();
const server = http.createServer(app);
const io = new Server(server);

const PORT = 3000;
const users = {}; // Store users: { socketId: 'username' }

// Serve the 'public' folder as static files
app.use(express.static('public'));

// Listen for new connections
io.on('connection', (socket) => {
    console.log('A user has connected:', socket.id);

    // Listen for username setup
    socket.on('set username', (username) => {
        socket.username = username;
        users[socket.id] = username;
        // Broadcast the updated user list to everyone
        io.emit('update user list', Object.values(users));
    });

    // Listen for chat messages
    socket.on('chat message', (msg) => {
        // Broadcast the message to everyone
        io.emit('chat message', { user: socket.username, text: msg.text });
    });

    // Listen for file uploads
    socket.on('upload file', (fileData) => {
        io.emit('file message', { user: socket.username, file: fileData });
    });

    // Listen for typing events
    socket.on('typing', () => {
        socket.broadcast.emit('typing', socket.username);
    });

    socket.on('stop typing', () => {
        socket.broadcast.emit('stop typing');
    });

    // --- WebRTC Signaling ---
    socket.on('call user', (data) => {
        const userToCall = Object.keys(users).find(key => users[key] === data.userToCall);
        if (userToCall) {
            io.to(userToCall).emit('call received', {
                signal: data.signalData,
                from: { id: socket.id, username: socket.username }
            });
        }
    });

    socket.on('answer call', (data) => {
        io.to(data.to).emit('call answered', data.signal);
    });

    // Listen for hang up event and relay it
    socket.on('hang up', (data) => {
        const userToNotify = Object.keys(users).find(key => users[key] === data.user);
        if (userToNotify) {
            io.to(userToNotify).emit('call ended');
        }
    });

    // Listen for disconnections
    socket.on('disconnect', () => {
        console.log('A user has disconnected:', socket.id);
        // You might want to also signal a hang up if the user was in a call
        delete users[socket.id];
        // Broadcast the updated user list to everyone
        io.emit('update user list', Object.values(users));
    });
});

// Start the server
server.listen(PORT, () => {
    console.log(`Server is running on http://localhost:${PORT}`);
});

