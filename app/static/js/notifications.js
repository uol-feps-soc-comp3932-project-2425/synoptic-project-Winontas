/**
 * notifications.js: Manages the notification interface for sending and scheduling emails.
 * Integrates with the backend to fetch eligible users, send notifications, and generate AI-suggested messages.
 * Provides a preview and logging mechanism for user interactions.
 */

let eligibleUsers = [];

// -----------------------------
// Section 1: Initialisation
// -----------------------------
// Sets up the notifications page with user selection and event listeners.

function initNotifications() {
    /** Initializes the notifications page, loading eligible users and binding controls. */
    console.log("Initialising notifications page...");
    fetch('/api/eligible_users')
        .then(response => {
            if (!response.ok) throw new Error(`Failed to fetch eligible users: ${response.status}`);
            return response.json();
        })
        .then(data => {
            eligibleUsers = data;
            console.log("Eligible users loaded:", eligibleUsers.length);
            populateUserSelect();
        })
        .catch(error => console.error("Error loading eligible users:", error));

    // Bind action buttons and inputs
    document.getElementById("sendNotifications").addEventListener("click", sendNotifications);
    document.getElementById("scheduleNotifications").addEventListener("click", scheduleNotifications);
    document.getElementById("suggestMessage").addEventListener("click", suggestAIMessage);
    document.getElementById("messageTemplate").addEventListener("input", updatePreview);
    document.getElementById("styleInput").addEventListener("input", updatePreview);
    document.getElementById("userSelect").addEventListener("change", updatePreview);
}

// -----------------------------
// Section 2: UI Updates
// -----------------------------
// Manages user selection and message preview updates in the UI.

function populateUserSelect() {
    /** Populates the user selection dropdown with eligible users. */
    const userSelect = document.getElementById("userSelect");
    userSelect.innerHTML = "";
    eligibleUsers.forEach(user => {
        const option = document.createElement("option");
        option.value = user.user_id;
        option.text = `${user.user_name} (ID: ${user.user_id})`;
        userSelect.appendChild(option);
    });
    updatePreview();
}

function updatePreview() {
    /** Updates the message preview based on selected user, template, and style. */
    const userSelect = document.getElementById("userSelect");
    const selectedUserIds = Array.from(userSelect.selectedOptions).map(option => option.value);
    const messageTemplate = document.getElementById("messageTemplate").value;
    const style = document.getElementById("styleInput").value || "neutral";
    const previewDiv = document.getElementById("messagePreview");

    if (selectedUserIds.length === 0 || !messageTemplate) {
        previewDiv.textContent = "Select a user and enter an email template to see a preview.";
        return;
    }

    const sampleUserId = selectedUserIds[0];
    const sampleUser = eligibleUsers.find(u => u.user_id === sampleUserId);
    if (sampleUser) {
        let previewMsg = messageTemplate.replace("{user_name}", sampleUser.user_name);
        if (style.toLowerCase().includes("casual")) {
            previewMsg = `Hey ${sampleUser.user_name}, spotted some cool deals for you!`;
        } else if (style.toLowerCase().includes("discount")) {
            previewMsg = `${sampleUser.user_name}, save big with our exclusive offers!`;
        }
        previewDiv.textContent = previewMsg;
    }
}

// -----------------------------
// Section 3: Notification Actions
// -----------------------------
// Handles sending, scheduling, and suggesting notifications via backend APIs.

function sendNotifications() {
    /** Sends email notifications to selected users with a specified template and style. */
    const userSelect = document.getElementById("userSelect");
    const selectedUserIds = Array.from(userSelect.selectedOptions).map(option => option.value);
    const channels = ["email"];
    const messageTemplate = document.getElementById("messageTemplate").value;
    const style = document.getElementById("styleInput").value || "neutral";

    if (selectedUserIds.length === 0 || !messageTemplate) {
        alert("Please select users and provide an email template.");
        return;
    }

    fetch('/api/send_notifications', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
            user_ids: selectedUserIds,
            channels: channels,
            message_template: messageTemplate,
            style: style
        })
    })
    .then(response => {
        if (!response.ok) {
            return response.json().then(err => { throw new Error(`Failed to send emails: ${response.status} - ${err.error || 'Unknown error'}`); });
        }
        return response.json();
    })
    .then(data => {
        console.log("Emails sent:", data.sent_notifications);
        displayNotificationLog(data.sent_notifications);
    })
    .catch(error => {
        console.error("Error sending emails:", error);
        alert(`Error: ${error.message}`);
    });
}

function scheduleNotifications() {
    /** Schedules email notifications for selected users based on their patterns. */
    const userSelect = document.getElementById("userSelect");
    const selectedUserIds = Array.from(userSelect.selectedOptions).map(option => option.value);
    const channels = ["email"];
    const messageTemplate = document.getElementById("messageTemplate").value;
    const style = document.getElementById("styleInput").value || "neutral";

    if (selectedUserIds.length === 0 || !messageTemplate) {
        alert("Please select users and provide an email template.");
        return;
    }

    fetch('/api/schedule_notifications', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
            user_ids: selectedUserIds,
            channels: channels,
            message_template: messageTemplate,
            style: style
        })
    })
    .then(response => {
        if (!response.ok) {
            return response.json().then(err => { throw new Error(`Failed to schedule emails: ${response.status} - ${err.error || 'Unknown error'}`); });
        }
        return response.json();
    })
    .then(data => {
        console.log("Emails scheduled:", data.scheduled_times);
        displayScheduledTimes(data.scheduled_times);
        alert("Emails scheduled successfully!");
    })
    .catch(error => {
        console.error("Error scheduling emails:", error);
        alert(`Error: ${error.message}`);
    });
}

function suggestAIMessage() {
    /** Generates an AI-suggested email message for selected users using the backend. */
    const userSelect = document.getElementById("userSelect");
    const selectedUserIds = Array.from(userSelect.selectedOptions).map(option => option.value);
    const style = document.getElementById("styleInput").value || "neutral";

    if (selectedUserIds.length === 0) {
        alert("Please select at least one user to generate a suggestion.");
        return;
    }

    fetch('/api/suggest_message', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
            user_ids: selectedUserIds,
            style: style
        })
    })
    .then(response => {
        if (!response.ok) {
            return response.json().then(err => {
                let message = `Failed to suggest email: ${response.status} - ${err.error || 'Unknown error'}`;
                if (response.status === 429) {
                    message = "Gemini API rate limit reached. Please wait and try again.";
                } else if (response.status === 401) {
                    message = "Invalid Gemini API key. Check your configuration.";
                }
                throw new Error(message);
            });
        }
        return response.json();
    })
    .then(data => {
        document.getElementById("messageTemplate").value = data.suggestion;
        document.getElementById("scheduledTimes").textContent = data.scheduled_times.map(t => `${t.user_name}: ${t.time}`).join("; ") || "No scheduled times available.";
        updatePreview();
        console.log("AI suggested email:", data.suggestion, "Scheduled times:", data.scheduled_times);
    })
    .catch(error => {
        console.error("Error suggesting email:", error);
        alert(`Error: ${error.message}`);
    });
}

// -----------------------------
// Section 4: UI Feedback
// -----------------------------
// Displays notification logs and scheduled times to provide user feedback.

function displayScheduledTimes(scheduled_times) {
    /** Displays scheduled notification times in the UI. */
    const timesDiv = document.getElementById("scheduledTimes");
    if (scheduled_times.length === 0) {
        timesDiv.textContent = "No scheduled times available.";
        return;
    }
    timesDiv.textContent = scheduled_times.map(t => `${t.user_name}: ${t.time}`).join("; ");
}

function displayNotificationLog(notifications) {
    /** Displays a log of sent notifications with their status. */
    const logDiv = document.getElementById("notificationLog");
    logDiv.innerHTML = "";
    notifications.forEach(notif => {
        const div = document.createElement("div");
        div.className = `p-2 rounded-md text-sm ${notif.status === 'Delivered' ? 'bg-green-50 text-green-800' : 'bg-red-50 text-red-800'}`;
        div.textContent = `${notif.user_name} via email: "${notif.message}" at ${notif.timestamp} (${notif.status})`;
        logDiv.appendChild(div);
    });
}

window.onload = initNotifications;