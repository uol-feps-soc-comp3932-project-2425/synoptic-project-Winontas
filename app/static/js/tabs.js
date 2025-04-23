/**
 * tabs.js: Manages the navigation tab UI, highlighting the active tab based on the current page.
 * Enhances user experience by providing visual feedback for navigation.
 */

// -----------------------------
// Section 1: Tab Management
// -----------------------------
// Handles tab highlighting to reflect the current page.

document.addEventListener("DOMContentLoaded", () => {
    /** Highlights the active navigation tab based on the current URL path. */
    const tabs = document.querySelectorAll(".tab-link");
    const currentPath = window.location.pathname;

    tabs.forEach(tab => {
        const tabPath = tab.getAttribute("href");
        if (currentPath === tabPath) {
            tab.classList.add("bg-blue-600", "text-white");
            tab.classList.remove("text-gray-700", "hover:bg-gray-200");
        } else {
            tab.classList.remove("bg-blue-600", "text-white");
            tab.classList.add("text-gray-700", "hover:bg-gray-200");
        }
    });
});