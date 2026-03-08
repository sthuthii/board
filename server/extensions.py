from flask_sqlalchemy import SQLAlchemy
from flask_migrate import Migrate  # <--- Make sure this is imported
from flask_jwt_extended import JWTManager
from flask_cors import CORS
from flask_socketio import SocketIO
from flask_mail import Mail
from itsdangerous import URLSafeTimedSerializer

db = SQLAlchemy()
migrate = Migrate()  # <--- THIS LINE IS MISSING IN YOUR FILE
jwt = JWTManager()
cors = CORS()
socketio = SocketIO(
    cors_allowed_origins="*",
      async_mode='eventlet'  # Allows React (localhost:3000) to connect
)
mail = Mail()
serializer = URLSafeTimedSerializer("your-super-secret-key-for-invites")