import React, { useState, useEffect } from 'react';
import axios from 'axios';
import { Link } from 'react-router-dom';
import './Dashboard.css'

const API_URL = 'http://127.0.0.1:5000/api';

const Dashboard = ({ authToken, handleLogout }) => {
    const [boards, setBoards] = useState([]);
    const [boardName, setBoardName] = useState('');
    const [message, setMessage] = useState('');

    useEffect(() => {
        fetchBoards();
    }, [authToken]);

    const fetchBoards = async () => {
        try {
            const response = await axios.get(`${API_URL}/boards`, {
                headers: {
                    Authorization: `Bearer ${authToken}`,
                },
            });
            setBoards(response.data);
        } catch (error) {
            setMessage('Failed to fetch boards.');
            if (error.response?.status === 401) {
                handleLogout();
            }
        }
    };

    const handleCreateBoard = async (e) => {
        e.preventDefault();
        setMessage('');
        try {
            await axios.post(
                `${API_URL}/boards`,
                { name: boardName },
                {
                    headers: {
                        Authorization: `Bearer ${authToken}`,
                    },
                }
            );
            setMessage('Board created successfully!');
            setBoardName('');
            fetchBoards();
        } catch (error) {
            setMessage(error.response?.data?.msg || 'An error occurred.');
        }
    };

   return (
    <div className="dashboard-page-container">
        <header className="dashboard-header">
            <h1>Collabboard Dashboard</h1>
            <button onClick={handleLogout}>Logout</button>
        </header>

        <main className="dashboard-content">
            <form onSubmit={handleCreateBoard} className="board-form">
                <input
                    type="text"
                    value={boardName}
                    onChange={(e) => setBoardName(e.target.value)}
                    placeholder="Enter new board name"
                    required
                />
                <button type="submit">Create Board</button>
            </form>

            <p className="message">{message}</p>

            <div className="board-list-container">
                {boards.length > 0 ? (
                    boards.map((board) => (
                        <div key={board.id} className="board-card">
                            <h3>{board.name}</h3>
                            <p>ID: {board.id}</p>
                            <Link to={`/boards/${board.id}/whiteboard`}>Go to Whiteboard</Link>
                        </div>
                    ))
                ) : (
                    <p>No boards found. Create a new one!</p>
                )}
            </div>
        </main>
    </div>
);
};

export default Dashboard;