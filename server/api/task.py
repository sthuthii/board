from flask import Blueprint, request, jsonify
from flask_jwt_extended import jwt_required, get_jwt_identity
from extensions import db, socketio
from models import Task, BoardMember

tasks_bp = Blueprint('task', __name__)

# NOTE: Task creation is usually tied to a board ID
# If registered with url_prefix='/api/tasks', this becomes POST /api/tasks/board/<id>
@tasks_bp.route('/board/<int:board_id>', methods=['POST'])
@jwt_required()
def create_task(board_id):
    user_id = int(get_jwt_identity())
    data = request.get_json()
    
    title = data.get('title')
    description = data.get('description', None)
    assignee_id = data.get('assignee_id', None)
    
    if not title:
        return jsonify({"msg": "Task title is required"}), 400
        
    # Check if the user has permission to add tasks to this board
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
        "task": {
            "id": new_task.id, 
            "title": new_task.title, 
            "description": new_task.description, 
            "assignee_id": new_task.assignee_id, 
            "status": new_task.status,
            "board_id": new_task.board_id
        }
    }), 201

# PUT /api/tasks/<task_id>
@tasks_bp.route('/<int:task_id>', methods=['PUT'])
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
        'status': task.status,
        'board_id': task.board_id
    }
    
    # Broadcast to the board's room
    socketio.emit('task_update', {'task': updated_task_data, 'board_id': task.board_id}, room=str(task.board_id))
    
    return jsonify({"msg": "Task updated successfully", "task": updated_task_data}), 200

# DELETE /api/tasks/<task_id>
@tasks_bp.route('/<int:task_id>', methods=['DELETE'])
@jwt_required()
def delete_task(task_id):
    user_id = int(get_jwt_identity())
    task = Task.query.get(task_id)
    
    if not task:
        return jsonify({"msg": "Task not found"}), 404
    
    is_member = BoardMember.query.filter_by(board_id=task.board_id, user_id=user_id).first()
    if not is_member:
        return jsonify({"msg": "You do not have permission to delete this task"}), 403
        
    board_id = task.board_id # Store for the socket emit
    db.session.delete(task)
    db.session.commit()
    
    # Broadcast deletion event
    socketio.emit('task_deleted', {'task_id': task_id, 'board_id': board_id}, room=str(board_id))
    
    return jsonify({"msg": "Task deleted successfully"}), 200