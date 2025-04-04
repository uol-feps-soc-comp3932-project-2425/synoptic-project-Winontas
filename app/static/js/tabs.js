document.addEventListener("DOMContentLoaded", () => {
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