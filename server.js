// --- 1. SETUP ---
// We are importing the 'express' library, which we installed earlier.
// This is the main tool we'll use to build our web server.
const express = require('express');

// We are also importing the 'path' module. This is a built-in Node.js module
// that helps us work with file and directory paths in a consistent way.
const path = require('path');

// --- 2. INITIALIZATION ---
// We create an instance of the express application.
// Think of 'app' as our main server object.
const app = express();

// We define a port number for our server to listen on.
// 3000 is a common port for development. If that port is busy on your machine,
// it will use whatever is available in the environment variable PORT.
const PORT = process.env.PORT || 3000;

// --- 3. MIDDLEWARE ---
// This is a crucial line. It tells our Express app to serve static files
// (like HTML, CSS, and client-side JavaScript) from a folder named 'public'.
// We haven't created this folder yet, but we will in the next step!
app.use(express.static(path.join(__dirname, 'public')));

// --- 4. SERVER LISTENING ---
// Finally, we tell our server to start listening for connections on the port we defined.
// When it starts successfully, it will print a message to the console.
app.listen(PORT, () => {
  console.log(`Server is running on http://localhost:${PORT}`);
});
