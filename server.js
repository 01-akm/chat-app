const express = require('express');
const http = require('http');
const { Server } = require("socket.io");
const path = require('path');

const app = express();
const server = http.createServer(app);
// Increase the max payload size for Socket.IO to handle larger images
const io = new Server(server, { maxHttpBufferSize: 1e8 }); // 100 MB

const PORT = 3000;

// Serve static files from the "public" directory
app.use(express.static(path.join(__dirname, 'public')));

// An object to store active users. We'll use socket.id as the key.
const users = {};

// Listen for new connections
io.on('connection', (socket) => {
  console.log('A user has connected...');

  // When a user sets their username
  socket.on('set username', (username) => {
    socket.username = username;
    users[socket.id] = username;
    // Broadcast the updated user list to everyone
    io.emit('update user list', Object.values(users));
  });

  // Listen for 'chat message' events from a client
  socket.on('chat message', (data) => {
    io.emit('chat message', { user: socket.username, text: data.text });
  });

  // Listen for 'typing' events
  socket.on('typing', () => {
    socket.broadcast.emit('typing', socket.username);
  });

  // Listen for 'stop typing' events
  socket.on('stop typing', () => {
    socket.broadcast.emit('stop typing');
  });

  // Listen for file uploads and broadcast them
  socket.on('upload file', (fileData) => {
    io.emit('file message', { user: socket.username, file: fileData });
  });

  // --- WebRTC Signaling Events ---

  // When a user initiates a call to another user
  socket.on('call user', (data) => {
    const userToCallSocketId = Object.keys(users).find(key => users[key] === data.userToCall);
    if (userToCallSocketId) {
        // Emit an event to the specific user being called
        io.to(userToCallSocketId).emit('call received', {
            signal: data.signalData,
            from: {
                id: socket.id,
                username: socket.username
            }
        });
    }
  });

  // When a user answers a call
  socket.on('answer call', (data) => {
    // Send the answer signal back to the original caller
    io.to(data.to).emit('call answered', data.signal);
  });

  // Handle disconnections
  socket.on('disconnect', () => {
    console.log('...a user has disconnected.');
    if (users[socket.id]) {
        delete users[socket.id];
        io.emit('update user list', Object.values(users));
    }
  });
});

// Start the server
server.listen(PORT, () => {
  console.log(`Server is running on http://localhost:${PORT}`);
});

