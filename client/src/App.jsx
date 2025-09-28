import React, { useState, useEffect, useCallback } from 'react';
import { Routes, Route, useNavigate } from 'react-router-dom';
import Auth from './components/Auth';
import Dashboard from './components/Dashboard';
import Whiteboard from './components/WhiteBoard';
import BoardView from './components/BoardView';

const App = () => {
    const [authToken, setAuthToken] = useState(localStorage.getItem('token'));
    const navigate = useNavigate();

    const handleLogout = useCallback(() => {
        localStorage.removeItem('token');
        setAuthToken(null);
        navigate('/');
    }, [navigate]);

    useEffect(() => {
        if (!authToken) {
            navigate('/');
        }
    }, [authToken, navigate]);

    return (
        <Routes>
            <Route
                path="/"
                element={
                    authToken ? (
                        <Dashboard authToken={authToken} handleLogout={handleLogout} />
                    ) : (
                        <Auth setAuthToken={setAuthToken} />
                    )
                }
            />
            <Route 
                path="/boards/:boardId"
                element={<BoardView authToken={authToken} handleLogout={handleLogout} />}
            />
            <Route
                path="/boards/:boardId/whiteboard"
                element={<Whiteboard authToken={authToken} />}
            />
        </Routes>
    );
};

export default App;