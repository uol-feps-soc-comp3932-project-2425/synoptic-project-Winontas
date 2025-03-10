from flask import Flask
from flask_sqlalchemy import SQLAlchemy
from flask_cors import CORS

db = SQLAlchemy()

def create_app():
    app = Flask(__name__, template_folder="templates")
    CORS(app)
    app.config.from_object("app.config.Config")

    db.init_app(app)

    from app.routes import geofence_bp
    app.register_blueprint(geofence_bp)

    return app
