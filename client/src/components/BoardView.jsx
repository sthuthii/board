import React, { useState, useEffect, useCallback } from 'react';
import { useParams, useNavigate, Link } from 'react-router-dom';
import axios from 'axios';
import { DragDropContext, Droppable, Draggable } from '@hello-pangea/dnd';
import TaskDetailModal from './TaskDetailModal';
import './BoardView.css';

const API_URL = 'http://127.0.0.1:5000/api';

const BoardView = ({ authToken, handleLogout }) => {
    // 1. ALL HOOKS MUST BE AT THE TOP (FATAL ERROR FIX)
    const { boardId } = useParams();
    const navigate = useNavigate();
    const [board, setBoard] = useState(null);
    const [tasks, setTasks] = useState([]);
    const [members, setMembers] = useState([]);
    const [message, setMessage] = useState('');
    const [newTaskTitle, setNewTaskTitle] = useState('');
    const [selectedTask, setSelectedTask] = useState(null);
    const [inviteEmail, setInviteEmail] = useState(''); // Added missing state for invite form

    const fetchBoardData = useCallback(async () => {
        try {
            const boardResponse = await axios.get(`${API_URL}/boards/${boardId}`, {
                headers: { Authorization: `Bearer ${authToken}` },
            });
            setBoard(boardResponse.data);
            setTasks(boardResponse.data.tasks || []);

            const membersResponse = await axios.get(`${API_URL}/boards/${boardId}/members`, {
                headers: { Authorization: `Bearer ${authToken}` },
            });
            setMembers(membersResponse.data);
        } catch (error) {
            setMessage(error.response?.data?.msg || 'Failed to fetch board data.');
            console.error('Error fetching board data:', error);
            if (error.response?.status === 401) {
                handleLogout();
            }
        }
    }, [authToken, boardId, handleLogout]); // 2. FUNCTION STABILIZED with useCallback

    useEffect(() => {
        if (authToken && boardId) {
            fetchBoardData();
        } else {
            navigate('/');
        }
    }, [authToken, boardId, navigate, fetchBoardData]); // 3. CALLBACK ADDED to dependencies

    // ... rest of the functions (handleCreateTask, handleTaskUpdate, onDragEnd, etc.)

    const handleCreateTask = async (e) => {
        e.preventDefault();
        if (!newTaskTitle.trim()) return;

        try {
            await axios.post(`${API_URL}/boards/${boardId}/tasks`, {
                title: newTaskTitle,
            }, {
                headers: { Authorization: `Bearer ${authToken}` },
            });

            setNewTaskTitle('');
            fetchBoardData();
            setMessage('Task created successfully!');
        } catch (error) {
            console.error('Error creating task:', error);
            setMessage(error.response?.data?.msg || 'Failed to create task.');
        }
    };
    
    // NOTE: All other functions (onDragEnd, handleTaskUpdate, etc.) must remain below the hooks.

    // ... (rest of the component's JSX structure)

    const handleTaskUpdate = (updatedTask) => {
        setTasks(prevTasks => prevTasks.map(t => t.id === updatedTask.id ? updatedTask : t));
    };

    const handleTaskDelete = (taskId) => {
        setTasks(prevTasks => prevTasks.filter(t => t.id !== taskId));
    };

    // The rest of the onDragEnd, getAssigneeUsername, renderTasks logic goes here...
    
    const onDragEnd = async (result) => {
        const { destination, source, draggableId } = result;
        if (!destination || (destination.droppableId === source.droppableId && destination.index === source.index)) {
            return;
        }

        const newStatus = destination.droppableId;
        const movedTaskIndex = tasks.findIndex(task => task.id === parseInt(draggableId));
        if (movedTaskIndex === -1) return;

        const movedTask = { ...tasks[movedTaskIndex], status: newStatus };
        
        const newTasks = Array.from(tasks).filter(task => task.id !== parseInt(draggableId));
        newTasks.splice(destination.index, 0, movedTask);
        
        setTasks(newTasks);
        
        try {
            await axios.put(`${API_URL}/tasks/${movedTask.id}`, { status: newStatus }, {
                headers: { Authorization: `Bearer ${authToken}` },
            });
            setMessage(`Task moved to ${newStatus}`);
        } catch (error) {
            console.error("Failed to update task status:", error);
            setMessage("Failed to update task status. Please refresh.");
            fetchBoardData(); // Revert on error
        }
    };

    if (!board) {
        return <div>Loading board...</div>;
    }

    const getAssigneeUsername = (assigneeId) => {
        const member = members.find(m => m.id === assigneeId);
        return member ? member.username : 'Unassigned';
    };

    const renderTasks = (status) => {
        return tasks.filter(task => task.status === status);
    };

    const handleInviteMember = async (e) => {
        e.preventDefault();
        if (!inviteEmail.trim()) return;

        try {
            const response = await axios.post(`${API_URL}/boards/${boardId}/invite`, 
                { email: inviteEmail }, 
                { headers: { Authorization: `Bearer ${authToken}` } }
            );
            setMessage(response.data.msg);
            setInviteEmail('');
            fetchBoardData(); // Refresh members list to show 'invited' status
        } catch (error) {
            setMessage(error.response?.data?.msg || 'Failed to send invite.');
        }
    };


    return (
        <div className="board-page-container">
            {selectedTask && (
                <TaskDetailModal 
                    task={selectedTask}
                    boardMembers={members}
                    authToken={authToken}
                    onClose={() => setSelectedTask(null)}
                    onTaskUpdate={handleTaskUpdate}
                    onTaskDelete={handleTaskDelete}
                    fetchBoardData={fetchBoardData}
                />
            )}
            <div className="kanban-board-wrapper">
                <h1 className="board-title">{board.name}</h1>
                <div className="board-actions">
                    <Link to={`/boards/${boardId}/whiteboard`}>Go to Whiteboard</Link>
                </div>

                <form onSubmit={handleCreateTask} className="task-creation-form">
                    <input
                        type="text"
                        value={newTaskTitle}
                        onChange={(e) => setNewTaskTitle(e.target.value)}
                        placeholder="New task title"
                        required
                    />
                    <button type="submit">Add Task</button>
                </form>

                <p className="message">{message}</p>

                <DragDropContext onDragEnd={onDragEnd}>
                    <div className="kanban-board">
                        {['to_do', 'in_progress', 'done'].map(status => (
                            <Droppable droppableId={status} key={status}>
                                {(provided) => (
                                    <div className="kanban-column" {...provided.droppableProps} ref={provided.innerRef}>
                                        <h2>{status.replace('_', ' ').toUpperCase()}</h2>
                                        {renderTasks(status).map((task, index) => (
                                            <Draggable draggableId={task.id.toString()} index={index} key={task.id}>
                                                {(provided) => (
                                                    <div 
                                                        className="task-card"
                                                        ref={provided.innerRef}
                                                        {...provided.draggableProps}
                                                        {...provided.dragHandleProps}
                                                        onClick={() => setSelectedTask(task)}
                                                    >
                                                        <h4>{task.title}</h4>
                                                        <p className="task-assignee">
                                                            Assigned to: {getAssigneeUsername(task.assignee_id)}
                                                        </p>
                                                    </div>
                                                )}
                                            </Draggable>
                                        ))}
                                        {provided.placeholder}
                                    </div>
                                )}
                            </Droppable>
                        ))}
                    </div>
                </DragDropContext>
            </div>
            
            <div className="task-assignee-sidebar">
                <h2 className="sidebar-title">Board Members</h2>
                <div className="member-list">
                    {members.map(member => (
                        <div key={member.id} className="member-card">
                            <h4>{member.username}</h4>
                            <p>Role: {member.role.toUpperCase()}</p>
                            {member.status === 'invited' && <p className="invited-status">(Awaiting acceptance)</p>}
                        </div>
                    ))}
                </div>

                <h3 className="sidebar-subtitle">Invite New Member</h3>
                <form onSubmit={handleInviteMember} className="invite-form">
                    <input 
                        type="email"
                        value={inviteEmail}
                        onChange={(e) => setInviteEmail(e.target.value)}
                        placeholder="Enter user's email"
                        required
                    />
                    <button type="submit">Send Invite</button>
                </form>
            </div>
        </div>
    );
};

export default BoardView;