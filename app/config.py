import os

class Config:
    SQLALCHEMY_DATABASE_URI = "sqlite:///geofencing.db"  # Use PostgreSQL in production
    SQLALCHEMY_TRACK_MODIFICATIONS = False
    SECRET_KEY = os.urandom(24)
