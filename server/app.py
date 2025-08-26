from flask import Flask, request, jsonify
from flask_sqlalchemy import SQLAlchemy
from flask_migrate import Migrate
from flask_jwt_extended import JWTManager, create_access_token, jwt_required, get_jwt_identity
from flask_cors import CORS
from flask_socketio import SocketIO, emit, join_room, leave_room
import os
from werkzeug.security import generate_password_hash, check_password_hash
from datetime import timedelta

# Create the extensions without an app instance
db = SQLAlchemy()
migrate = Migrate()
jwt = JWTManager()
cors = CORS()
socketio = SocketIO()

def create_app():
    """Application Factory Function"""
    app = Flask(__name__)

    # Basic Configuration
    app.config['SQLALCHEMY_DATABASE_URI'] = 'sqlite:///' + os.path.join(os.getcwd(), 'collabboard.db')
    app.config['SQLALCHEMY_TRACK_MODIFICATIONS'] = False
    app.config['JWT_SECRET_KEY'] = 'your-super-secret-key-that-should-be-in-env'
    
    # Initialize extensions with the app
    db.init_app(app)
    migrate.init_app(app, db)
    jwt.init_app(app)
    cors.init_app(app)
    socketio.init_app(app, cors_allowed_origins="*")

    # Import and register models (necessary for migration)
    from models import User, Board, BoardMember, Task, ChatMessage

    # -------------------- REST API Endpoints --------------------
    # ... (paste all your existing routes here from the previous step) ...
    @app.route('/')
    def home():
        return "Collabboard Backend is running!"

    @app.route('/api/register', methods=['POST'])
    def register():
        data = request.get_json()
        username = data.get('username')
        email = data.get('email')
        password = data.get('password')

        if not username or not email or not password:
            return jsonify({"msg": "Missing username, email, or password"}), 400

        if User.query.filter_by(email=email).first():
            return jsonify({"msg": "User with that email already exists"}), 409

        hashed_password = generate_password_hash(password)
        new_user = User(username=username, email=email, password_hash=hashed_password)
        db.session.add(new_user)
        db.session.commit()
        return jsonify({"msg": "User created successfully"}), 201

    @app.route('/api/login', methods=['POST'])
    def login():
        data = request.get_json()
        email = data.get('email')
        password = data.get('password')

        if not email or not password:
            return jsonify({"msg": "Missing email or password"}), 400

        user = User.query.filter_by(email=email).first()

        if user and check_password_hash(user.password_hash, password):
            access_token = create_access_token(identity=str(user.id))
            return jsonify(access_token=access_token, username=user.username), 200
        else:
            return jsonify({"msg": "Bad username or password"}), 401

    @app.route('/api/boards', methods=['POST'])
    @jwt_required()
    def create_board():
        """Create a new collaborative board."""
        user_id = int(get_jwt_identity())
        data = request.get_json()
        name = data.get('name')

        if not name:
            return jsonify({"msg": "Board name is required"}), 400

    # 1. Create the new board and add it to the session
        new_board = Board(name=name, owner_id=user_id)
        db.session.add(new_board)
    
    # 2. Flush the session to get the new board's ID
    # This assigns an ID to the new_board object without committing the transaction
        db.session.flush()

    # 3. Use the newly assigned ID to create the board member entry
        board_member = BoardMember(board_id=new_board.id, user_id=user_id, role='owner')
        db.session.add(board_member)
    
    # 4. Commit all changes at once
        db.session.commit()

        return jsonify({
            "msg": "Board created successfully",
            "board_id": new_board.id,
            "board_name": new_board.name
        }), 201

    @app.route('/api/boards', methods=['GET'])
    @jwt_required()
    def get_boards():
        user_id = int(get_jwt_identity())
        memberships = BoardMember.query.filter_by(user_id=user_id).all()
        boards = []
        for member in memberships:
            board = Board.query.get(member.board_id)
            if board:
                boards.append({
                    "id": board.id,
                    "name": board.name,
                    "owner_id": board.owner_id
                })
        return jsonify(boards), 200

    @app.route('/api/boards/<int:board_id>/tasks', methods=['POST'])
    @jwt_required()
    def create_task(board_id):
        user_id = int(get_jwt_identity())
        data = request.get_json()
        title = data.get('title')
        description = data.get('description', None)
        assignee_id = data.get('assignee_id', None)

        if not title:
            return jsonify({"msg": "Task title is required"}), 400

        is_member = BoardMember.query.filter_by(board_id=board_id, user_id=user_id).first()
        if not is_member:
            return jsonify({"msg": "You are not a member of this board"}), 403

        new_task = Task(
            board_id=board_id,
            title=title,
            description=description,
            assignee_id=assignee_id,
            status='to_do'
        )
        db.session.add(new_task)
        db.session.commit()
        return jsonify({
            "msg": "Task created successfully",
            "task_id": new_task.id,
            "title": new_task.title
        }), 201

    # ... (existing code for the update_task function) ...

    @app.route('/api/tasks/<int:task_id>', methods=['PUT'])
    @jwt_required()
    def update_task(task_id):
        """Update an existing task's details and notify clients."""
        user_id = int(get_jwt_identity())
        data = request.get_json()
        task = Task.query.get(task_id)

        if not task:
            return jsonify({"msg": "Task not found"}), 404

        is_member = BoardMember.query.filter_by(board_id=task.board_id, user_id=user_id).first()
        if not is_member:
            return jsonify({"msg": "You are not a member of this board"}), 403
    
    # Store old status to detect a change
        old_status = task.status
    
        if 'title' in data:
            task.title = data['title']
        if 'description' in data:
            task.description = data['description']
        if 'assignee_id' in data:
            task.assignee_id = data['assignee_id']
        if 'status' in data:
            task.status = data['status']

        db.session.commit()

    # Get the updated task data to send to the clients
        updated_task_data = {
            'id': task.id,
            'title': task.title,
            'description': task.description,
            'assignee_id': task.assignee_id,
            'status': task.status
        }
    
    # Emit the real-time update to all clients in the board's room
    # We use socketio.emit() because this is a REST API route, not an event handler
        socketio.emit('task_update', {
            'task': updated_task_data,
            'board_id': task.board_id
        }, room=str(task.board_id))

        return jsonify({"msg": "Task updated successfully"}), 200

    # -------------------- SocketIO Event Handlers --------------------
    @socketio.on('join')
    @jwt_required()
    def on_join(data):
        user_id = int(get_jwt_identity())
        room = data.get('board_id')
        is_member = BoardMember.query.filter_by(board_id=room, user_id=user_id).first()
        if is_member:
            join_room(str(room))
            emit('status', {'msg': f'User {user_id} has entered the room.'}, room=str(room))

    @socketio.on('leave')
    @jwt_required()
    def on_leave(data):
        user_id = int(get_jwt_identity())
        room = data.get('board_id')
        leave_room(str(room))
        emit('status', {'msg': f'User {user_id} has left the room.'}, room=str(room))

    
# -------------------- SocketIO Event Handlers --------------------

    @socketio.on('chat_message')
    @jwt_required()
    def on_chat_message(data):
        """Event handler for new chat messages."""
        user_id = int(get_jwt_identity())
        room = data.get('board_id')
        message = data.get('message')

        if not all([room, message]):
            return # Do nothing if data is incomplete

    # 1. Save the message to the database
        new_chat_message = ChatMessage(
            board_id=room,
            user_id=user_id,
            message=message
        )
        db.session.add(new_chat_message)
        db.session.commit()

    # 2. Broadcast the message to all clients in the same room
        emit('chat_message', {
            'user_id': user_id,
            'username': User.query.get(user_id).username, # Get the username to display in the chat
            'message': message,
            'timestamp': new_chat_message.timestamp.isoformat()
        }, room=str(room))

    @socketio.on('task_update')
    @jwt_required()
    def on_task_update(data):
        room = data.get('board_id')
        emit('task_update', data, room=str(room))


    return app