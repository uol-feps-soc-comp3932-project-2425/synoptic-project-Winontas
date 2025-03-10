from app import db

class Geofence(db.Model):
    id = db.Column(db.Integer, primary_key=True)
    business_type = db.Column(db.String(50), nullable=False)
    name = db.Column(db.String(100), nullable=False)
    coordinates = db.Column(db.Text, nullable=False)  # Store polygon as JSON
    active = db.Column(db.Boolean, default=False)
