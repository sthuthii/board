from flask import Blueprint, request, jsonify
from flask_jwt_extended import jwt_required, get_jwt_identity
from flask_mail import Message
from extensions import db, mail, serializer
from models import Board, BoardMember, User, Task

boards_bp = Blueprint('boards', __name__)

# Note: The url_prefix='/api/boards' is handled in app.py registration

@boards_bp.route('', methods=['POST'])
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
    db.session.flush() # Gets the board ID before commit
    
    # Add owner as first member
    owner_member = BoardMember(board_id=new_board.id, user_id=user_id, role='owner', status='member')
    db.session.add(owner_member)
    
    # Add other initial members if any
    for member_id in member_ids:
        if User.query.get(member_id):
            new_member = BoardMember(board_id=new_board.id, user_id=member_id, role='member', status='member')
            db.session.add(new_member)
            
    db.session.commit()
    return jsonify({"msg": "Board created successfully", "board_id": new_board.id, "board_name": new_board.name}), 201


@boards_bp.route('', methods=['GET'])
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


@boards_bp.route('/<int:board_id>', methods=['GET'])
@jwt_required()
def get_board(board_id):
    user_id = int(get_jwt_identity())
    
    is_member = BoardMember.query.filter_by(board_id=board_id, user_id=user_id).first()
    if not is_member:
        return jsonify({"msg": "You are not a member of this board"}), 403
        
    board = Board.query.get(board_id)
    if not board:
        return jsonify({"msg": "Board not found"}), 404

    tasks_data = []
    # Assumes tasks_rel is defined in your Board model
    for task in board.tasks_rel.all():
        tasks_data.append({
            "id": task.id,
            "title": task.title,
            "description": task.description,
            "assignee_id": task.assignee_id,
            "status": task.status,
            "board_id": task.board_id
        })

    return jsonify({
        "id": board.id,
        "name": board.name,
        "owner_id": board.owner_id,
        "whiteboard_data": board.whiteboard_data,
        "tasks": tasks_data 
    }), 200


@boards_bp.route('/<int:board_id>/members', methods=['GET'])
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


@boards_bp.route('/<int:board_id>/invite', methods=['POST'])
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
            
    user = User.query.filter_by(email=email).first()
    if not user:
        return jsonify({"msg": "User with this email does not exist."}), 404

    if BoardMember.query.filter_by(board_id=board_id, user_id=user.id, status='member').first():
        return jsonify({"msg": "User is already a member."}), 409

    token = serializer.dumps({'board_id': board_id, 'user_id': user.id})
    
    invite = BoardMember(board_id=board_id, user_id=user.id, invite_token=token, role='member', status='invited')
    db.session.add(invite)
    db.session.commit()
            
    invite_url = f"http://localhost:5173/accept-invite/{token}"
    msg = Message("Collabboard Invitation", recipients=[email])
    msg.body = f"Hello {user.username}, you have been invited to a board on Collabboard. Click here to accept: {invite_url}"
    
    # mail.send(msg) # Uncomment when ready to send real emails
            
    return jsonify({"msg": "Invitation sent successfully."}), 200


@boards_bp.route('/<int:board_id>/whiteboard', methods=['PUT'])
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