import React, { useState} from 'react';
import axios from 'axios';
import './BoardView.css';

const API_URL = 'http://127.0.0.1:5000/api';

const TaskDetailModal = ({ task, boardMembers, authToken, onClose, onTaskUpdate, onTaskDelete }) => {
    //                                                                                          ^^^^^^^^^^^^^^^^^^^^^^ Removed fetchBoardData here
    const [title, setTitle] = useState(task.title);
    const [description, setDescription] = useState(task.description || '');
    const [assigneeId, setAssigneeId] = useState(task.assignee_id || '');
    const [message, setMessage] = useState('');

    const handleSave = async (e) => {
        e.preventDefault();
        setMessage('');
        try {
            const updatedTask = {
                title,
                description,
                assignee_id: assigneeId ? parseInt(assigneeId) : null,
            };

            await axios.put(`${API_URL}/tasks/${task.id}`, updatedTask, {
                headers: { Authorization: `Bearer ${authToken}` },
            });

            // Update local state and close modal
            onTaskUpdate({ ...task, ...updatedTask });
            onClose();
        } catch (error) {
            setMessage('Failed to save task.');
            console.error('Task update failed:', error);
        }
    };

    const handleDelete = async () => {
        if (!window.confirm(`Are you sure you want to delete the task: "${task.title}"?`)) return;
        
        try {
            await axios.delete(`${API_URL}/tasks/${task.id}`, {
                headers: { Authorization: `Bearer ${authToken}` },
            });
            
            // Call the handler to update BoardView state immediately and close
            onTaskDelete(task.id);
            onClose();
            
        } catch (error) {
            setMessage(error.response?.data?.msg || 'Failed to delete task.');
            console.error('Task deletion failed:', error);
        }
    };

    return (
        <div className="modal-backdrop">
            <div className="modal-content">
                <h2>Edit Task: {task.title}</h2>
                <form onSubmit={handleSave}>
                    <label>
                        Title:
                        <input type="text" value={title} onChange={(e) => setTitle(e.target.value)} required />
                    </label>
                    <label>
                        Description:
                        <textarea value={description} onChange={(e) => setDescription(e.target.value)} />
                    </label>
                    <label>
                        Assignee:
                        <select value={assigneeId} onChange={(e) => setAssigneeId(e.target.value)}>
                            <option value="">Unassigned</option>
                            {boardMembers.map(member => (
                                <option key={member.id} value={member.id}>
                                    {member.username}
                                </option>
                            ))}
                        </select>
                    </label>
                    <div className="modal-actions">
                        <button type="submit" className="btn-primary">Save Changes</button>
                        <button type="button" onClick={onClose} className="btn-secondary">Cancel</button>
                        <button type="button" onClick={handleDelete} className="btn-danger">Delete</button>
                    </div>
                </form>
                <p className="modal-message">{message}</p>
            </div>
        </div>
    );
};

export default TaskDetailModal;