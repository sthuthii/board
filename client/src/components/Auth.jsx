import React, { useState } from 'react';
import axios from 'axios';
import './Auth.css'

const API_URL = 'http://127.0.0.1:5000/api';

const Auth = ({ setAuthToken }) => {
    const [isLogin, setIsLogin] = useState(true);
    const [username, setUsername] = useState('');
    const [email, setEmail] = useState('');
    const [password, setPassword] = useState('');
    const [message, setMessage] = useState('');

    const handleSubmit = async (e) => {
        e.preventDefault();
        setMessage('');
        try {
            if (isLogin) {
                const response = await axios.post(`${API_URL}/login`, { email, password });
                localStorage.setItem('token', response.data.access_token);
                setAuthToken(response.data.access_token);
                setMessage('Login successful!');
            } else {
                await axios.post(`${API_URL}/register`, { username, email, password });
                setMessage('Registration successful! Please log in.');
                setIsLogin(true);
            }
        } catch (error) {
            setMessage(error.response?.data?.msg || 'An error occurred.');
        }
    };

    return (
    <div className="auth-page-container">
        <div className="auth-container">
            <h2>{isLogin ? 'Login' : 'Register'}</h2>
            <form onSubmit={handleSubmit}>
                {!isLogin && (
                    <input
                        type="text"
                        value={username}
                        onChange={(e) => setUsername(e.target.value)}
                        placeholder="Username"
                        required
                    />
                )}
                <input
                    type="email"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    placeholder="Email"
                    required
                />
                <input
                    type="password"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    placeholder="Password"
                    required
                />
                <button type="submit">{isLogin ? 'Login' : 'Register'}</button>
            </form>
            <p className="message">{message}</p>
            <button onClick={() => setIsLogin(!isLogin)}>
                {isLogin ? 'Need to register?' : 'Already have an account?'}
            </button>
        </div>
    </div>
);
};

export default Auth;