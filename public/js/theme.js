// Applies the colour theme before the page draws: the learner's saved choice, otherwise dark.
(function () {
  let t = "dark";
  try { t = (JSON.parse(localStorage.getItem("aipm") || "null") || JSON.parse(localStorage.getItem("aipm_prefs") || "null") || {}).theme || "dark" } catch (e) { }
  document.documentElement.setAttribute("data-theme", t);
})();
