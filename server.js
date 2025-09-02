const express = require('express');
const http = require('http');
const { Server } = require("socket.io");
const { v4: uuidv4 } = require('uuid'); // To generate unique message IDs

const app = express();
const server = http.createServer(app);
const io = new Server(server);

const PORT = process.env.PORT || 3000;

// Serve the 'public' folder as static files
app.use(express.static('public'));

const users = {}; // key: socket.id, value: username

// Listen for new connections
io.on('connection', (socket) => {
    
    // Handle new user setting their username
    socket.on('set username', (username) => {
        // Store user info
        users[socket.id] = username;
        socket.username = username;

        // Notify all other clients that a user has joined
        socket.broadcast.emit('user joined', username);

        // Send updated user list to all clients
        io.emit('update user list', Object.values(users));
    });
    
    // Handle disconnections
    socket.on('disconnect', () => {
        if (socket.username) {
            // Notify all other clients that a user has left
            socket.broadcast.emit('user left', socket.username);

            // Remove user from our list
            delete users[socket.id];
            
            // Send updated user list to all clients
            io.emit('update user list', Object.values(users));
        }
    });

    // Handle incoming chat messages
    socket.on('chat message', (data) => {
        // Broadcast the message to all clients
        io.emit('chat message', { 
            user: socket.username, 
            text: data.text,
            id: uuidv4() // Add a unique ID to the message
        });
    });
    
    // Handle private messages
    socket.on('private message', (data) => {
        const recipientSocketId = Object.keys(users).find(key => users[key] === data.to);
        if (recipientSocketId) {
            const messageData = {
                from: socket.username,
                text: data.text,
                id: uuidv4()
            };
            // Send to the recipient
            io.to(recipientSocketId).emit('private message', messageData);
            // Send back to the sender
            socket.emit('private message', messageData);
        }
    });
    
    // Handle file uploads
    socket.on('upload file', (fileData) => {
        io.emit('file message', { 
            user: socket.username, 
            file: fileData,
            id: uuidv4() // Add a unique ID to the file message
        });
    });

    // Handle message deletion
    socket.on('delete message', (messageId) => {
        // For simplicity, we just broadcast the ID to all clients to delete
        // In a real app, you'd add checks to ensure the user owns the message
        io.emit('message deleted', messageId);
    });

    // Handle typing indicators
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
    
    socket.on('hang up', (data) => {
        const userToHangUpWith = Object.keys(users).find(key => users[key] === data.user);
        if (userToHangUpWith) {
             io.to(userToHangUpWith).emit('call ended');
        }
    });
});

server.listen(PORT, () => {
  console.log(`Server is running on http://localhost:${PORT}`);
});

