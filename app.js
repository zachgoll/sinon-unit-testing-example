/**
 * app.js 
 */
const express = require('express');
const config = require('./config');
const userRoutes = require('./user-routes');
const bodyParser = require('body-parser');
const mongoose = require('mongoose');

// Set up the Express app object
const app = express();

// Using Mongoose as an interface to our MongoDB database
mongoose.connect(config.database, { useNewUrlParser: true });

let connection = mongoose.connection;

connection.on('connected', () => { console.log(`App connected to database: "${config.dbName}"`) });
connection.on('error', (err) => { console.error(`Database error: ${err}`) });

// Grab the port number from some config file
const port = config.port || 3000;

// For interpreting requests
app.use(bodyParser.json());

// THIS LINE IS THE ONLY DIFFERENCE!
userRoutes(app);

// Serve the app 
app.listen(port, () => {
    console.log(`App listening on port: ${port}`);
});

// Export the app object for other files to use
module.exports = app;