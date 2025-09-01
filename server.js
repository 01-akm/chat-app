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
    // Broadcast the message to all connected clients, including the sender
    // We add the username from the socket session to the data
    io.emit('chat message', { user: socket.username, text: data.text });
  });

  // Listen for 'typing' events
  socket.on('typing', () => {
    // Broadcast to everyone *except* the sender
    socket.broadcast.emit('typing', socket.username);
  });

  // Listen for 'stop typing' events
  socket.on('stop typing', () => {
    // Broadcast to everyone *except* the sender
    socket.broadcast.emit('stop typing');
  });

  // NEW: Listen for file uploads and broadcast them
  socket.on('upload file', (fileData) => {
    // Broadcast the file to all connected clients
    io.emit('file message', { user: socket.username, file: fileData });
  });

  // Handle disconnections
  socket.on('disconnect', () => {
    console.log('...a user has disconnected.');
    // Remove the user from our list
    if (users[socket.id]) {
        delete users[socket.id];
        // Broadcast the updated user list to everyone
        io.emit('update user list', Object.values(users));
    }
  });
});

// Start the server
server.listen(PORT, () => {
  console.log(`Server is running on http://localhost:${PORT}`);
});

