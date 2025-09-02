const express = require('express');
const http = require('http');
const { Server } = require("socket.io");
const path = require('path');
const { randomUUID } = require('crypto'); // Import the UUID generator

const app = express();
const server = http.createServer(app);
const io = new Server(server);

// Serve static files from the "public" directory
app.use(express.static(path.join(__dirname, 'public')));

// Store users: key is socket.id, value is username
const users = {}; 

io.on('connection', (socket) => {
    // When a user sets their username
    socket.on('set username', (username) => {
        // Store the user
        users[socket.id] = username;
        socket.username = username; // Attach username to the socket for easy access
        
        // Notify everyone that a new user has joined
        io.emit('user joined', username);
        // Send the updated user list to everyone
        io.emit('update user list', Object.values(users));
    });

    // When a user disconnects
    socket.on('disconnect', () => {
        if (socket.username) {
            // Remove the user
            delete users[socket.id];
            // Notify everyone that the user has left
            io.emit('user left', socket.username);
            // Send the updated user list to everyone
            io.emit('update user list', Object.values(users));
        }
    });

    // Handle incoming chat messages
    socket.on('chat message', (data) => {
        const messageId = randomUUID();
        io.emit('chat message', { id: messageId, user: socket.username, text: data.text });
    });
    
    // Handle private messages
    socket.on('private message', (data) => {
        const recipientSocketId = Object.keys(users).find(id => users[id] === data.to);
        if (recipientSocketId) {
            const messageId = randomUUID();
            const messageData = { id: messageId, from: socket.username, text: data.text };
            // Send to the recipient
            io.to(recipientSocketId).emit('private message', messageData);
            // Send back to the sender
            socket.emit('private message', messageData);
        }
    });

    // Handle file uploads
    socket.on('upload file', (fileData) => {
        const messageId = randomUUID();
        io.emit('file message', { id: messageId, user: socket.username, file: fileData });
    });

    // Handle delete message event
    socket.on('delete message', (messageId) => {
        // Broadcast to all clients that a message should be deleted
        io.emit('message deleted', messageId);
    });

    // --- WebRTC Signaling ---
    socket.on('call user', (data) => {
        // Find the socket ID of the user to call using our users object
        const recipientSocketId = Object.keys(users).find(id => users[id] === data.userToCall);
        
        if (recipientSocketId) {
            // If the user is found, emit the call received event to their specific socket ID
            io.to(recipientSocketId).emit('call received', {
                signal: data.signalData,
                from: { id: socket.id, username: socket.username }
            });
        }
    });

    socket.on('answer call', (data) => {
        io.to(data.to).emit('call answered', data.signal);
    });
    
    socket.on('hang up', (data) => {
        const recipientSocketId = Object.keys(users).find(id => users[id] === data.user);
        if (recipientSocketId) {
            io.to(recipientSocketId).emit('call ended');
        }
    });
});

const PORT = process.env.PORT || 3000;
server.listen(PORT, () => {
  console.log(`Server is running on http://localhost:${PORT}`);
});

