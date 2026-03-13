import { io } from 'socket.io-client';

const SOCKET_URL = import.meta.env.VITE_API_URL || 'http://localhost:5000';

const socket = io(SOCKET_URL, {
    autoConnect: false, // We will connect manually when user is authenticated
    reconnection: true,
    reconnectionAttempts: 10,
    reconnectionDelay: 2000,
});

/**
 * Connect to socket and join user personal room
 * @param {string} userId - ID of the logged in user
 */
export const connectSocket = (userId) => {
    if (!socket.connected) {
        socket.connect();
    }
    
    if (userId) {
        socket.emit('join_user_room', userId);
    }
};

/**
 * Disconnect from socket
 */
export const disconnectSocket = () => {
    if (socket.connected) {
        socket.disconnect();
    }
};

export default socket;
