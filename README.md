## Overview

The **Geofencing Personalised Marketing System** is a Flask-based web application designed to create, manage, and analyse geofences for targeted marketing notifications.  
Users can define geofences on a map, simulate user movements, detect behavioural patterns, and send personalised email notifications based on high-confidence behavioural patterns.  
The system integrates Google Maps and Places APIs for visualisation and competitor analysis, and Chart.js for pattern visualisation.

---

## Key Features

- **Geofence Management:** Create, edit, toggle, and delete geofences by business category.
- **Competitor Visualisation:** Display competitor locations via Google Places API to optimise geofence placement.
- **Simulation:** Generate realistic user movements to test pattern recognition.
- **Pattern Recognition:** Analyse visit patterns (day/time) and confidence levels using Chart.js.
- **Notifications:** Send or schedule personalised emails for users with high-confidence patterns (≥ 80%).
- **Interactive Dashboard:** User-friendly interface with navigation, map views, and dynamic controls.

---

## Prerequisites

- Python 3.8+
- Flask 3.1.0
- SQLite (via SQLAlchemy)
- Google Maps API Key (Maps, Places, Drawing libraries enabled)
- Node.js (optional, for frontend testing)
- Git

---

## Installation

1. **Clone the Repository:**

```bash
git clone <repository-url>
cd <repository-folder>
```

2. **Set Up a Virtual Environment:**

```bash
python -m venv venv
source venv/bin/activate   # Windows: venv\Scripts\activate
```

3. **Install Dependencies:**

```bash
pip install -r requirements.txt
```

4. **Configure Environment Variables:**

Create a `.env` file in the project root with:

```bash
GOOGLE_API_KEY=your-google-api-key
SENDGRID_API_KEY=your-sendgrid-api-key
SENDER_EMAIL=your-sender-email
```

5. **Initialise Database:**

```bash
flask db init
flask db migrate
flask db upgrade
```

This sets up the SQLite database with tables defined in `models.py` (Geofence, Tracking).

---

## File Descriptions

- **`routes.py`** — Flask routes for geofence management, simulation, pattern detection, and notifications.
- **`models.py`** — Database models for Geofence and Tracking tables.
- **`map.js`** — Google Maps interface for geofence creation and competitor visualisation.
- **`simulation.js`** — Renders simulated user movements.
- **`patterns.js`** — Analyses and visualises user behaviour patterns.
- **`notifications.js`** — Manages email notification setup, AI suggestions, and sending.
- **`tabs.js`** — Handles dashboard tab navigation highlighting.
- **HTML Templates:**
  - `dashboard.html` — Manage geofences.
  - `simulate.html` — Configure and visualise user simulations.
  - `patterns.html` — Filter and view user pattern data.
  - `notification.html` — Send and schedule notifications.

---

## Usage

1. **Run the Application:**

```bash
flask run
```

2. **Access the Dashboard:**

Visit `http://127.0.0.1:5000/dashboard`.

3. **Navigate the Interface:**
- **Geofencing Dashboard:** Draw and manage geofences.
- **Simulation Dashboard:** Configure and view simulations.
- **Pattern Recognition:** Filter and view visit pattern charts.
- **Notifications:** Send/schedule AI-enhanced emails.

---

## API Endpoints

- `GET /geofences` — List all geofences.
- `POST /geofences` — Create a new geofence.
- `PUT /geofences/<id>` — Update an existing geofence.
- `DELETE /geofences/<id>` — Delete a geofence.
- `PUT /geofences/<id>/toggle` — Activate or deactivate a geofence.
- `POST /api/run_simulation` — Run user simulation.
- `GET /api/run_simulation_results` — Get simulation results.
- `GET /api/patterns` — Get recognised patterns.
- `GET /api/eligible_users` — List users eligible for notifications.
- `POST /api/send_notifications` — Send notification emails.
- `POST /api/schedule_notifications` — Schedule notifications.
- `POST /api/suggest_message` — Generate AI-suggested messages.

---

## Testing

> It is recommended to perform testing on a separate branch to protect the main branch and maintain database integrity.

Run backend tests with:

```bash
pytest -v tests/
```

---

## Development Notes

- **Documentation:** Python, JavaScript, and HTML files are annotated with docstrings, JSDoc comments, and inline explanations.
- **Best Practice:** Follow modular and scalable coding standards for future feature additions.

---

## Future Improvements

- Support multi-channel notifications (SMS, push notifications).
- Integrate real-time user data collection.
- Optimise database schema for scalability.

---

## Contact

**William Tsinontas** — [ed20wt@leeds.ac.uk](mailto:ed20wt@leeds.ac.uk)

