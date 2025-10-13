import React, { useState, useEffect } from 'react';
import axios from 'axios';
import { Link } from 'react-router-dom';

const API_URL = 'http://127.0.0.1:5000/api';

const TaskAssignee = ({ authToken, boardId }) => {
    const [members, setMembers] = useState([]);
    const [message, setMessage] = useState('');

    useEffect(() => {
        fetchBoardMembers();
    }, [authToken, boardId]);

    const fetchBoardMembers = async () => {
        try {
            const response = await axios.get(`${API_URL}/boards/${boardId}/members`, {
                headers: { Authorization: `Bearer ${authToken}` },
            });
            setMembers(response.data);
        } catch (error) {
            setMessage('Failed to fetch board members.');
            console.error('Error fetching board members:', error);
        }
    };

    return (
        <div className="task-assignee-container">
            <h2>Board Members</h2>
            <p className="message">{message}</p>
            <div className="member-list">
                {members.length > 0 ? (
                    members.map(member => (
                        <div key={member.id} className="member-card">
                            <h4>{member.username}</h4>
                            <p>Assigned Tasks: 0</p> {/* Placeholder for now */}
                        </div>
                    ))
                ) : (
                    <p>No members found on this board.</p>
                )}
            </div>
            <Link to={`/boards/${boardId}`} className="back-to-board-button">Back to Board</Link>
        </div>
    );
};

export default TaskAssignee;