import React, { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import axios from 'axios';
import { DragDropContext, Droppable, Draggable } from '@hello-pangea/dnd';
import './BoardView.css';
import { Link } from 'react-router-dom';

const API_URL = 'http://127.0.0.1:5000/api';

const BoardView = ({ authToken, handleLogout }) => {
    const { boardId } = useParams();
    const navigate = useNavigate();
    const [board, setBoard] = useState(null);
    const [tasks, setTasks] = useState([]);
    const [message, setMessage] = useState('');
    const [newTaskTitle, setNewTaskTitle] = useState('');
    const [assigneeDetails, setAssigneeDetails] = useState({});

    useEffect(() => {
        if (authToken && boardId) {
            fetchBoardData();
        } else {
            navigate('/');
        }
    }, [authToken, boardId, navigate]);

    const fetchBoardData = async () => {
        try {
            const response = await axios.get(`${API_URL}/boards/${boardId}`, {
                headers: { Authorization: `Bearer ${authToken}` },
            });
            setBoard(response.data);
            setTasks(response.data.tasks || []);
        } catch (error) {
            setMessage(error.response?.data?.msg || 'Failed to fetch board data.');
            console.error('Error fetching board data:', error);
            if (error.response?.status === 401) {
                handleLogout();
            }
        }
    };

    const handleCreateTask = async (e) => {
        e.preventDefault();
        if (!newTaskTitle.trim()) return;

        try {
            const response = await axios.post(`${API_URL}/boards/${boardId}/tasks`, {
                title: newTaskTitle,
            }, {
                headers: { Authorization: `Bearer ${authToken}` },
            });

            // Assuming the backend returns the full new task object
            setTasks(prevTasks => [...prevTasks, response.data.task]);
            setNewTaskTitle('');
        } catch (error) {
            console.error('Error creating task:', error);
            setMessage('Failed to create task.');
        }
    };

    const handleTaskClick = async (task) => {
        if (task.assignee_id) {
            try {
                const response = await axios.get(`${API_URL}/users/${task.assignee_id}`, {
                    headers: { Authorization: `Bearer ${authToken}` },
                });
                setAssigneeDetails(prev => ({ ...prev, [task.id]: response.data.username }));
            } catch (error) {
                console.error('Failed to fetch assignee details:', error);
                setAssigneeDetails(prev => ({ ...prev, [task.id]: 'Error' }));
            }
        }
    };
    
    // In BoardView.jsx
const onDragEnd = async (result) => {
    const { destination, source, draggableId } = result;

    if (!destination) {
        return;
    }

    if (destination.droppableId === source.droppableId && destination.index === source.index) {
        return;
    }

    const newStatus = destination.droppableId;
    const movedTaskIndex = tasks.findIndex(task => task.id === parseInt(draggableId));
    if (movedTaskIndex === -1) return;

    const movedTask = { ...tasks[movedTaskIndex], status: newStatus };
    
    // Create a new array of tasks with the updated status and order
    const newTasks = Array.from(tasks).filter(task => task.id !== parseInt(draggableId));
    newTasks.splice(destination.index, 0, movedTask);
    
    // Update the state immediately
    setTasks(newTasks);
    
    // Call the backend to persist the change
    try {
        await axios.put(`${API_URL}/tasks/${movedTask.id}`, { status: newStatus }, {
            headers: { Authorization: `Bearer ${authToken}` },
        });
        setMessage(`Task moved to ${newStatus}`);
    } catch (error) {
        console.error("Failed to update task status:", error);
        setMessage("Failed to update task status. Please refresh.");
        // If the backend call fails, re-fetch the data to revert the changes
        fetchBoardData();
    }
};

    if (!board) {
        return <div>Loading board...</div>;
    }

    const renderTasks = (status) => {
        return tasks.filter(task => task.status === status);
    };

    return (
    <div className="board-page-container">
        <div className="kanban-board-wrapper">
            <h1 className="board-title">{board.name}</h1>
            <div className="board-actions">
                <Link to={`/boards/${boardId}/whiteboard`}>Go to Whiteboard</Link>
                <p className="message">{message}</p>
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
                                                    onClick={() => handleTaskClick(task)}
                                                >
                                                    <h4>{task.title}</h4>
                                                    {assigneeDetails[task.id] && (
                                                        <p className="task-assignee">Assigned to: {assigneeDetails[task.id]}</p>
                                                    )}
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
            <p>List of board members goes here...</p>
        </div>
    </div>
);
};

export default BoardView;