// --- 1. SETUP ---
const express = require('express');
const path = require('path');
// Import the built-in 'http' module to create an HTTP server.
const http = require('http');
// Import the Server class from the 'socket.io' library.
const { Server } = require("socket.io");

// --- 2. INITIALIZATION ---
const app = express();
// Create an HTTP server instance and pass our Express app to it.
const server = http.createServer(app);
// Create a new Socket.IO server instance and attach it to our HTTP server.
const io = new Server(server);

const PORT = process.env.PORT || 3000;

// --- 3. MIDDLEWARE ---
// This remains the same. It serves our static files from the 'public' folder.
app.use(express.static(path.join(__dirname, 'public')));

// --- 4. SOCKET.IO CONNECTION HANDLING ---
// This is the heart of our real-time functionality.
// We listen for the 'connection' event. This event fires whenever a new
// client (a user's browser) connects to our server.
io.on('connection', (socket) => {
  // The 'socket' object represents the individual connection to that one client.
  console.log(`A user has connected: ${socket.id}`);

  // We can also listen for events from this specific client.
  // For example, the 'disconnect' event fires when they close the browser tab.
  socket.on('disconnect', () => {
    console.log(`User disconnected: ${socket.id}`);
  });
});

// --- 5. SERVER LISTENING ---
// IMPORTANT: We now tell our 'server' (the HTTP one) to listen, not the 'app' (the Express one).
// This ensures that both Express and Socket.IO are running on the same port.
server.listen(PORT, () => {
  console.log(`Server is running on http://localhost:${PORT}`);
});

