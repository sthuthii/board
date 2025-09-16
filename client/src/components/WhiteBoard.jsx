import React, { useState, useEffect, useRef } from 'react';
import { useParams } from 'react-router-dom';
import * as fabric from 'fabric';
import axios from 'axios';
import { io } from 'socket.io-client';

const API_URL = 'http://127.0.0.1:5000/api';
const SOCKET_URL = 'http://127.0.0.1:5000';

const Whiteboard = ({ authToken }) => {
    const { boardId } = useParams();
    const canvasRef = useRef(null);
    const fabricCanvasRef = useRef(null);
    const socketRef = useRef(null);
    const [message, setMessage] = useState('');
    const [drawingMode, setDrawingMode] = useState(null);

    // All function definitions are here, before they are called
    const syncChanges = () => {
        if (!socketRef.current) return;
        const canvas = fabricCanvasRef.current;
        const canvasState = JSON.stringify(canvas.toJSON());
        socketRef.current.emit('whiteboard_update', {
            board_id: parseInt(boardId),
            update_data: { canvasState }
        });
    };

    const setupSocketConnection = () => {
        socketRef.current = io(SOCKET_URL, {
            auth: { token: authToken }
        });
        socketRef.current.on('connect', () => {
            console.log('Connected to WebSocket!');
            socketRef.current.emit('join', { board_id: parseInt(boardId) });
        });
        socketRef.current.on('whiteboard_update', (data) => {
            const canvas = fabricCanvasRef.current;
            canvas.loadFromJSON(data.canvasState, () => {
                canvas.renderAll();
            });
        });
        socketRef.current.on('disconnect', () => {
            console.log('Disconnected from WebSocket.');
        });
    };

    const loadWhiteboardState = async () => {
    try {
        const response = await axios.get(`${API_URL}/boards/${boardId}`, {
            headers: { Authorization: `Bearer ${authToken}` }
        });
        const boardData = response.data.whiteboard_data;

        if (boardData && boardData.length > 0) {
            fabricCanvasRef.current.loadFromJSON(boardData, () => {
                fabricCanvasRef.current.renderAll();
            });
        }
    } catch (error) {
        setMessage('Failed1 to load whiteboard.');
        console.error('Error loading whiteboard:', error);
    }
    };

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
        if (!canvas) {
            return;
        }

        const newMode = drawingMode === mode ? null : mode;
        setDrawingMode(newMode);

        if (newMode === 'Pencil') {
            canvas.isDrawingMode = true;
            if (canvas.freeDrawingBrush) {
                canvas.freeDrawingBrush.color = '#892323ff';
                canvas.freeDrawingBrush.width = 10;
            }
        } else {
            canvas.isDrawingMode = false;
        }
    };

    const addStickyNote = () => {
        const text = prompt("Enter sticky note text:");
        if (text) {
            toggleDrawingMode('StickyNote');
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

    useEffect(() => {
        const canvas = new fabric.Canvas(canvasRef.current);
        fabricCanvasRef.current = canvas;

        loadWhiteboardState();
        setupSocketConnection();

        canvas.on('object:modified', syncChanges);
        canvas.on('object:added', syncChanges);

        return () => {
            if (socketRef.current) {
                socketRef.current.disconnect();
            }
            if (fabricCanvasRef.current) {
                fabricCanvasRef.current.dispose();
            }
        };
    }, [boardId]);

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