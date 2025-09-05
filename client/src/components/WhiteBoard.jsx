import React, { useState, useEffect, useRef, useCallback } from 'react';
import { useParams } from 'react-router-dom';
import axios from 'axios';
import { io } from 'socket.io-client';
import * as fabric from 'fabric';


const API_URL = 'http://127.0.0.1:5000/api';
const SOCKET_URL = 'http://127.0.0.1:5000';

const Whiteboard = ({ authToken }) => {
    const { boardId } = useParams();
    const canvasRef = useRef(null);
    const fabricCanvasRef = useRef(null);
    const socketRef = useRef(null);
    const [message, setMessage] = useState('');
    const [drawingMode, setDrawingMode] = useState('Pencil'); // This variable will now be used

    useEffect(() => {
        // Initialize Fabric.js canvas
        const canvas = new fabric.Canvas(canvasRef.current);
        fabricCanvasRef.current = canvas;

        // Load saved data and connect to WebSockets
        loadWhiteboardState();
        setupSocketConnection();

        // Event listeners for real-time updates
        canvas.on('object:modified', syncChanges);
        canvas.on('object:added', syncChanges);

        // Cleanup function
        return () => {
            if (socketRef.current) {
                socketRef.current.disconnect();
            }
            if (fabricCanvasRef.current) {
                fabricCanvasRef.current.dispose();
            }
        };
    }, [loadWhiteboardState, setupSocketConnection, boardId, authToken]);

    const setupSocketConnection = useCallback(()=> {
        socketRef.current = io(SOCKET_URL, {
            auth: { token: authToken }
        });

        socketRef.current.on('connect', () => {
            console.log('Connected to WebSocket!');
            socketRef.current.emit('join', { board_id: parseInt(boardId) });
        });

        // Listen for real-time updates from other clients
        socketRef.current.on('whiteboard_update', (data) => {
            const canvas = fabricCanvasRef.current;
            canvas.loadFromJSON(data.canvasState, () => {
                canvas.renderAll();
            });
        });

        socketRef.current.on('disconnect', () => {
            console.log('Disconnected from WebSocket.');
        });
    },[boardId, authToken, syncChanges]);

    const syncChanges = useCallback(() =>  {
        if (!socketRef.current) return;
        const canvas = fabricCanvasRef.current;
        const canvasState = JSON.stringify(canvas.toJSON());
        socketRef.current.emit('whiteboard_update', {
            board_id: parseInt(boardId),
            update_data: { canvasState }
        });
    },[authToken, boardId]);

    const loadWhiteboardState = useCallback(async () =>{
        try {
            const response = await axios.get(`${API_URL}/boards/${boardId}`, {
                headers: { Authorization: `Bearer ${authToken}` }
            });
            const boardData = response.data.whiteboard_data;
            if (boardData) {
                fabricCanvasRef.current.loadFromJSON(boardData, () => {
                    fabricCanvasRef.current.renderAll();
                });
            }
        } catch (error) {
            setMessage('Failed to load whiteboard.');
            console.error('Error loading whiteboard:', error);
        }
    },[authToken, boardId]);

    const saveWhiteboardState = async () => {
        try {
            const canvasState = JSON.stringify(fabricCanvasRef.current.toJSON());
            await axios.put(
                `${API_URL}/boards/${boardId}/whiteboard`,
                { whiteboard_state: canvasState },
                {
                    headers: { Authorization: `Bearer ${authToken}` }
                }
            );
            setMessage('Whiteboard saved!');
        } catch (error) {
            setMessage('Failed to save whiteboard.');
            console.error('Error saving whiteboard:', error);
        }
    };

    const toggleDrawingMode = (mode) => {
        const canvas = fabricCanvasRef.current;
        if (mode === 'Pencil') {
            canvas.isDrawingMode = true;
            canvas.freeDrawingBrush.width = 5;
        } else {
            canvas.isDrawingMode = false;
        }
        setDrawingMode(mode);
    };

    const addStickyNote = () => {
        const text = prompt("Enter sticky note text:");
        if (text) {
            const note = new fabric.IText(text, {
                left: 100,
                top: 100,
                fontSize: 20,
                backgroundColor: '#ffffa3',
                padding: 10,
            });
            fabricCanvasRef.current.add(note);
            syncChanges();
        }
    };

    return (
        <div className="whiteboard-container">
            <div className="whiteboard-toolbar">
                <button
                    onClick={() => toggleDrawingMode('Pencil')}
                    className={drawingMode === 'Pencil' ? 'active-tool' : ''}
                >
                    Pen
                </button>
                <button
                    onClick={addStickyNote}
                    className={drawingMode === 'StickyNote' ? 'active-tool' : ''}
                >
                    Sticky Note
                </button>
                <button onClick={saveWhiteboardState}>Save</button>
            </div>
            <canvas ref={canvasRef} id="main-whiteboard" width="1000" height="600" />
            <p className="message">{message}</p>
        </div>
    );
};

export default Whiteboard;