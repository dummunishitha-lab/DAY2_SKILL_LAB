"use strict";
/* TaskForge: Student Task Manager
   Concepts used: variables, objects, arrays, conditions, loops, functions,
   array methods (filter / find / findIndex / splice / sort / map / forEach),
   DOM manipulation, events, JSON and Local Storage. */

// ---------- Constants and state ----------
const KEY = "taskforge.tasks";
const PREFS = "taskforge.prefs";
const CIRC = 2 * Math.PI * 44; // gauge circumference
const WEIGHT = { high: 3, medium: 2, low: 1 };
const CATS = ["Coding", "Maths", "Lab", "Project", "Exam"];
const ICONS = { all: "▦", Coding: "</>", Maths: "∑", Lab: "⚗", Project: "⚙", Exam: "✎" };
const QUOTES = [
  "Measure twice, cut once.",
  "Every bug fixed is a lesson logged.",
  "Small commits, steady progress.",
  "Good engineers plan. Great engineers also ship.",
  "Debug the problem, not the person.",
  "Done is a feature. Verified is a milestone."
];

const $ = id => document.getElementById(id);
const today = () => new Date().toLocaleDateString("en-CA"); // YYYY-MM-DD in local time

let ui = { filter: "all", cat: "all", query: "", sort: "newest", editId: null, flashId: null };
let lastDeleted = null;
let toastTimer = null;

// ---------- Local Storage + JSON ----------
function load(key, fallback) {
  try {
    const raw = localStorage.getItem(key);
    return raw === null ? fallback : JSON.parse(raw);
  } catch (err) {
    return fallback;
  }
}
function save() {
  localStorage.setItem(KEY, JSON.stringify(tasks));
}
function savePrefs() {
  localStorage.setItem(PREFS, JSON.stringify(prefs));
}

function daysFromNow(n) {
  const d = new Date();
  d.setDate(d.getDate() + n);
  return d.toLocaleDateString("en-CA");
}
function makeTask(title, category, priority, due, done = false) {
  return { id: Date.now().toString(36) + Math.random().toString(36).slice(2, 6), title, category, priority, due, done, created: Date.now() };
}

// First visit only: starter tasks so the dashboard is not empty
const starter = [
  makeTask("Finish JavaScript Phase 1 project", "Project", "high", daysFromNow(2)),
  makeTask("Solve Unit 3 integration problems", "Maths", "medium", daysFromNow(4)),
  makeTask("Write Experiment 8 lab record", "Lab", "medium", daysFromNow(-1)),
  makeTask("Practise array methods in the console", "Coding", "low", "", true)
];
let tasks = load(KEY, starter);
let prefs = load(PREFS, { theme: "dark", name: "Student" });

// ---------- Helpers ----------
function visibleTasks() {
  const list = tasks.filter(t => {
    const byStatus = ui.filter === "all" || (ui.filter === "pending" && !t.done) || (ui.filter === "completed" && t.done);
    const byCat = ui.cat === "all" || t.category === ui.cat;
    const byText = t.title.toLowerCase().includes(ui.query);
    return byStatus && byCat && byText;
  });
  list.sort((a, b) => {
    if (ui.sort === "priority") return WEIGHT[b.priority] - WEIGHT[a.priority];
    if (ui.sort === "due") return (a.due || "9999") > (b.due || "9999") ? 1 : -1;
    return b.created - a.created;
  });
  return list;
}

function dueInfo(t) {
  if (!t.due) return { text: "No due date", cls: "" };
  const nice = new Date(t.due + "T00:00").toLocaleDateString("en-GB", { day: "numeric", month: "short" });
  if (t.done) return { text: "Due " + nice, cls: "" };
  const days = Math.round((new Date(t.due + "T00:00") - new Date(today() + "T00:00")) / 864e5);
  if (days < 0) return { text: `Overdue by ${-days}d`, cls: "late" };
  if (days === 0) return { text: "Due today", cls: "soon" };
  if (days === 1) return { text: "Due tomorrow", cls: "soon" };
  return { text: `Due ${nice} (${days} days)`, cls: days <= 3 ? "soon" : "" };
}

function statusMessage(total, done, late, pct) {
  if (total === 0) return "Workbench is clear. Add your first task below.";
  if (pct === 100) return "All tasks verified. Systems green.";
  if (late > 0) return `${late} overdue ${late === 1 ? "task needs" : "tasks need"} attention first.`;
  if (pct >= 50) return "Past the halfway mark. Keep the momentum.";
  return `${total - done} to go. Start with the highest priority.`;
}

// ---------- Rendering ----------
function createTaskEl(t) {
  const li = document.createElement("li");
  li.className = `task p-${t.priority}` + (t.done ? " done" : "") + (t.id === ui.flashId ? " just" : "");
  li.dataset.id = t.id;
  const due = dueInfo(t);

  const chk = document.createElement("button");
  chk.className = "chk"; chk.dataset.act = "toggle";
  chk.setAttribute("aria-label", t.done ? "Mark as pending" : "Mark as completed");

  const body = document.createElement("div");
  body.className = "body";
  const h3 = document.createElement("h3");
  h3.textContent = t.title; // textContent keeps user input safe
  const meta = document.createElement("div");
  meta.className = "meta";
  [[ICONS[t.category] + " " + t.category, ""], [t.priority, "pri"], [due.text, due.cls]].forEach(([text, cls]) => {
    const s = document.createElement("span");
    s.textContent = text; s.className = cls;
    meta.appendChild(s);
  });
  body.append(h3, meta);

  const acts = document.createElement("div");
  acts.className = "acts";
  [["edit", "✎", "Edit task"], ["del", "✕", "Delete task"]].forEach(([act, icon, label]) => {
    const b = document.createElement("button");
    b.dataset.act = act; b.textContent = icon; b.title = label; b.setAttribute("aria-label", label);
    acts.appendChild(b);
  });

  const stamp = document.createElement("span");
  stamp.className = "stamp"; stamp.textContent = "VERIFIED";

  li.append(chk, body, acts, stamp);
  return li;
}

function render() {
  const list = visibleTasks();
  const ul = $("taskList");
  ul.innerHTML = "";
  list.forEach((t, i) => {
    const el = createTaskEl(t);
    el.style.animationDelay = Math.min(i * 40, 300) + "ms";
    ul.appendChild(el);
  });
  ui.flashId = null;

  const empty = $("empty");
  empty.hidden = list.length > 0;
  if (!list.length) {
    const filtering = tasks.length > 0;
    empty.innerHTML = `<b>${filtering ? "No matching tasks" : "Nothing on the board yet"}</b>${filtering ? "Try a different search or filter." : "Add a task above to get started."}`;
  }
  $("shown").textContent = `${list.length} of ${tasks.length} shown`;
  renderStats();
  renderNav();
}

function renderStats() {
  const total = tasks.length;
  const done = tasks.filter(t => t.done).length;
  const late = tasks.filter(t => !t.done && t.due && t.due < today()).length;
  const pct = total ? Math.round((done / total) * 100) : 0;
  $("sTotal").textContent = total;
  $("sPending").textContent = total - done;
  $("sDone").textContent = done;
  $("sLate").textContent = late;
  $("sLate").parentElement.classList.toggle("hot", late > 0);
  $("pct").textContent = pct + "%";
  $("ring").style.strokeDashoffset = CIRC * (1 - pct / 100);
  $("status").textContent = statusMessage(total, done, late, pct);
}

function renderNav() {
  $("cAll").textContent = tasks.length;
  $("cPending").textContent = tasks.filter(t => !t.done).length;
  $("cDone").textContent = tasks.filter(t => t.done).length;
  document.querySelectorAll("[data-filter]").forEach(b => b.classList.toggle("active", b.dataset.filter === ui.filter));

  const nav = $("catNav");
  nav.innerHTML = "";
  ["all", ...CATS].forEach(name => {
    let n = 0;
    for (const t of tasks) if (name === "all" || t.category === name) n++; // loop: count per subject
    const b = document.createElement("button");
    b.className = "nav" + (ui.cat === name ? " active" : "");
    b.dataset.cat = name;
    b.innerHTML = `<span>${ICONS[name]} ${name === "all" ? "All subjects" : name}</span><span class="count">${n}</span>`;
    nav.appendChild(b);
  });
}

// ---------- Actions ----------
function showToast(msg, undo) {
  const t = $("toast");
  t.innerHTML = "";
  t.append(document.createTextNode(msg));
  if (undo) {
    const b = document.createElement("button");
    b.textContent = "Undo";
    b.addEventListener("click", () => { undo(); t.classList.remove("show"); });
    t.appendChild(b);
  }
  t.classList.add("show");
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => t.classList.remove("show"), 5000);
}

function formError(msg) {
  $("formError").textContent = msg;
  if (msg) {
    $("taskForm").classList.remove("shake");
    void $("taskForm").offsetWidth; // restart animation
    $("taskForm").classList.add("shake");
  }
}

function resetForm() {
  ui.editId = null;
  $("taskForm").reset();
  $("taskForm").classList.remove("editing");
  $("saveBtn").textContent = "Add task";
  $("cancelBtn").hidden = true;
  formError("");
}

function startEdit(id) {
  const t = tasks.find(x => x.id === id);
  if (!t) return;
  ui.editId = id;
  $("title").value = t.title;
  $("category").value = t.category;
  $("priority").value = t.priority;
  $("due").value = t.due;
  $("taskForm").classList.add("editing");
  $("saveBtn").textContent = "Save changes";
  $("cancelBtn").hidden = false;
  $("taskForm").scrollIntoView({ block: "center" });
  $("title").focus();
}

function deleteTask(id, li) {
  const index = tasks.findIndex(t => t.id === id);
  if (index === -1) return;
  li.classList.add("leaving");
  setTimeout(() => {
    lastDeleted = { task: tasks[index], index };
    tasks.splice(index, 1);
    if (ui.editId === id) resetForm();
    save(); render();
    showToast("Task deleted.", () => {
      tasks.splice(lastDeleted.index, 0, lastDeleted.task);
      save(); render();
    });
  }, 250);
}

// ---------- Events ----------
$("taskForm").addEventListener("submit", e => {
  e.preventDefault();
  const title = $("title").value.trim();
  if (title.length < 3) return formError("Task name needs at least 3 characters.");
  if (!/[a-z0-9]/i.test(title)) return formError("Task name must contain letters or numbers.");

  const data = { title, category: $("category").value, priority: $("priority").value, due: $("due").value };
  if (ui.editId) {
    const t = tasks.find(x => x.id === ui.editId);
    Object.assign(t, data);
    showToast("Task updated.");
  } else {
    tasks.push(makeTask(data.title, data.category, data.priority, data.due));
    showToast("Task added.");
  }
  save(); resetForm(); render();
});
$("cancelBtn").addEventListener("click", resetForm);
$("title").addEventListener("input", () => { if ($("title").value.trim().length >= 3) formError(""); });

$("taskList").addEventListener("click", e => {
  const btn = e.target.closest("button");
  const li = e.target.closest(".task");
  if (!btn || !li) return;
  const id = li.dataset.id;
  if (btn.dataset.act === "toggle") {
    const t = tasks.find(x => x.id === id);
    t.done = !t.done;
    ui.flashId = t.done ? id : null;
    save(); render();
  } else if (btn.dataset.act === "edit") startEdit(id);
  else if (btn.dataset.act === "del") deleteTask(id, li);
});

document.querySelector(".side").addEventListener("click", e => {
  const b = e.target.closest(".nav");
  if (!b) return;
  if (b.dataset.filter) ui.filter = b.dataset.filter;
  if (b.dataset.cat) ui.cat = b.dataset.cat;
  render();
});

$("search").addEventListener("input", e => { ui.query = e.target.value.trim().toLowerCase(); render(); });
$("sort").addEventListener("change", e => { ui.sort = e.target.value; render(); });

$("clearDone").addEventListener("click", () => {
  const removed = tasks.filter(t => t.done);
  if (!removed.length) return showToast("No completed tasks to clear.");
  tasks = tasks.filter(t => !t.done);
  save(); render();
  showToast(`${removed.length} completed ${removed.length === 1 ? "task" : "tasks"} cleared.`, () => {
    tasks = tasks.concat(removed);
    save(); render();
  });
});

// Theme, profile and personal touches
function applyTheme() {
  document.documentElement.dataset.theme = prefs.theme;
  $("themeBtn").textContent = prefs.theme === "dark" ? "Switch to drafting paper" : "Switch to blueprint";
}
$("themeBtn").addEventListener("click", () => {
  prefs.theme = prefs.theme === "dark" ? "light" : "dark";
  savePrefs(); applyTheme();
});
$("userName").addEventListener("input", e => {
  prefs.name = e.target.value;
  $("avatar").textContent = (prefs.name.trim()[0] || "S").toUpperCase();
  savePrefs();
});

document.addEventListener("keydown", e => {
  const typing = ["INPUT", "SELECT"].includes(document.activeElement.tagName);
  if (e.key === "/" && !typing) { e.preventDefault(); $("search").focus(); }
  if (e.key === "Escape" && ui.editId) resetForm();
});
document.addEventListener("pointermove", e => {
  document.body.style.setProperty("--mx", e.clientX + "px");
  document.body.style.setProperty("--my", e.clientY + "px");
});

// ---------- Clock + rotating quote ----------
function tick() {
  const now = new Date();
  $("clock").textContent = now.toLocaleTimeString("en-GB", { hour: "2-digit", minute: "2-digit", second: "2-digit" });
  $("date").textContent = now.toLocaleDateString("en-GB", { weekday: "short", day: "numeric", month: "short" });
}
let q = Math.floor(Math.random() * QUOTES.length);
function nextQuote() {
  const el = $("quote");
  el.classList.add("fade");
  setTimeout(() => { el.textContent = QUOTES[q++ % QUOTES.length]; el.classList.remove("fade"); }, 500);
}

// ---------- Init ----------
$("category").innerHTML = CATS.map(c => `<option value="${c}">${ICONS[c]} ${c}</option>`).join("");
$("userName").value = prefs.name;
$("avatar").textContent = (prefs.name.trim()[0] || "S").toUpperCase();
applyTheme();
tick(); setInterval(tick, 1000);
nextQuote(); setInterval(nextQuote, 10000);
if (localStorage.getItem(KEY) === null) save(); // persist the starter tasks once
// Render the list at 0% first so the gauge animates in on load
render();
$("ring").style.strokeDashoffset = CIRC;
requestAnimationFrame(() => requestAnimationFrame(renderStats));
