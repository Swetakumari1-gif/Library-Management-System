const API = "http://localhost:5000";

// Apply saved theme
if (localStorage.getItem("theme") === "light") {
    document.body.classList.add("light");
}

const user = JSON.parse(sessionStorage.getItem("user"));

if (!user) window.location = "login.html";
if (!user.role) user.role = "admin";
if (user.role !== "admin") window.location = "student.html";

// 🔔 TOAST
function toast(msg) {
    const t = document.createElement("div");
    t.className = "toast";
    t.innerText = msg;
    document.body.appendChild(t);
    setTimeout(() => t.remove(), 2000);
}

// 🚪 LOGOUT
function logout() {
    sessionStorage.removeItem("user");
    window.location = "login.html";
}

// 🌙 DARK MODE
function toggleDark() {
    document.body.classList.toggle("dark");
}

// 🔁 SECTION SWITCH
function showSection(id, el) {
    document.querySelectorAll(".section").forEach(sec => {
        sec.style.display = "none";
    });

    document.getElementById(id).style.display = "block";

    document.querySelectorAll(".nav-btn").forEach(btn => {
        btn.classList.remove("active");
    });

    if (el) el.classList.add("active");
}

// INPUT CACHE
const titleEl = document.getElementById("title");
const authorEl = document.getElementById("author");
const deptEl = document.getElementById("dept");
const qtyEl = document.getElementById("qty");

// ================= EDIT MODAL =================
let currentEditId = null;

function editBook(id, title, author, dept, qty) {
    currentEditId = id;

    document.getElementById("editTitle").value = title;
    document.getElementById("editAuthor").value = author;
    document.getElementById("editDept").value = dept;
    document.getElementById("editQty").value = qty;

    document.getElementById("editModal").style.display = "flex";
}

function closeModal() {
    document.getElementById("editModal").style.display = "none";
}

async function updateBook() {
    const title = document.getElementById("editTitle").value.trim();
    const author = document.getElementById("editAuthor").value.trim();
    const dept = document.getElementById("editDept").value.trim();
    const qty = document.getElementById("editQty").value.trim();

    if (!title || !author || !dept || !qty) {
        return toast("Fill all fields ⚠️");
    }

    await fetch(`${API}/edit/${currentEditId}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ title, author, dept, qty })
    });

    toast("Book Updated ✏️");

    closeModal();
    loadBooks();
}

// ================= ADD BOOK =================
async function addBook() {
    const title = titleEl.value.trim();
    const author = authorEl.value.trim();
    const dept = deptEl.value.trim();
    const qty = qtyEl.value.trim();

    if (!title || !author || !dept || !qty) {
        return toast("Fill all fields ⚠️");
    }

    await fetch(`${API}/addBook`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ title, author, dept, qty })
    });

    toast("Book Added 📚");

    titleEl.value = authorEl.value = deptEl.value = qtyEl.value = "";

    refreshAll();
}

// ================= LOAD BOOKS (FIXED) =================
async function loadBooks() {
    let books = await (await fetch(`${API}/books`)).json();

    const search =
        document.getElementById("searchAdmin").value.toLowerCase() || "";
    const deptFilter =
        document.getElementById("filterDept").value.toLowerCase() || "";

    books = books.filter(b =>
        b.title.toLowerCase().includes(search) &&
        b.dept.toLowerCase().includes(deptFilter)
    );

    const div = document.getElementById("books");
    div.innerHTML = "";

    if (books.length === 0) {
        div.innerHTML = `<p>No books found 😕</p>`;
        return;
    }

    books.forEach(b => {
        div.innerHTML += `
        <div class="card">
            <h3>${b.title}</h3>
            <p>by ${b.author}</p>
            <p>Dept: ${b.dept}</p>
            <p>Available: ${b.qty - b.issued}</p>

            <button onclick="editBook('${b.id}', '${b.title}', '${b.author}', '${b.dept}', '${b.qty}')">
                ✏️ Edit
            </button>
        </div>`;
    });
}

// ================= REQUESTS =================
async function loadRequests() {
    const data = await (await fetch(`${API}/requests`)).json();

    const div = document.getElementById("requestList");
    div.innerHTML = "";

    const btn = document.querySelector(".nav-btn:nth-child(2)");

    if (data.length === 0) {
        div.innerHTML = `<p>No pending requests 📭</p>`;
        btn.innerHTML = "📩 Requests";
        return;
    }

    btn.innerHTML = `📩 Requests <span class="badge">${data.length}</span>`;

    data.forEach(r => {
        div.innerHTML += `
        <div class="card">
            <h3>${r.student.name}</h3>
            <p>Roll: ${r.student.roll}</p>
            <p>Dept: ${r.student.dept}</p>

            <p style="color:${r.type === "return" ? "#f59e0b" : "#22c55e"}">
                ${r.type === "return" ? "🔁 Return Request" : "📚 Issue Request"}
            </p>

            <button onclick="approve('${r.id}', '${r.type}')">✅ Approve</button>
            <button onclick="cancelRequest('${r.id}')">❌ Reject</button>
        </div>`;
    });
}

// ================= APPROVE =================
async function approve(id, type) {
    await fetch(`${API}/approve/${id}`, { method: "POST" });

    toast(type === "return" ? "Book Returned 🔁" : "Book Issued 📚");

    refreshAll();
}

// ================= CANCEL =================
async function cancelRequest(id) {
    await fetch(`${API}/cancel/${id}`, { method: "POST" });

    toast("Request Rejected ❌");

    loadRequests();
}

// ================= ISSUED =================
async function loadIssued() {
    const books = await (await fetch(`${API}/books`)).json();

    const table = document.getElementById("issuedTable");
    table.innerHTML = "";

    books.forEach(b => {
        (b.issuedTo || []).forEach(s => {
            table.innerHTML += `
            <tr>
                <td>${b.title}</td>
                <td>${s.name}</td>
                <td>${s.roll}</td>
                <td>${s.dept}</td>
            </tr>`;
        });
    });
}

// ================= CHART =================
async function loadChart() {
    const books = await (await fetch(`${API}/books`)).json();

    let total = books.reduce((a, b) => a + b.qty, 0);
    let issued = books.reduce((a, b) => a + b.issued, 0);

    if (window.myChart) window.myChart.destroy();

    window.myChart = new Chart(document.getElementById("chart"), {
        type: "doughnut",
        data: {
            labels: ["Available", "Issued"],
            datasets: [{
                data: [total - issued, issued]
            }]
        }
    });
}

function toggleDark() {
    document.body.classList.toggle("light");

    if (document.body.classList.contains("light")) {
        localStorage.setItem("theme", "light");
    } else {
        localStorage.setItem("theme", "dark");
    }
}

// ================= REFRESH =================
function refreshAll() {
    loadRequests();
    loadBooks();
    loadIssued();
    loadChart();
}

// 🔄 LIVE
setInterval(loadRequests, 5000);

// INIT
window.onload = () => {
    document.getElementById("loader").style.display = "none";
    refreshAll();
};