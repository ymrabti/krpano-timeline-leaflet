
// Register module/require aliases
require('module-alias/register');


// Patches
const { inject, errorHandler } = require('express-custom-error');
inject(); // Patch express in order to use async / await syntax

// Require Dependencies

const express = require('express');
const cookieParser = require('cookie-parser');
const cors = require('cors');
const helmet = require('helmet');


const logger = require('@util/logger');

// Load .env Enviroment Variables to process.env

require('mandatoryenv').load([
    'DB_HOST',
    'DB_DATABASE',
    'DB_USER',
    'DB_PASSWORD',
    'PORT'
]);

const { PORT } = process.env;


// Instantiate an Express Application
const app = express();
const settings = require('../settings');


// Configure Express App Instance
app.use(express.json({ limit: '50mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));

// Configure custom logger middleware
app.use(logger.dev, logger.combined);

app.use(cookieParser());
app.use(cors());
app.use(helmet());

// This middleware adds the json header to every response
/* app.use('*', (req, res, next) => {
    res.setHeader('Content-Type', 'application/json');
    next();
}) */

var favicon = require('serve-favicon');

const path = require('path');
app.use(favicon(path.join(settings.PROJECT_DIR, 'public', 'node.svg')));
// Assign Routes

let router = require('./routes/router');
app.use('/', router);
// Handle errors
app.use(errorHandler());

app.use(express.static(path.resolve(settings.PROJECT_DIR, 'public')))

app.use('/home', (req, res) => {
    res.sendFile(path.resolve(settings.PROJECT_DIR, 'public', 'index.html'));
});


// Handle not valid route
app.use('*', (req, res) => {
    // res.status(404).json({ status: false, message: 'Endpoint Not Found' });
    res.redirect(404, '/home')

});

app.listen(
    PORT,
    () => {
        console.info('Server listening on port ', PORT);
    }
);