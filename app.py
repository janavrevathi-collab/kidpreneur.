from flask import Flask, render_template, request, jsonify, session, redirect, url_for
from werkzeug.utils import secure_filename
import os
from datetime import datetime, timedelta

app = Flask(__name__)
app.secret_key = "supersecretkey"

UPLOAD_FOLDER = "uploads"
os.makedirs(UPLOAD_FOLDER, exist_ok=True)
app.config["UPLOAD_FOLDER"] = UPLOAD_FOLDER

# In-memory databases (replace with real DB for production)
users = {}  # {username: password}
ideas = []  # list of dicts {id, name, title, problem, votes, file, voted_by}
competition_end = datetime.now() + timedelta(days=5)  # Example live competition

# Serve homepage
@app.route("/")
def home():
    return render_template("index.html")

# Signup
@app.route("/signup", methods=["POST"])
def signup():
    data = request.json
    username = data.get("username")
    password = data.get("password")
    if not username or not password:
        return jsonify({"error": "Username & password required"}), 400
    if username in users:
        return jsonify({"error": "Username already exists"}), 400
    users[username] = password
    return jsonify({"message": "Signup successful!"})

# Login
@app.route("/login", methods=["POST"])
def login():
    data = request.json
    username = data.get("username")
    password = data.get("password")
    if username in users and users[username] == password:
        session["username"] = username
        return jsonify({"message": "Login successful!"})
    return jsonify({"error": "Invalid username or password"}), 401

# Logout
@app.route("/logout", methods=["POST"])
def logout():
    session.pop("username", None)
    return jsonify({"message": "Logged out"})

# Submit idea
@app.route("/submit", methods=["POST"])
def submit_idea():
    if "username" not in session:
        return jsonify({"error": "Login required"}), 401
    name = request.form.get("name")
    title = request.form.get("title")
    problem = request.form.get("problem")
    file = request.files.get("file")
    filename = None
    if file:
        filename = secure_filename(file.filename)
        file.save(os.path.join(app.config["UPLOAD_FOLDER"], filename))
    idea_id = len(ideas)
    ideas.append({
        "id": idea_id,
        "name": name,
        "title": title,
        "problem": problem,
        "votes": 0,
        "file": filename,
        "voted_by": set()
    })
    return jsonify({"message": "Idea submitted successfully!"})

# Get all ideas
@app.route("/ideas")
def get_ideas():
    result = []
    for idea in ideas:
        result.append({
            "id": idea["id"],
            "name": idea["name"],
            "title": idea["title"],
            "problem": idea["problem"],
            "votes": idea["votes"],
            "file": idea["file"]
        })
    # Sort by votes descending
    result.sort(key=lambda x: x["votes"], reverse=True)
    return jsonify(result)

# Vote on idea
@app.route("/vote/<int:idea_id>", methods=["POST"])
def vote(idea_id):
    if "username" not in session:
        return jsonify({"error": "Login required"}), 401
    username = session["username"]
    if idea_id >= len(ideas):
        return jsonify({"error": "Idea not found"}), 404
    idea = ideas[idea_id]
    if username in idea["voted_by"]:
        return jsonify({"error": "You already voted for this idea"}), 400
    idea["votes"] += 1
    idea["voted_by"].add(username)
    return jsonify({"message": "Vote counted!"})

# Competition status
@app.route("/competition_status")
def competition_status():
    now = datetime.now()
    if now > competition_end:
        status = "Competition Ended"
        time_left = "0s"
    else:
        status = "Live"
        delta = competition_end - now
        time_left = str(delta).split('.')[0]  # hh:mm:ss
    return jsonify({"status": status, "time_left": time_left})

# Serve uploaded files
@app.route("/uploads/<filename>")
def uploaded_file(filename):
    return redirect(url_for('static', filename=os.path.join('uploads', filename)))

if __name__ == "__main__":
    app.run(debug=True)
