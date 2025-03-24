from app import db

class Geofence(db.Model):
    __tablename__ = 'geofences'
    id = db.Column(db.Integer, primary_key=True)
    business_type = db.Column(db.String(50), nullable=False)
    name = db.Column(db.String(100), nullable=False)
    coordinates = db.Column(db.Text, nullable=False)
    active = db.Column(db.Boolean, default=False)

class Tracking(db.Model):
    __tablename__ = 'tracking'
    id = db.Column(db.Integer, primary_key=True)
    user_id = db.Column(db.Integer, nullable=False)
    user_name = db.Column(db.String(100), nullable=False)
    geofence_id = db.Column(db.Integer, db.ForeignKey('geofences.id'), nullable=False)
    geofence_name = db.Column(db.String(100), nullable=False)
    event_type = db.Column(db.String(20), nullable=False)
    timestamp = db.Column(db.DateTime, nullable=False)  # Use DateTime for easier querying
    duration = db.Column(db.Float, nullable=True)  # Duration in minutes