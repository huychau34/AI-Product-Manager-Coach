// Applies the colour theme before the page draws: the learner's saved choice, otherwise dark.
try { document.documentElement.setAttribute("data-theme", JSON.parse(localStorage.getItem("aipm") || "{}").theme || "dark") }
catch (e) { document.documentElement.setAttribute("data-theme", "dark") }
