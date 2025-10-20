# In app.py
from flask import Flask, request, jsonify
from flask_sqlalchemy import SQLAlchemy
from flask_migrate import Migrate
from flask_jwt_extended import JWTManager, create_access_token, jwt_required, get_jwt_identity
from flask_cors import CORS
from flask_socketio import SocketIO, emit, join_room, leave_room
import os
from werkzeug.security import generate_password_hash, check_password_hash
from datetime import timedelta
from itsdangerous import URLSafeTimedSerializer
from flask_mail import Mail, Message
from flask.cli import with_appcontext

# Create the extensions without an app instance
db = SQLAlchemy()
migrate = Migrate()
jwt = JWTManager()
cors = CORS()
socketio = SocketIO()
mail = Mail()
serializer = URLSafeTimedSerializer("your-super-secret-key-for-invites") # Use a separate, secure key here

def create_app():
    """Application Factory Function"""
    try:
        app = Flask(__name__)

        # Basic Configuration
        app.config['SQLALCHEMY_DATABASE_URI'] = 'sqlite:///' + os.path.join(os.getcwd(), 'collabboard.db')
        app.config['SQLALCHEMY_TRACK_MODIFICATIONS'] = False
        app.config['JWT_SECRET_KEY'] = 'your-super-secret-key-that-should-be-in-env'
        
        # Email configuration for sending invites (using a placeholder for now)
        app.config['MAIL_SERVER'] = 'smtp.gmail.com'
        app.config['MAIL_PORT'] = 587
        app.config['MAIL_USE_TLS'] = True
        app.config['MAIL_USERNAME'] = 'your-email@gmail.com'
        app.config['MAIL_PASSWORD'] = 'your-email-password'
        app.config['MAIL_DEFAULT_SENDER'] = 'your-email@gmail.com'

        # Initialize extensions with the app
        db.init_app(app)
        migrate.init_app(app, db)
        jwt.init_app(app)
        cors.init_app(app, resources={r"/api/*": {"origins": "*", "methods": ["GET", "POST", "PUT", "DELETE", "OPTIONS"]}})
        socketio.init_app(app, cors_allowed_origins="*")
        mail.init_app(app)

        # Import and register models (necessary for migration)
        from models import User, Board, BoardMember, Task, ChatMessage

        # -------------------- REST API Endpoints --------------------
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
            user_id = int(get_jwt_identity())
            data = request.get_json()
            name = data.get('name')
            member_ids = data.get('members', [])
            if not name:
                return jsonify({"msg": "Board name is required"}), 400
            new_board = Board(name=name, owner_id=user_id)
            db.session.add(new_board)
            db.session.flush()
            board_member = BoardMember(board_id=new_board.id, user_id=user_id, role='owner', status='member')
            db.session.add(board_member)
            for member_id in member_ids:
                if User.query.get(member_id):
                    new_member = BoardMember(board_id=new_board.id, user_id=member_id, role='member', status='member')
                    db.session.add(new_member)
            db.session.commit()
            return jsonify({"msg": "Board created successfully", "board_id": new_board.id, "board_name": new_board.name}), 201

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
                        "owner_id": board.owner_id,
                        "whiteboard_data": board.whiteboard_data,
                    })
            return jsonify(boards), 200

        @app.route('/api/boards/<int:board_id>', methods=['GET'])
        @jwt_required()
        def get_board(board_id):
            user_id = int(get_jwt_identity())
            from models import Board, BoardMember # Ensure models are imported inside the function
    
    # 1. Check membership
            is_member = BoardMember.query.filter_by(board_id=board_id, user_id=user_id).first()
            if not is_member:
                return jsonify({"msg": "You are not a member of this board"}), 403
    
            board = Board.query.get(board_id)
            if not board:
                return jsonify({"msg": "Board not found"}), 404

    # 2. Fetch and format tasks (CRITICAL STEP for Kanban persistence)
            tasks_data = []
    # This relies on the 'tasks_rel' relationship being defined in models.py
            for task in board.tasks_rel.all():
                tasks_data.append({
            "id": task.id,
            "title": task.title,
            "description": task.description,
            "assignee_id": task.assignee_id,
            "status": task.status,
            "board_id": task.board_id
        })

    # 3. Return the board data including tasks
            return jsonify({
        "id": board.id,
        "name": board.name,
        "owner_id": board.owner_id,
        "whiteboard_data": board.whiteboard_data,
        "tasks": tasks_data  # <-- This is the data the frontend needs to load
    }), 200
        
        # This endpoint sends an invitation email
        @app.route('/api/boards/<int:board_id>/invite', methods=['POST'])
        @jwt_required()
        def invite_member(board_id):
            inviter_id = int(get_jwt_identity())
            is_inviter_member = BoardMember.query.filter_by(board_id=board_id, user_id=inviter_id).first()
            if not is_inviter_member:
                return jsonify({"msg": "You are not a member of this board"}), 403
            
            data = request.get_json()
            email = data.get('email')
            if not email:
                return jsonify({"msg": "Email is required"}), 400
            
            # Check if user already exists
            user = User.query.filter_by(email=email).first()
            if not user:
                return jsonify({"msg": "User with this email does not exist."}), 404

            # Check if user is already a member
            if BoardMember.query.filter_by(board_id=board_id, user_id=user.id, status='member').first():
                return jsonify({"msg": "User is already a member."}), 409

            # Generate a unique invite token
            token = serializer.dumps({'board_id': board_id, 'user_id': user.id})
            
            # Create a pending invite in the database
            invite = BoardMember(board_id=board_id, user_id=user.id, invite_token=token, role='member', status='invited')
            db.session.add(invite)
            db.session.commit()
            
            # Send the invitation email (placeholder link)
            invite_url = f"http://localhost:5173/accept-invite/{token}"
            msg = Message("Collabboard Invitation", recipients=[email])
            msg.body = f"Hello {user.username}, you have been invited to a board on Collabboard. Click here to accept: {invite_url}"
            mail.send(msg)
            
            return jsonify({"msg": "Invitation sent successfully."}), 200

        # This endpoint accepts an invitation
        @app.route('/api/invites/<string:token>', methods=['GET'])
        def accept_invite(token):
            try:
                data = serializer.loads(token, max_age=3600) # Token expires in 1 hour
                board_id = data.get('board_id')
                user_id = data.get('user_id')
            except:
                return jsonify({"msg": "The invitation link is invalid or has expired."}), 400
            
            # Find the pending invite in the database
            invite = BoardMember.query.filter_by(board_id=board_id, user_id=user_id, invite_token=token).first()
            
            if not invite:
                return jsonify({"msg": "The invitation link is not valid."}), 400
            
            # Update the status and remove the token
            invite.status = 'member'
            invite.invite_token = None
            db.session.commit()
            
            return jsonify({"msg": "Invitation accepted. You are now a member of the board."}), 200
        
        @app.route('/api/users/search', methods=['GET'])
        @jwt_required()
        def get_users_by_query():
            query = request.args.get('q')
            if not query:
                return jsonify([]), 200
            
            users = User.query.filter((User.username.ilike(f'%{query}%')) | (User.email.ilike(f'%{query}%'))).all()
            
            return jsonify([{"id": user.id, "username": user.username, "email": user.email} for user in users]), 200

        @app.route('/api/boards/<int:board_id>/members', methods=['GET'])
        @jwt_required()
        def get_board_members(board_id):
            user_id = int(get_jwt_identity())
            is_member = BoardMember.query.filter_by(board_id=board_id, user_id=user_id).first()
            if not is_member:
                return jsonify({"msg": "You are not a member of this board"}), 403

            memberships = BoardMember.query.filter_by(board_id=board_id).all()
            members = []
            for member in memberships:
                user = User.query.get(member.user_id)
                if user:
                    members.append({"id": user.id, "username": user.username, "role": member.role})
            return jsonify(members), 200

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
            new_task = Task(board_id=board_id, title=title, description=description, assignee_id=assignee_id, status='to_do')
            db.session.add(new_task)
            db.session.commit()
            return jsonify({"msg": "Task created successfully", "task": {"id": new_task.id, "title": new_task.title, "description": new_task.description, "assignee_id": new_task.assignee_id, "status": new_task.status}}), 201

        @app.route('/api/tasks/<int:task_id>', methods=['PUT'])
        @jwt_required()
        def update_task(task_id):
            user_id = int(get_jwt_identity())
            data = request.get_json()
            task = Task.query.get(task_id)
            if not task:
                return jsonify({"msg": "Task not found"}), 404
            is_member = BoardMember.query.filter_by(board_id=task.board_id, user_id=user_id).first()
            if not is_member:
                return jsonify({"msg": "You are not a member of this board"}), 403
            if 'title' in data:
                task.title = data['title']
            if 'description' in data:
                task.description = data['description']
            if 'assignee_id' in data:
                task.assignee_id = data['assignee_id']
            if 'status' in data:
                task.status = data['status']
            db.session.commit()
            updated_task_data = {
                'id': task.id,
                'title': task.title,
                'description': task.description,
                'assignee_id': task.assignee_id,
                'status': task.status
            }
            socketio.emit('task_update', {'task': updated_task_data, 'board_id': task.board_id}, room=str(task.board_id))
            return jsonify({"msg": "Task updated successfully"}), 200

        @app.route('/api/boards/<int:board_id>/whiteboard', methods=['PUT'])
        @jwt_required()
        def update_whiteboard(board_id):
            user_id = int(get_jwt_identity())
            data = request.get_json()
            whiteboard_state = data.get('whiteboard_state')
            is_member = BoardMember.query.filter_by(board_id=board_id, user_id=user_id).first()
            if not is_member:
                return jsonify({"msg": "You are not a member of this board"}), 403
            board = Board.query.get(board_id)
            if not board:
                return jsonify({"msg": "Board not found"}), 404
            board.whiteboard_data = whiteboard_state
            db.session.commit()
            return jsonify({"msg": "Whiteboard saved successfully"}), 200
        
        @app.route('/api/tasks/<int:task_id>', methods=['DELETE'])
        @jwt_required()
        def delete_task(task_id):
            user_id = int(get_jwt_identity())
            task = Task.query.get(task_id)
    
            if not task:
                return jsonify({"msg": "Task not found"}), 404
    
    # Optional: You might want to check if the user is a board member or owner
            is_member = BoardMember.query.filter_by(board_id=task.board_id, user_id=user_id).first()
            if not is_member:
                return jsonify({"msg": "You do not have permission to delete this task"}), 403

            db.session.delete(task)
            db.session.commit()
    
    # Broadcast deletion event (optional, but good for real-time)
            socketio.emit('task_deleted', {'task_id': task_id, 'board_id': task.board_id}, room=str(task.board_id))

            return jsonify({"msg": "Task deleted successfully"}), 200

        
        @socketio.on('join')
        @jwt_required()
        def on_join(data):
            user_id = int(get_jwt_identity())
            room = data.get('board_id')
            is_member = BoardMember.query.filter_by(board_id=room, user_id=user_id, status='member').first()
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
        
        @socketio.on('chat_message')
        @jwt_required()
        def on_chat_message(data):
            user_id = int(get_jwt_identity())
            room = data.get('board_id')
            message = data.get('message')
            if not all([room, message]):
                return
            
            from models import ChatMessage, User
            
            new_chat_message = ChatMessage(board_id=room, user_id=user_id, message=message)
            db.session.add(new_chat_message)
            db.session.commit()

            user = User.query.get(user_id)
            username = user.username if user else "Guest"
            
            emit('chat_message', {'user_id': user_id, 'username': username, 'message': message, 'timestamp': new_chat_message.timestamp.isoformat()}, room=str(room))

        @socketio.on('task_update')
        @jwt_required()
        def on_task_update(data):
            room = data.get('board_id')
            emit('task_update', data, room=str(room))
            
        @socketio.on('whiteboard_update')
        @jwt_required()
        def on_whiteboard_update(data):
            room = data.get('board_id')
            update_data = data.get('update_data')
            emit('whiteboard_update', update_data, room=str(room), broadcast=True, include_self=False)

        # In app.py (Add this new function)

        
        return app

    except Exception as e:
        print(f"Failed to create app: {e}")
        raise