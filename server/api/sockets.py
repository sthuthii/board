from flask_socketio import emit, join_room, leave_room
from flask_jwt_extended import jwt_required, get_jwt_identity
from extensions import db, socketio
from models import BoardMember, ChatMessage, User

def register_socket_handlers(socketio):

    @socketio.on('join')
    @jwt_required()
    def on_join(data):
        user_id = int(get_jwt_identity())
        room = data.get('board_id')
        # Check if the user is a valid member before allowing them to join the room
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
        
        # Save message to database for persistence
        new_chat_message = ChatMessage(board_id=room, user_id=user_id, message=message)
        db.session.add(new_chat_message)
        db.session.commit()
        
        user = User.query.get(user_id)
        username = user.username if user else "Guest"
        
        emit('chat_message', {
            'user_id': user_id, 
            'username': username, 
            'message': message, 
            'timestamp': new_chat_message.timestamp.isoformat()
        }, room=str(room))

    @socketio.on('task_update')
    @jwt_required()
    def on_task_update(data):
        room = data.get('board_id')
        # Broadcast the task change to everyone else on the board
        emit('task_update', data, room=str(room))

    @socketio.on('whiteboard_update')
    @jwt_required()
    def on_whiteboard_update(data):
        room = data.get('board_id')
        update_data = data.get('update_data')
        # include_self=False prevents the sender from receiving their own drawing data back
        emit('whiteboard_update', update_data, room=str(room), include_self=False)