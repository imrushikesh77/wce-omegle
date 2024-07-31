const faker = require('faker');

let num_users = 0;
let waiting_list = [];

const ioHandler = (io) => {
    io.on('connection', (socket) => {
        num_users++;
        socket.partner = null;
        socket.username = 'anonymous-' + faker.name.firstName();
        socket.emit("init", { username: socket.username, my_id: socket.id });

        if (waiting_list.length > 0) {
            // If there are users in the waiting list, pair them up
            const partnerSocket = waiting_list.pop();
            socket.partner = partnerSocket.id;
            partnerSocket.partner = socket.id;
            socket.broadcast.to(socket.partner).emit("partner", { id: socket.id, username: socket.username, avatar: socket.avatar });
            socket.emit("partner", { id: partnerSocket.id, username: partnerSocket.username, avatar: partnerSocket.avatar });
        } else {
            waiting_list.push(socket);
        }

        console.log(`User connected: ${socket.id}. Active Users: ${num_users}, Waiting List Size: ${waiting_list.length}`);

        socket.on('chat message', (data) => {
            const { msg, target } = data;
            const source = socket.id;
            socket.broadcast.to(target).emit("chat message partner", msg);
            io.to(source).emit("chat message mine", msg);
        });

        socket.on('join-room', (roomId) => {
            socket.join(roomId);
            socket.to(roomId).emit('user-connected', socket.id);
    
            socket.on('disconnect', () => {
                socket.to(roomId).emit('user-disconnected', socket.id);
            });
        });

        socket.on('send-signal', (data) => {
            console.log(`Signal received from ${data.from} to ${data.to}`);
            io.to(data.to).emit('signal-receive', {
                signal: data.signal,
                from: data.from
            });
        });

        socket.on('disconnect', () => {
            console.log(`User disconnected: ${socket.id}`);
            if (socket.partner !== null) {
                socket.broadcast.to(socket.partner).emit("typing", false);
                socket.broadcast.to(socket.partner).emit("disconnecting now", 'Your Partner has disconnected. Refresh the page to chat again');
                io.to(socket.partner).partner = null;
            } else {
                const index = waiting_list.indexOf(socket);
                if (index !== -1) {
                    waiting_list.splice(index, 1);
                }
            }
            num_users--;
            console.log(`Active Users: ${num_users}, Waiting List Size: ${waiting_list.length}`);
        });

        socket.on('typing', (data) => {
            socket.broadcast.to(socket.partner).emit("typing", data);
        });
    });

    io.on('error', (err) => {
        console.log(`Socket.IO error: ${err.message}`);
    });
};

module.exports = {
    ioHandler,
    num_users
};
