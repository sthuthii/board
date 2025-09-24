import React, { useState, useEffect, useRef } from 'react';
import { io } from 'socket.io-client';

const SOCKET_URL = 'http://127.0.0.1:5000';

const Chat = ({ boardId, authToken }) => {
    const [messages, setMessages] = useState([]);
    const [inputMessage, setInputMessage] = useState('');
    const socketRef = useRef(null);

    // In Chat.jsx
useEffect(() => {
    // Connect to the WebSocket server
    socketRef.current = io(SOCKET_URL, {
        auth: { token: authToken }
    });

    // Event handler for a successful connection
    socketRef.current.on('connect', () => {
        console.log('Chat socket connected!');
        socketRef.current.emit('join', { board_id: parseInt(boardId) });
    });

    // Event handler for receiving new chat messages
    socketRef.current.on('chat_message', (data) => {
        console.log("Received message from server:", data); // Add this line
        setMessages((prevMessages) => [...prevMessages, data]);
    });

    // Event handler for disconnections
    socketRef.current.on('disconnect', () => {
        console.log('Chat socket disconnected.');
    });

    // Cleanup function on component unmount
    return () => {
        if (socketRef.current) {
            socketRef.current.disconnect();
        }
    };
}, [boardId, authToken]);

    const sendMessage = (e) => {
        e.preventDefault();
        if (inputMessage.trim()) {
            // Emit the chat message to the server
            socketRef.current.emit('chat_message', {
                board_id: parseInt(boardId),
                message: inputMessage,
            });
            setInputMessage('');
        }
    };

    return (
        <div className="chat-container">
            <div className="chat-messages">
                {messages.map((msg, index) => (
                    <div key={index} className="chat-message">
                        <strong>{msg.username}:</strong> {msg.message}
                    </div>
                ))}
            </div>
            <form onSubmit={sendMessage} className="chat-input-form">
                <input
                    type="text"
                    value={inputMessage}
                    onChange={(e) => setInputMessage(e.target.value)}
                    placeholder="Type a message..."
                />
                <button type="submit">Send</button>
            </form>
        </div>
    );
};

export default Chat;