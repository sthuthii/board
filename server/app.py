import os
from flask import Flask, jsonify
from extensions import db, migrate, jwt, cors, socketio, mail
from api.auth import auth_bp
from api.boards import boards_bp
# 1. Ensure this matches your filename (if it's tasks.py, use tasks_bp)
from api.task import tasks_bp 
from api.sockets import register_socket_handlers

def create_app():
    """Application Factory Function"""
    app = Flask(__name__)

    # --- Configuration ---
    app.config['SQLALCHEMY_DATABASE_URI'] = 'sqlite:///' + os.path.join(os.getcwd(), 'collabboard.db')
    app.config['SQLALCHEMY_TRACK_MODIFICATIONS'] = False
    app.config['JWT_SECRET_KEY'] = 'your-super-secret-key-that-should-be-in-env'
    
    # Email settings
    app.config['MAIL_SERVER'] = 'smtp.gmail.com'
    app.config['MAIL_PORT'] = 587
    app.config['MAIL_USE_TLS'] = True
    app.config['MAIL_USERNAME'] = 'your-email@gmail.com'
    app.config['MAIL_PASSWORD'] = 'your-email-password'
    app.config['MAIL_DEFAULT_SENDER'] = 'your-email@gmail.com'

    # --- Initialize Extensions ---
    db.init_app(app)
    migrate.init_app(app, db)
    jwt.init_app(app)
    mail.init_app(app)
    
    # 2. FIX: Explicit CORS configuration to allow Authorization headers
    # In app.py inside create_app()
    cors.init_app(app, resources={
    r"/api/*": {
        "origins": ["http://localhost:5173"], # Your Vite frontend URL
        "methods": ["GET", "POST", "PUT", "DELETE", "OPTIONS"],
        "allow_headers": ["Content-Type", "Authorization"],
        "supports_credentials": True
    }
})
    
    # 3. SocketIO Initialization
    socketio.init_app(app, cors_allowed_origins="*")

    # --- Register Blueprints ---
    # Auth handles /api/register and /api/login
    app.register_blueprint(auth_bp, url_prefix='/api')
    
    # Boards handles /api/boards
    app.register_blueprint(boards_bp, url_prefix='/api/boards')
    
    # Tasks handles /api/tasks
    app.register_blueprint(tasks_bp, url_prefix='/api/task')

    # --- Register SocketIO Handlers ---
    # We pass 'app' context if needed, but usually just socketio is fine
    register_socket_handlers(socketio)

    # --- Global Routes ---
    @app.route('/')
    def home():
        return jsonify({"message": "Collabboard Backend API is running!"}), 200
  
    @app.before_request
    def log_request_info():
        from flask import request
        print(f"--- Incoming Request ---")
        print(f"Method: {request.method}")
        print(f"URL: {request.url}")
        print(f"Path: {request.path}")
        print(f"------------------------")
        
    return app

if __name__ == "__main__":
    app = create_app()
    # 4. Use allow_unsafe_werkzeug if running in certain local environments, 
    # but usually debug=True is enough for dev.
    socketio.run(app, debug=True, port=5000)