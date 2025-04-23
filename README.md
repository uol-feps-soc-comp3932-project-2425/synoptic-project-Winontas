[![Review Assignment Due Date](https://classroom.github.com/assets/deadline-readme-button-22041afd0340ce965d47ae6ef1cefeee28c7c493a6346c4f15d667ab976d596c.svg)](https://classroom.github.com/a/zqYhAx1c)

Geofencing Personalised Marketing System
Overview
The Geofencing Personalised Marketing System is a Flask-based web application designed to create, manage, and analyse geofences for targeted marketing notifications. Users can define geofences on a map, simulate user movements, detect behavioural patterns, and send personalised email notifications based on those high-confidence behavioural patterns. The system integrates Google Maps and Places APIs for visualisation and competitor analysis, and Chart.js for pattern visualisation.

Key Features
Geofence Management: Create, edit, toggle, and delete geofences for business categories.

Competitor Visualisation: Display competitor locations via Google Places API to optimise geofence placement.

Simulation: Generate realisitc user movements to test pattern recognition.

Pattern Recognition: Analyse visit patterns (by day/time) and pattern confidence with Chart.js bar charts.

Notifications: Send or schedule personalised emails for users with high-confidence patterns (≥80%).

Interactive Dashboard: User-friendly interface with navigation, map views, and dynamic controls.

Prerequisites
Python 3.8+

Flask 3.1.0

SQLite (via SQLAlchemy)

Google Maps API Key (Maps, Places, Drawing libraries enabled)

Node.js (optional, for frontend testing)

Git

Installation
Clone the Repository

Set Up a Virtual Environment:
bash
python -m venv venv
source venv/bin/activate  # Windows: venv\Scripts\activate

Install Dependencies:
Use the provided requirements.txt.
bash
pip install -r requirements.txt

Configure Environment:
Create a .env file in the project root:
GOOGLE_API_KEY=your-google-api-key
SENDGRID_API_KEY=your-sendgrid-api-key
SENDER_EMAIL=your-sender-email

Initialise Database:
bash

flask db init
flask db migrate
flask db upgrade

This creates the SQLite database with tables defined in models.py (Geofence, Tracking).

File Descriptions
routes.py: Defines Flask routes for managing geofences, running simulations, detecting patterns, and sending notifications. Uses SQLAlchemy for database operations.

models.py: Defines Geofence (id, business_type, name, coordinates, active) and Tracking (id, user_id, user_name, geofence_id, geofence_name, event_type, timestamp, duration, simulated_hour) tables.

map.js: Manages Google Maps interface for drawing geofences and visualising competitors (dashboard.html).

simulation.js: Renders simulated user movements on a map (simulate.html).

patterns.js: Analyses and visualises user behaviour patterns (patterns.html).

notifications.js: Handles email notification configuration, AI suggestions, and delivery (notification.html).

tabs.js: Highlights active navigation tabs.

dashboard.html: Interface for creating and managing geofences.

simulate.html: Interface for configuring and visualising simulations.

patterns.html: Interface for filtering and visualising pattern data.

notification.html: Interface for sending and scheduling notifications.

Usage
Run Application:
bash

flask run

Visit the url provided with the endpoint /dashboard.

Navigate Dashboard:
Geofencing Dashboard: Draw and manage geofences by business type.

Simulation Dashboard: Configure and visualise user simulations.

Pattern Recognition: Filter and view visit pattern charts.

Notifications: Send/schedule emails with AI suggestions.

API Endpoints:
GET /geofences: List geofences.

POST /geofences: Create geofence.

PUT /geofences/<id>: Update geofence.

DELETE /geofences/<id>: Delete geofence.

PUT /geofences/<id>/toggle: Toggle geofence status.

POST /api/run_simulation: Run simulation.

GET /api/run_simulation_results: Get simulation results.

GET /api/patterns: Get patterns.

GET /api/eligible_users: Get eligible users.

POST /api/send_notifications: Send notifications.

POST /api/schedule_notifications: Schedule notifications.

POST /api/suggest_message: AI message suggestion.

Testing
It is reccomended to perform testing in it's own branch and not on main to maintain database integrity
Run backend tests:
bash

pytest -v tests/

Development Notes
Documentation: Python, JavaScript, and HTML files are annotated with docstrings, JSDoc, and inline comments.

Future Improvements

Support multi-channel notifications (SMS, push).

Integrate real user data.

Optimise database for scalability.


Contact
[William Tsinontas] ([ed20wt@leeds.ac.uk])

