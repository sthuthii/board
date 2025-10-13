import React, { useState, useEffect } from 'react';
import axios from 'axios';
import { Link } from 'react-router-dom';
import './Dashboard.css';

const API_URL = 'http://127.0.0.1:5000/api';

const Dashboard = ({ authToken, handleLogout }) => {
    const [boards, setBoards] = useState([]);
    const [boardName, setBoardName] = useState('');
    const [message, setMessage] = useState('');
    const [memberQuery, setMemberQuery] = useState('');
    const [searchResults, setSearchResults] = useState([]);
    const [selectedMembers, setSelectedMembers] = useState([]);

    useEffect(() => {
        fetchBoards();
    }, [authToken]);

    const fetchBoards = async () => {
        try {
            const response = await axios.get(`${API_URL}/boards`, {
                headers: { Authorization: `Bearer ${authToken}` },
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
            const memberIds = selectedMembers.map(member => member.id);
            await axios.post(
                `${API_URL}/boards`,
                { name: boardName, members: memberIds },
                {
                    headers: {
                        Authorization: `Bearer ${authToken}`,
                    },
                }
            );
            setMessage('Board created successfully!');
            setBoardName('');
            setSelectedMembers([]);
            fetchBoards();
        } catch (error) {
            setMessage(error.response?.data?.msg || 'An error occurred.');
        }
    };

    const handleUserSearch = async () => {
        if (!memberQuery) {
            setSearchResults([]);
            return;
        }
        try {
            const response = await axios.get(`${API_URL}/users/search?q=${memberQuery}`, {
                headers: { Authorization: `Bearer ${authToken}` },
            });
            setSearchResults(response.data);
        } catch (error) {
            console.error('User search failed:', error);
            setSearchResults([]);
        }
    };

    const handleAddMember = (user) => {
        if (!selectedMembers.find(member => member.id === user.id)) {
            setSelectedMembers([...selectedMembers, user]);
        }
        setSearchResults([]);
        setMemberQuery('');
    };

    const handleRemoveMember = (memberId) => {
        setSelectedMembers(selectedMembers.filter(member => member.id !== memberId));
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

                    <div className="member-search-section">
                        <div className="member-search-form">
                            <input
                                type="text"
                                value={memberQuery}
                                onChange={(e) => setMemberQuery(e.target.value)}
                                placeholder="Search users by name or email"
                            />
                            <button type="button" onClick={handleUserSearch}>Search</button>
                        </div>
                        {searchResults.length > 0 && (
                            <div className="search-results">
                                {searchResults.map(user => (
                                    <div key={user.id} className="search-result-item" onClick={() => handleAddMember(user)}>
                                        {user.username} ({user.email})
                                    </div>
                                ))}
                            </div>
                        )}
                        {selectedMembers.length > 0 && (
                            <div className="selected-members">
                                <h4>Members to add:</h4>
                                {selectedMembers.map(member => (
                                    <span key={member.id} className="selected-member-tag">
                                        {member.username}
                                        <button type="button" onClick={() => handleRemoveMember(member.id)}>x</button>
                                    </span>
                                ))}
                            </div>
                        )}
                    </div>
                    
                    <button type="submit">Create Board</button>
                </form>

                <p className="message">{message}</p>

                <div className="board-list-container">
                    {boards.length > 0 ? (
                        boards.map((board) => (
                            <div key={board.id} className="board-card">
                                <h3>{board.name}</h3>
                                <p>ID: {board.id}</p>
                                <div className="board-card-links">
                                    <Link to={`/boards/${board.id}`}>Go to Board</Link>
                                    <Link to={`/boards/${board.id}/whiteboard`}>Go to Whiteboard</Link>
                                </div>
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