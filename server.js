const path = require('path');
const express = require("express");
const fs = require("fs");
const bcrypt = require("bcrypt");

const app = express();

app.use(express.json());
app.use(express.static("public"));

const USERS = "Data files/users.json";
const BOOKS = "Data files/books.json";
const REQUESTS = "Data files/requests.json";

// ================= FILE HELPERS =================

function readFile(file) {
    return fs.existsSync(file) ? JSON.parse(fs.readFileSync(file)) : [];
}

function writeFile(file, data) {
    fs.writeFileSync(file, JSON.stringify(data, null, 2));
}

// ================= 🔐 AUTH =================

app.get('/', (req, res) => {
    res.sendFile(path.join(__dirname, 'public', 'login.html'));
});

// REGISTER
app.post("/register", async(req, res) => {
    const users = readFile(USERS);
    const hashedPassword = await bcrypt.hash(req.body.password, 10);

    users.push({
        id: Date.now().toString(),
        name: req.body.name,
        roll: req.body.roll,
        dept: req.body.dept,
        phone: req.body.phone, // <-- Add this line
        password: hashedPassword,
        role: req.body.role
    });

    writeFile(USERS, users);
    res.send("Registered");
});

// LOGIN
app.post("/login", async (req, res) => {
    const users = readFile(USERS);

    // Look for a user that matches BOTH the roll number AND the selected role
    const user = users.find(u => u.roll === req.body.roll && u.role === req.body.role);
    
    if (!user) return res.status(401).send("User not found for this role.");

    const match = await bcrypt.compare(req.body.password, user.password);
    if (!match) return res.status(401).send("Wrong Password");

    res.json(user);
});

// ================= 📚 BOOK =================

// ADD BOOK
app.post("/addBook", (req, res) => {
    const books = readFile(BOOKS);

    books.push({
        id: Date.now().toString(),
        title: req.body.title,
        author: req.body.author,
        dept: req.body.dept,
        qty: Number(req.body.qty),
        issued: 0,
        issuedTo: []
    });

    writeFile(BOOKS, books);
    res.send("Added");
});

// EDIT BOOK
app.put("/edit/:id", (req, res) => {
    let books = readFile(BOOKS);

    books = books.map(b => {
        if (b.id === req.params.id) {
            return {
                ...b,
                title: req.body.title,
                author: req.body.author,
                dept: req.body.dept,
                qty: Number(req.body.qty)
            };
        }
        return b;
    });

    writeFile(BOOKS, books);
    res.send("Updated");
});

// GET BOOKS
app.get("/books", (req, res) => {
    res.json(readFile(BOOKS));
});

// ================= 📩 REQUEST SYSTEM =================

// ISSUE REQUEST
app.post("/request/:bookId", (req, res) => {
    const requests = readFile(REQUESTS);

    requests.push({
        id: Date.now().toString(),
        type: "issue",
        status: "pending", // ⭐ NEW
        bookId: req.params.bookId,
        student: req.body
    });

    writeFile(REQUESTS, requests);
    res.send("Request Sent");
});

// RETURN REQUEST
app.post("/returnRequest/:bookId", (req, res) => {
    const requests = readFile(REQUESTS);

    requests.push({
        id: Date.now().toString(),
        type: "return",
        status: "pending", // ⭐ NEW
        bookId: req.params.bookId,
        student: req.body
    });

    writeFile(REQUESTS, requests);
    res.send("Return Request Sent");
});

// GET ALL REQUESTS (ADMIN)
app.get("/requests", (req, res) => {
    const requests = readFile(REQUESTS);

    // show only pending to admin
    res.json(requests.filter(r => r.status === "pending"));
});

// ⭐ GET USER REQUESTS (NEW - FOR STUDENT)
app.get("/myRequests/:roll", (req, res) => {
    const requests = readFile(REQUESTS);

    const my = requests.filter(r => r.student.roll === req.params.roll);

    res.json(my);
});

// ================= ✅ APPROVAL ENGINE =================

app.post("/approve/:reqId", (req, res) => {
    let requests = readFile(REQUESTS);
    let books = readFile(BOOKS);

    const reqItem = requests.find(r => r.id === req.params.reqId);
    if (!reqItem) return res.send("No request");

    books = books.map(b => {
        if (b.id === reqItem.bookId) {

            // ISSUE
            if (reqItem.type === "issue") {
                if (b.qty > b.issued) {
                    b.issued++;
                    b.issuedTo.push({
                        ...reqItem.student,
                        issuedAt: Date.now()
                    });
                }
            }

            // RETURN
            if (reqItem.type === "return") {
                if (b.issued > 0) {
                    b.issued--;

                    b.issuedTo = b.issuedTo.filter(
                        s => s.roll !== reqItem.student.roll
                    );
                }
            }
        }
        return b;
    });

    // ⭐ mark as approved (DO NOT DELETE)
    requests = requests.map(r =>
        r.id === req.params.reqId ? {...r, status: "approved" } : r
    );

    writeFile(BOOKS, books);
    writeFile(REQUESTS, requests);

    res.send("Approved");
});

// ❌ CANCEL / REJECT
app.post("/cancel/:reqId", (req, res) => {
    let requests = readFile(REQUESTS);

    // ⭐ mark as rejected instead of deleting
    requests = requests.map(r =>
        r.id === req.params.reqId ? {...r, status: "rejected" } : r
    );

    writeFile(REQUESTS, requests);

    res.send("Cancelled");
});

// ================= 📊 ANALYTICS =================

app.get("/analytics", (req, res) => {
    const books = readFile(BOOKS);

    const studentMap = {};
    const bookMap = {};

    books.forEach(b => {
        bookMap[b.title] = (bookMap[b.title] || 0) + b.issued;

        (b.issuedTo || []).forEach(s => {
            if (!studentMap[s.roll]) {
                studentMap[s.roll] = {
                    name: s.name,
                    roll: s.roll,
                    dept: s.dept,
                    count: 0
                };
            }
            studentMap[s.roll].count++;
        });
    });

    const topStudents = Object.values(studentMap)
        .sort((a, b) => b.count - a.count)
        .slice(0, 5);

    const topBooks = Object.entries(bookMap)
        .map(([title, count]) => ({ title, count }))
        .sort((a, b) => b.count - a.count)
        .slice(0, 5);

    res.json({ topStudents, topBooks });
});

// ================= START =================

app.listen(5000, () =>
    console.log("🚀 Server is running on http://localhost:5000")
);