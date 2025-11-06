import React, { useState, useEffect } from 'react';
import { useParams, Link } from 'react-router-dom';
import axios from 'axios';

const API_URL = 'http://127.0.0.1:5000/api';

const AcceptInvite = () => {
    // 1. Removed unused setBoardId, keeping only boardId state for potential future use
    const { token } = useParams();
    const [status, setStatus] = useState('loading'); // 'loading', 'success', 'error'
    const [message, setMessage] = useState('Verifying invitation...');

    // The acceptInvitation function is placed outside of useEffect, as it should be.
    const acceptInvitation = async () => {
        try {
            const response = await axios.get(`${API_URL}/invites/${token}`);
            
            // NOTE: If your backend returns { msg: "...", board_id: 5 }, you would update the state here:
            // if (response.data.board_id) setBoardId(response.data.board_id); 
            
            setStatus('success');
            setMessage(response.data.msg);

        } catch (error) {
            setStatus('error');
            // Safely accessing the backend error message
            setMessage(error.response?.data?.msg || 'An unknown error occurred during verification.');
        }
    };

    useEffect(() => {
        // 2. The token is in the dependency array, ensuring acceptInvitation runs only when the token changes.
        if (token) {
            acceptInvitation();
        } else {
            setStatus('error');
            setMessage('Error: No invitation token provided.');
        }
    }, [token]);

    const renderContent = () => {
        if (status === 'loading') {
            return <p>{message}</p>;
        }
        if (status === 'success') {
            return (
                <>
                    <p className="success-message">✅ {message}</p>
                    {/* Link to the Dashboard or specific board if boardId were retrieved */}
                    <Link to="/" className="btn-primary">Go to Dashboard</Link>
                </>
            );
        }
        if (status === 'error') {
            return (
                <>
                    <p className="error-message">❌ {message}</p>
                    {/* Link back to the Dashboard/Login page */}
                    <Link to="/" className="btn-secondary">Back to Login</Link>
                </>
            );
        }
    };

    return (
        <div className="auth-page-container">
            <div className="auth-container">
                <h2>Board Invitation</h2>
                {renderContent()}
            </div>
        </div>
    );
};

export default AcceptInvite;