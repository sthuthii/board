import React from 'react';
import { useNavigate } from 'react-router-dom';

const LogoutButton = () => {
    const navigate = useNavigate();

    const handleLogout = () => {
        // 1. Remove the token and any user info from local storage
        localStorage.removeItem('token');
        localStorage.removeItem('username');
        
        // 2. Redirect the user to the login page
        navigate('/login');
        
        // 3. Optional: Force a page refresh to clear any global states
        window.location.reload();
    };

    return (
        <button 
            onClick={handleLogout}
            style={{
                padding: '10px 20px',
                backgroundColor: '#f44336', // Red color for logout
                color: 'white',
                border: 'none',
                borderRadius: '5px',
                cursor: 'pointer',
                fontWeight: 'bold'
            }}
            className="logout-btn"
        >
            Logout
        </button>
    );
};

export default LogoutButton;