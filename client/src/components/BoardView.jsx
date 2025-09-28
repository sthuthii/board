import React, { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import axios from 'axios';
import { DragDropContext, Droppable, Draggable } from '@hello-pangea/dnd';
import './BoardView.css';

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
    
    const onDragEnd = async (result) => {
        const { destination, source, draggableId } = result;

        if (!destination) {
            return;
        }

        if (destination.droppableId === source.droppableId && destination.index === source.index) {
            return;
        }

        const movedTask = tasks.find(task => task.id === parseInt(draggableId));
        if (!movedTask) return;

        const newTasks = Array.from(tasks);
        newTasks.splice(source.index, 1);
        newTasks.splice(destination.index, 0, movedTask);
        setTasks(newTasks);

        const newStatus = destination.droppableId;
        if (movedTask.status !== newStatus) {
            try {
                await axios.put(`${API_URL}/tasks/${movedTask.id}`, { status: newStatus }, {
                    headers: { Authorization: `Bearer ${authToken}` },
                });
                fetchBoardData(); // Re-fetch to sync
            } catch (error) {
                console.error("Failed to update task status:", error);
                setMessage("Failed to update task status. Please refresh.");
                fetchBoardData(); // Revert on error
            }
        }
    };

    if (!board) {
        return <div>Loading board...</div>;
    }

    const renderTasks = (status) => {
        return tasks.filter(task => task.status === status);
    };

    return (
        <div className="board-view-container">
            <h1>{board.name}</h1>
            <p className="message">{message}</p>

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
    );
};

export default BoardView;