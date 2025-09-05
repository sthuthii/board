// ... (existing imports) ...
import React, { useState, useEffect } from 'react';
import { Routes, Route, useNavigate } from 'react-router-dom';
import Auth from './components/Auth';
import Dashboard from './components/Dashboard';
import Whiteboard from './components/WhiteBoard';

function App() {
    const [authToken, setAuthToken] = useState(localStorage.getItem('token'));
    const navigate = useNavigate();

    const handleLogout = () => {
        localStorage.removeItem('token');
        setAuthToken(null);
        navigate('/');
    };

    useEffect(() => {
        if (!authToken) {
            navigate('/');
        }
    }, [authToken, navigate]);

    return (
        <div className="App">
            <Routes>
                <Route path="/" element={
                    authToken ? (
                        <Dashboard authToken={authToken} handleLogout={handleLogout} />
                    ) : (
                        <Auth setAuthToken={setAuthToken} />
                    )
                } />
                <Route 
                    path="/boards/:boardId/whiteboard" 
                    element={<Whiteboard authToken={authToken} />} 
                />
            </Routes>
        </div>
    );
}

export default App;