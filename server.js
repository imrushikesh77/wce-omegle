const app = require('./app.js');
const http = require('http');
const dotenv = require('dotenv').config();
const { Server } = require('socket.io');
const {ioHandler} = require('./sockets/io.js');

const PORT = process.env.PORT || 3000;
const server = http.createServer(app);

const io = new Server(server, {
    cors: {
        origin: '*',
    }
});


const serverOn = () => {
    ioHandler(io);
    io.listen(server);
    server.listen(PORT, () => {
        console.log(`Server running on port ${PORT}`);
    });
};

serverOn();
