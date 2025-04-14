import pytest
from app import create_app, db
from flask.testing import FlaskClient

@pytest.fixture
def app():
    """Create and configure a test Flask app."""
    app = create_app()
    app.config['TESTING'] = True
    app.config['SQLALCHEMY_DATABASE_URI'] = 'sqlite:///:memory:'
    app.config['SQLALCHEMY_TRACK_MODIFICATIONS'] = False
    return app

@pytest.fixture
def client(app):
    """Provide a test client for HTTP requests."""
    with app.app_context():  # Ensure app context for entire fixture
        db.create_all()
        with app.test_client() as client:
            yield client
        db.drop_all()

@pytest.fixture
def init_database(app):
    """Initialise and tear down the database."""
    with app.app_context():
        db.create_all()
        yield
        db.session.remove()  # Explicitly clean up session
        db.drop_all()