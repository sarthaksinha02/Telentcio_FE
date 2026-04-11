import { io } from 'socket.io-client';

const SOCKET_URL = import.meta.env.VITE_API_URL || 'http://localhost:5000';

const socket = io(SOCKET_URL, {
    autoConnect: false, // We connect manually once the user is authenticated
    reconnection: true,
    reconnectionAttempts: 10,
    reconnectionDelay: 2000,
});

// Store userId so we can re-join the personal room after reconnections
let _currentUserId = null;

// FIX: Re-join the personal room on every (re)connection.
// socket.connect() is async — join_user_room emitted synchronously after
// socket.connect() is lost because the socket isn't open yet. Using the
// built-in 'connect' event guarantees the join fires only when the transport
// is actually ready.
socket.on('connect', () => {
    if (_currentUserId) {
        socket.emit('join_user_room', _currentUserId);
    }
});

/**
 * Connect to socket and join the user's personal notification room.
 * @param {string} userId - MongoDB _id of the logged-in user
 */
export const connectSocket = (userId) => {
    _currentUserId = userId || null;

    if (socket.connected) {
        // Already connected — just join the room immediately
        if (userId) socket.emit('join_user_room', userId);
    } else {
        // connect() is async; the 'connect' event above will emit join_user_room
        socket.connect();
    }
};

/**
 * Disconnect from socket and clear the stored userId.
 */
export const disconnectSocket = () => {
    _currentUserId = null;
    if (socket.connected) {
        socket.disconnect();
    }
};

export default socket;
