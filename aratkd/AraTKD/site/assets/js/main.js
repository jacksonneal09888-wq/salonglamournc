const navToggle = document.querySelector(".nav-toggle");
const navList = document.querySelector(".main-nav ul");
const yearTarget = document.getElementById("year");

if (navToggle && navList) {
    navToggle.addEventListener("click", () => {
        const expanded = navToggle.getAttribute("aria-expanded") === "true";
        navToggle.setAttribute("aria-expanded", String(!expanded));
        navList.classList.toggle("active");
    });
}

if (yearTarget) {
    yearTarget.textContent = String(new Date().getFullYear());
}
