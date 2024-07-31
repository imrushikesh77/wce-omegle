let num_users = 0;
let waiting_list = [];

const ioHandler = (io) => {
    io.on('connection', (socket) => {
        num_users++;
        socket.partner = null;
        socket.emit("init", { my_id: socket.id });

        const tryPairing = () => {
            if (socket.partner === null) {
                while (waiting_list.length > 0) {
                    const partnerSocketId = waiting_list.shift();
                    const partnerSocket = io.sockets.sockets.get(partnerSocketId);
                    if (partnerSocket && partnerSocket.connected && partnerSocket.partner === null) {
                        socket.partner = partnerSocket.id;
                        partnerSocket.partner = socket.id;
                        socket.emit("partner", { id: partnerSocket.id });
                        partnerSocket.emit("partner", { id: socket.id });
                        return;
                    }
                }
                waiting_list.push(socket.id);
            }
        };

        tryPairing();

        console.log(`User connected: ${socket.id}. Active Users: ${num_users}, Waiting List Size: ${waiting_list.length}`);

        socket.on('chat message', (data) => {
            const { msg, target } = data;
            if (socket.partner === target) {
                socket.to(target).emit("chat message partner", msg);
                socket.emit("chat message mine", msg);
            }
        });

        socket.on('join-room', (roomId) => {
            socket.join(roomId);
            socket.to(roomId).emit('user-connected', socket.id);
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
                const partnerSocket = io.sockets.sockets.get(socket.partner);
                if (partnerSocket) {
                    partnerSocket.emit("typing", false);
                    partnerSocket.emit("disconnecting now", 'Your Partner has disconnected. Refresh the page to chat again');
                    partnerSocket.partner = null;
                    if (partnerSocket.connected) {
                        waiting_list.push(partnerSocket.id);
                    }
                }
            } else {
                const index = waiting_list.indexOf(socket.id);
                if (index !== -1) {
                    waiting_list.splice(index, 1);
                }
            }
            num_users--;
            console.log(`Active Users: ${num_users}, Waiting List Size: ${waiting_list.length}`);
        });

        socket.on('typing', (data) => {
            if (socket.partner) {
                socket.to(socket.partner).emit("typing", data);
            }
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
