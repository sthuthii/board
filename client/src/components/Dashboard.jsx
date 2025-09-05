import React, { useState, useEffect } from 'react';
import axios from 'axios';
import { Link } from 'react-router-dom';

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
            console.error('Error fetching boards:', error);
            if (error.response?.status === 401) {
                handleLogout(); // Log out if the token is invalid
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
            fetchBoards(); // Refresh the list of boards
        } catch (error) {
            setMessage(error.response?.data?.msg || 'An error occurred.');
        }
    };

    return (
        <div className="dashboard-container">
            <h1>Your Boards</h1>
            <button onClick={handleLogout}>Logout</button>

            <form onSubmit={handleCreateBoard}>
                <input
                    type="text"
                    value={boardName}
                    onChange={(e) => setBoardName(e.target.value)}
                    placeholder="New Board Name"
                    required
                />
                <button type="submit">Create Board</button>
            </form>

            <p className="message">{message}</p>

            <div className="board-list">
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
        </div>
    );
};

export default Dashboard;