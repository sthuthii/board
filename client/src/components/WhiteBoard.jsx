import React, { useState, useEffect, useRef, useCallback } from 'react';
import { useParams } from 'react-router-dom';
import * as fabric from 'fabric';
import axios from 'axios';
import { io } from 'socket.io-client';
import Chat from './Chat';
import './Whiteboard.css';

const API_URL = 'http://127.0.0.1:5000/api';
const SOCKET_URL = 'http://127.0.0.1:5000';

const Whiteboard = ({ authToken }) => {
    const { boardId } = useParams();
    const canvasRef = useRef(null);
    const fabricCanvasRef = useRef(null);
    const socketRef = useRef(null);
    const [message, setMessage] = useState('');
    const [drawingMode, setDrawingMode] = useState(null);

    const syncChanges = useCallback(() => {
        if (!socketRef.current) return;
        const canvas = fabricCanvasRef.current;
        const canvasState = JSON.stringify(canvas.toJSON());
        socketRef.current.emit('whiteboard_update', {
            board_id: parseInt(boardId),
            update_data: { canvasState }
        });
    }, [boardId]);

    const setupSocketConnection = useCallback(() => {
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
    }, [boardId, authToken]);

    const loadWhiteboardState = useCallback(async () => {
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
            setMessage('Failed to load whiteboard.');
            console.error('Error loading whiteboard:', error);
        }
    }, [boardId, authToken]);

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
        canvas.selection = false;
        canvas.freeDrawingBrush = new fabric.PencilBrush(canvas);
        canvas.freeDrawingBrush.width = 10;
        canvas.freeDrawingBrush.color = '#892323';
        canvas.globalCompositeOperation = 'source-over';
    } else if (newMode === 'Eraser') {
        canvas.isDrawingMode = true;
        canvas.selection = false;
        canvas.freeDrawingBrush = new fabric.PencilBrush(canvas);
        canvas.freeDrawingBrush.color = 'rgba(0,0,0,0)'; 
        canvas.freeDrawingBrush.width = 20;
        canvas.globalCompositeOperation = 'destination-out';
    } else {
        // This is the key change: When no tool is active, enable selection mode.
        canvas.isDrawingMode = false;
        canvas.selection = true;
        canvas.globalCompositeOperation = 'source-over';
    }
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

    const clearCanvas = () => {
        if (fabricCanvasRef.current) {
            fabricCanvasRef.current.clear();
            syncChanges();
        }
    };

    // Corrected deleteSelectedObjects function
const deleteSelectedObjects = () => {
    const canvas = fabricCanvasRef.current;
    if (!canvas) return;

    const activeObjects = canvas.getActiveObjects();

    // Check if there are any selected objects
    if (activeObjects && activeObjects.length > 0) {
        activeObjects.forEach(object => {
            canvas.remove(object);
        });

        canvas.discardActiveObject();
        canvas.renderAll();
        
        syncChanges();
    }
};


// The corrected useEffect hook
useEffect(() => {
    // This is the core fix: all setup now depends on authToken being present
    if (authToken) {
        const canvas = new fabric.Canvas(canvasRef.current);
        fabricCanvasRef.current = canvas;

        loadWhiteboardState();
        setupSocketConnection();

        canvas.on('object:modified', syncChanges);
        canvas.on('object:added', syncChanges);

        // This return function will now correctly clean up the canvas and socket
        return () => {
            if (socketRef.current) {
                socketRef.current.disconnect();
            }
            if (fabricCanvasRef.current) {
                fabricCanvasRef.current.dispose();
            }
        };
    }
}, [boardId, authToken, loadWhiteboardState, setupSocketConnection, syncChanges]);
   return (
    <div className="whiteboard-page-container">
        <div className="whiteboard-container">
            <div className="whiteboard-toolbar">
                <button
                    onClick={() => toggleDrawingMode(null)}
                    className={drawingMode === null ? 'active-tool' : ''}
                >
                    Select
                </button>
                <button
                    onClick={() => toggleDrawingMode('Pencil')}
                    className={drawingMode === 'Pencil' ? 'active-tool' : ''}
                >
                    Pen
                </button>
                <button
                    onClick={() => toggleDrawingMode('Eraser')}
                    className={drawingMode === 'Eraser' ? 'active-tool' : ''}
                >
                    Eraser
                </button>
                <button
                    onClick={addStickyNote}
                    className={drawingMode === 'StickyNote' ? 'active-tool' : ''}
                >
                    Sticky Note
                </button>
                <button onClick={saveWhiteboardState}>Save</button>
                <button onClick={clearCanvas}>Clear All</button>
                <button onClick={deleteSelectedObjects}>Delete</button>
            </div>
            <canvas ref={canvasRef} id="main-whiteboard" width="1000" height="600" />
            <p className="message">{message}</p>
        </div>
        <Chat boardId={boardId} authToken={authToken} />
    </div>
);
};

export default Whiteboard;