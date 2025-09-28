import React, { useState, useEffect, useRef, useCallback } from 'react';
import { io } from 'socket.io-client';
import './Chat.css';

const SOCKET_URL = 'http://127.0.0.1:5000';

const Chat = ({ boardId, authToken }) => {
    const [messages, setMessages] = useState([]);
    const [inputMessage, setInputMessage] = useState('');
    const socketRef = useRef(null);
    const messagesEndRef = useRef(null);

    const scrollToBottom = () => {
        messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
    };

    const sendMessage = useCallback((e) => {
        e.preventDefault();

        if (!socketRef.current || !socketRef.current.connected) {
            console.error("Socket is not connected. Message not sent.");
            return;
        }

        if (inputMessage.trim()) {
            console.log("Frontend emitting message:", inputMessage);
            socketRef.current.emit('chat_message', {
                board_id: parseInt(boardId),
                message: inputMessage,
            });
            setInputMessage('');
        }
    }, [inputMessage, boardId]);

    const setupSocketConnection = useCallback(() => {
        if (!authToken || !boardId) {
            return;
        }

        const socket = io(SOCKET_URL, {
            auth: { token: authToken }
        });
        socketRef.current = socket;

        socket.on('connect', () => {
            console.log('Chat socket connected!');
            socket.emit('join', { board_id: parseInt(boardId) });
        });

        socket.on('chat_message', (data) => {
            console.log("Frontend received message:", data);
            setMessages((prevMessages) => [...prevMessages, data]);
        });

        socket.on('disconnect', () => {
            console.log('Chat socket disconnected.');
        });

        return () => {
            if (socket) {
                socket.disconnect();
            }
        };
    }, [boardId, authToken]);

    useEffect(() => {
        const cleanup = setupSocketConnection();
        return cleanup;
    }, [setupSocketConnection]);

    useEffect(() => {
        scrollToBottom();
    }, [messages]);
    
    return (
        <div className="chat-container">
            <h3>Real-time Chat</h3>
            <div className="chat-messages">
                {messages.map((msg, index) => (
                    <div key={index} className="chat-message">
                        <strong>{msg.username}:</strong> {msg.message}
                    </div>
                ))}
                <div ref={messagesEndRef} />
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