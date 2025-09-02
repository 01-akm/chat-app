const express = require('express');
const app = express();
const http = require('http');
const server = http.createServer(app);
const { Server } = require("socket.io");
const io = new Server(server);
const path = require('path');

const PORT = process.env.PORT || 3000;

app.use(express.static(path.join(__dirname, 'public')));

// Store users: key is socket.id, value is username
const users = {}; 

io.on('connection', (socket) => {
    console.log('A user has connected...');

    socket.on('set username', (username) => {
        socket.username = username;
        users[socket.id] = username;
        io.emit('update user list', Object.values(users));
    });

    socket.on('chat message', (data) => {
        io.emit('chat message', { user: socket.username, text: data.text });
    });
    
    // --- New handler for private messages ---
    socket.on('private message', (data) => {
        const recipientUsername = data.to;
        let recipientSocketId = null;

        // Find the recipient's socket ID from their username
        for (const id in users) {
            if (users[id] === recipientUsername) {
                recipientSocketId = id;
                break;
            }
        }

        // If the recipient is found, send the message
        if (recipientSocketId) {
            const messageData = {
                text: data.text,
                from: socket.username,
            };
            // Send to the recipient
            io.to(recipientSocketId).emit('private message', messageData);
            // Also send back to the sender so they can see it
            socket.emit('private message', messageData);
        }
    });


    socket.on('upload file', (fileData) => {
        io.emit('file message', { user: socket.username, file: fileData });
    });

    socket.on('typing', () => {
        socket.broadcast.emit('typing', socket.username);
    });

    socket.on('stop typing', () => {
        socket.broadcast.emit('stop typing');
    });

    // --- WebRTC Signaling ---
    socket.on('call user', (data) => {
        let recipientSocketId = null;
        for (const id in users) {
            if (users[id] === data.userToCall) {
                recipientSocketId = id;
                break;
            }
        }
        if (recipientSocketId) {
            io.to(recipientSocketId).emit("call received", {
                signal: data.signalData,
                from: { id: socket.id, username: socket.username }
            });
        }
    });

    socket.on("answer call", (data) => {
        io.to(data.to).emit('call answered', data.signal);
    });

    socket.on("hang up", (data) => {
        let recipientSocketId = null;
        for (const id in users) {
            if (users[id] === data.user) {
                recipientSocketId = id;
                break;
            }
        }
        if (recipientSocketId) {
            io.to(recipientSocketId).emit('call ended');
        }
    });
    
    socket.on('disconnect', () => {
        console.log('A user has disconnected...');
        delete users[socket.id];
        io.emit('update user list', Object.values(users));
    });
});

server.listen(PORT, () => {
    console.log(`Server is running on http://localhost:${PORT}`);
});

