const API = "http://localhost:5000";

// Apply saved theme
if (localStorage.getItem("theme") === "light") {
    document.body.classList.add("light");
}

// 🔐 USER
let user = null;
try {
    user = JSON.parse(sessionStorage.getItem("user"));
} catch (e) {}

if (!user) window.location = "login.html";
if (!user.role) user.role = "student";

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

// 🔁 SECTION SWITCH (needed for your HTML)
function showSection(id, el) {
    document.querySelectorAll(".section").forEach(sec => {
        sec.style.display = "none";
    });

    const target = document.getElementById(id);
    if (target) target.style.display = "block";

    document.querySelectorAll(".nav-btn").forEach(btn => {
        btn.classList.remove("active");
    });

    if (el) el.classList.add("active");
}

// 🧯 LOADER SAFETY
window.addEventListener("load", () => {
    const loader = document.getElementById("loader");
    if (loader) loader.style.display = "none";
});

// ================= LOAD BOOKS =================
async function loadBooks() {
    try {
        const books = await (await fetch(`${API}/books`)).json();
        const requests = await (await fetch(`${API}/requests`)).json();

        const searchEl = document.getElementById("search");
        const search = searchEl ? searchEl.value.toLowerCase() : "";

        const div = document.getElementById("books");
        if (!div) return;

        div.innerHTML = "";

        let filtered = books;

        // 🔍 search
        if (search) {
            filtered = books.filter(b =>
                b.title.toLowerCase().includes(search)
            );
        }

        if (filtered.length === 0) {
            div.innerHTML = `<p>No books found 😕</p>`;
            return;
        }

        filtered.forEach(b => {
            const alreadyRequested = requests.some(r =>
                r.bookId === b.id &&
                r.student.roll === user.roll &&
                r.status === "pending"
            );

            div.innerHTML += `
            <div class="card">
                <h3>${b.title}</h3>
                <p>by ${b.author}</p>
                <p>Dept: ${b.dept}</p>
                <p>Available: ${b.qty - b.issued}</p>

                <button 
                    onclick="requestBook('${b.id}')"
                    ${alreadyRequested ? "disabled" : ""}>
                    ${alreadyRequested ? "⏳ Requested" : "📩 Request"}
                </button>
            </div>`;
        });

    } catch (err) {
        console.error("loadBooks error:", err);
        toast("Failed to load books ⚠️");
    }
}

// ================= REQUEST =================
async function requestBook(id) {
    try {
        const res = await fetch(`${API}/request/${id}`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify(user)
        });

        const msg = await res.text();

        if (msg === "duplicate") {
            return toast("Already requested ⚠️");
        }

        toast("Request Sent 🚀");
        loadBooks();
        loadRequests();

    } catch (err) {
        console.error(err);
        toast("Request failed ❌");
    }
}

// ================= MY BOOKS =================
async function loadMyBooks() {
    try {
        const books = await (await fetch(`${API}/books`)).json();

        const my = books.filter(b =>
            (b.issuedTo || []).some(s => s.roll === user.roll)
        );

        const div = document.getElementById("myBooks");
        if (!div) return;

        div.innerHTML = "";

        if (my.length === 0) {
            div.innerHTML = `<p>No books issued 📭</p>`;
            return;
        }

        my.forEach(b => {
            div.innerHTML += `
            <div class="card">
                <h3>${b.title}</h3>
                <p>${b.author}</p>

                <button onclick="returnBook('${b.id}')">
                    🔁 Request Return
                </button>
            </div>`;
        });

    } catch (err) {
        console.error("loadMyBooks error:", err);
    }
}

// ================= RETURN =================
async function returnBook(id) {
    try {
        const res = await fetch(`${API}/returnRequest/${id}`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify(user)
        });

        const msg = await res.text();

        if (msg === "duplicate") {
            return toast("Return already requested ⚠️");
        }

        toast("Return request sent 🔁");
        loadRequests();

    } catch (err) {
        console.error(err);
        toast("Return failed ❌");
    }
}

// ================= REQUEST STATUS =================
async function loadRequests() {
    try {
        const res = await fetch(`${API}/requests`);
        const data = await res.json();

        const books = await (await fetch(`${API}/books`)).json();

        const my = data.filter(r => r.student.roll === user.roll);

        const div = document.getElementById("requests");
        if (!div) return;

        div.innerHTML = "";

        if (my.length === 0) {
            div.innerHTML = `<p>No requests yet 📭</p>`;
            return;
        }

        my.forEach(r => {
            const book = books.find(b => b.id === r.bookId);

            div.innerHTML += `
            <div class="card">
                <h3>${book ? book.title : "Book"}</h3>

                <p><b>${r.type.toUpperCase()}</b></p>

                <p style="
                    font-weight:bold;
                    color:
                    ${r.status === "approved" ? "#22c55e" :
                      r.status === "rejected" ? "#ef4444" :
                      "#f59e0b"}">
                    ${(r.status || "pending").toUpperCase()}
                </p>
            </div>`;
        });

    } catch (err) {
        console.error("loadRequests error:", err);
    }
}

function toggleDark() {
    document.body.classList.toggle("light");

    if (document.body.classList.contains("light")) {
        localStorage.setItem("theme", "light");
    } else {
        localStorage.setItem("theme", "dark");
    }
}

// ================= INIT =================
async function init() {
    try {
        await loadBooks();
        await loadMyBooks();
        await loadRequests();
    } catch (err) {
        console.error("INIT ERROR:", err);
        toast("Something broke ⚠️");
    }
}

init();

// 🔄 AUTO REFRESH
setInterval(init, 7000);