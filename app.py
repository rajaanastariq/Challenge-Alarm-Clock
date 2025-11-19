# app.py
import os
import random
from datetime import datetime
from flask import (
    Flask, render_template, request, jsonify, session,
    send_from_directory, abort
)
from flask_sqlalchemy import SQLAlchemy
from werkzeug.utils import secure_filename

# ---------------- Config ----------------
BASE_DIR = os.path.dirname(os.path.abspath(__file__))
UPLOAD_FOLDER = os.path.join(BASE_DIR, "static", "uploads")
os.makedirs(UPLOAD_FOLDER, exist_ok=True)

ALLOWED_EXTENSIONS = {"mp3", "wav", "ogg", "m4a"}
MAX_CONTENT_LENGTH = 10 * 1024 * 1024  # 10 MB

app = Flask(__name__, template_folder="templates", static_folder="static")
app.config["SECRET_KEY"] = "dev-change-me"  # change in production
app.config["SQLALCHEMY_DATABASE_URI"] = "sqlite:///" + os.path.join(BASE_DIR, "alarmclock.db")
app.config["SQLALCHEMY_TRACK_MODIFICATIONS"] = False
app.config["UPLOAD_FOLDER"] = UPLOAD_FOLDER
app.config["MAX_CONTENT_LENGTH"] = MAX_CONTENT_LENGTH

db = SQLAlchemy(app)

# ---------------- Models ----------------
class User(db.Model):
    id = db.Column(db.Integer, primary_key=True)
    phone = db.Column(db.String(32), unique=True, nullable=False)
    name = db.Column(db.String(80), nullable=True)
    avatar = db.Column(db.String(256), nullable=True)


class Sound(db.Model):
    id = db.Column(db.Integer, primary_key=True)
    user_id = db.Column(db.Integer, db.ForeignKey("user.id"), nullable=True)
    filename = db.Column(db.String(256), nullable=True)   # saved filename in /static/uploads
    url = db.Column(db.String(1024), nullable=True)       # external URL if provided
    original_name = db.Column(db.String(256), nullable=True)
    created_at = db.Column(db.DateTime, default=datetime.utcnow)


class Alarm(db.Model):
    id = db.Column(db.Integer, primary_key=True)
    user_id = db.Column(db.Integer, db.ForeignKey("user.id"), nullable=True)
    time = db.Column(db.String(5), nullable=False)  # "HH:MM" 24-hour
    label = db.Column(db.String(120), default="Alarm")
    sound = db.Column(db.String(1024), nullable=True)  # can be '/static/uploads/xxx' or external url or builtin name
    challenge_type = db.Column(db.String(20), default="sentence")  # 'sentence' or 'math'
    enabled = db.Column(db.Boolean, default=True)
    created_at = db.Column(db.DateTime, default=datetime.utcnow)


class WakeupRecord(db.Model):
    id = db.Column(db.Integer, primary_key=True)
    user_id = db.Column(db.Integer, db.ForeignKey("user.id"), nullable=True)
    alarm_id = db.Column(db.Integer, db.ForeignKey("alarm.id"), nullable=True)
    event = db.Column(db.String(64))  # 'alarm_triggered', 'success', 'failed', 'snooze'
    response_time = db.Column(db.Integer, nullable=True)  # seconds
    created_at = db.Column(db.DateTime, default=datetime.utcnow)


# Create DB
with app.app_context():
    db.create_all()

# ---------------- Helpers ----------------
def get_current_user():
    uid = session.get("user_id")
    if not uid:
        return None
    return User.query.get(uid)


def alarm_to_dict(a: Alarm):
    return {
        "id": str(a.id),
        "user_id": str(a.user_id) if a.user_id else None,
        "time": a.time,
        "label": a.label,
        "sound": a.sound,
        "challenge_type": a.challenge_type,
        "enabled": a.enabled,
    }


def allowed_file(filename):
    ext = filename.rsplit(".", 1)[-1].lower() if "." in filename else ""
    return ext in ALLOWED_EXTENSIONS


# ---------------- Routes ----------------
@app.route("/")
def index():
    # serve your index page (templates/index.html must exist)
    return render_template("index.html")


# ----- Account endpoints -----
@app.route("/api/account/register", methods=["POST"])
def register_account():
    data = request.json or {}
    phone = data.get("phone")
    if not phone:
        return jsonify({"error": "Phone required"}), 400
    user = User.query.filter_by(phone=phone).first()
    if user:
        session["user_id"] = user.id
        return jsonify({"phone": user.phone, "id": user.id})
    user = User(phone=phone)
    db.session.add(user)
    db.session.commit()
    session["user_id"] = user.id
    return jsonify({"phone": user.phone, "id": user.id})


@app.route("/api/account/login", methods=["POST"])
def login_account():
    data = request.json or {}
    phone = data.get("phone")
    if not phone:
        return jsonify({"error": "Phone required"}), 400
    user = User.query.filter_by(phone=phone).first()
    if not user:
        return jsonify({"error": "No such user"}), 404
    session["user_id"] = user.id
    return jsonify({"phone": user.phone, "id": user.id})


@app.route("/api/account/logout", methods=["POST"])
def logout_account():
    session.pop("user_id", None)
    return jsonify({"success": True})


@app.route("/api/account", methods=["GET"])
def current_account():
    user = get_current_user()
    if not user:
        return jsonify({"logged_in": False})
    return jsonify({
        "logged_in": True,
        "user": {
            "phone": user.phone,
            "id": user.id,
            "name": user.name,
            "avatar": user.avatar
        }
    })


# ----- Upload sound (file upload or JSON with url) -----
@app.route("/api/upload_sound", methods=["POST"])
def upload_sound():
    user = get_current_user()
    # File upload
    if "file" in request.files:
        f = request.files["file"]
        if not f or f.filename == "":
            return jsonify({"error": "No file selected"}), 400
        if not allowed_file(f.filename):
            return jsonify({"error": f"Unsupported file type. Allowed: {', '.join(ALLOWED_EXTENSIONS)}"}), 400
        filename = secure_filename(f.filename)
        ts = datetime.utcnow().strftime("%Y%m%d%H%M%S%f")
        saved_name = f"{ts}_{filename}"
        save_path = os.path.join(app.config["UPLOAD_FOLDER"], saved_name)
        f.save(save_path)
        s = Sound(user_id=user.id if user else None, filename=saved_name, original_name=filename)
        db.session.add(s)
        db.session.commit()
        return jsonify({"success": True, "sound": {"id": s.id, "url": f"/static/uploads/{saved_name}"}})

    # JSON-based (external URL)
    data = request.json or {}
    if data.get("url"):
        url = data.get("url")
        name = data.get("name") or url
        s = Sound(user_id=user.id if user else None, url=url, original_name=name)
        db.session.add(s)
        db.session.commit()
        return jsonify({"success": True, "sound": {"id": s.id, "url": s.url}})

    return jsonify({"error": "No file or url provided"}), 400


# ----- List user sounds (or global) -----
@app.route("/api/user_sounds", methods=["GET"])
def user_sounds():
    user = get_current_user()
    if user:
        sounds = Sound.query.filter((Sound.user_id == user.id) | (Sound.user_id == None)).order_by(Sound.created_at.desc()).all()
    else:
        sounds = Sound.query.order_by(Sound.created_at.desc()).all()

    out = []
    for s in sounds:
        url = s.url or (f"/static/uploads/{s.filename}" if s.filename else None)
        out.append({
            "id": s.id,
            "user_id": s.user_id,
            "url": url,
            "original_name": s.original_name
        })
    return jsonify(out)


# ----- Alarms (GET, POST, DELETE) -----
@app.route("/api/alarms", methods=["GET", "POST", "DELETE"])
def manage_alarms():
    user = get_current_user()

    if request.method == "GET":
        # show only user's alarms when logged in, otherwise shared/sessionless alarms
        if user:
            alarms = Alarm.query.filter_by(user_id=user.id).order_by(Alarm.created_at.desc()).all()
        else:
            alarms = Alarm.query.filter_by(user_id=None).order_by(Alarm.created_at.desc()).all()
        return jsonify([alarm_to_dict(a) for a in alarms])

    if request.method == "POST":
        data = request.json or {}
        time = data.get("time")
        label = data.get("label") or "Alarm"
        sound = data.get("sound") or data.get("alarmSound") or "default"
        challenge_type = data.get("challenge_type") or "sentence"
        if not time:
            return jsonify({"error": "time required"}), 400
        a = Alarm(
            user_id=user.id if user else None,
            time=time,
            label=label,
            sound=sound,
            challenge_type=challenge_type,
            enabled=True
        )
        db.session.add(a)
        db.session.commit()
        return jsonify(alarm_to_dict(a))

    if request.method == "DELETE":
        data = request.json or {}
        alarm_id = data.get("id")
        if not alarm_id:
            return jsonify({"error": "id required"}), 400
        a = Alarm.query.get(int(alarm_id))
        if not a:
            return jsonify({"error": "not found"}), 404
        db.session.delete(a)
        db.session.commit()
        return jsonify({"success": True})


# ----- Toggle alarm -----
@app.route("/api/alarm/toggle", methods=["POST"])
def toggle_alarm():
    data = request.json or {}
    alarm_id = data.get("id")
    if not alarm_id:
        return jsonify({"error": "id required"}), 400
    a = Alarm.query.get(int(alarm_id))
    if not a:
        return jsonify({"error": "not found"}), 404
    a.enabled = not a.enabled
    db.session.commit()
    return jsonify({"success": True, "enabled": a.enabled})


# ----- Challenge generator -----
SENTENCES = [
    "The quick brown fox jumps over the lazy dog with unprecedented agility",
    "A journey of a thousand miles begins with a single determined step forward",
    "Success is not final, failure is not fatal, it's the courage to continue that counts",
    "The only way to do great work is to love what you do passionately every day",
    "Innovation distinguishes between a leader and a follower in every aspect of life",
    "Your time is limited, don't waste it living someone else's life or following their dreams",
    "The future belongs to those who believe in the beauty of their wildest dreams",
    "Perseverance is not a long race; it is many short races one after the other continuously",
    "Excellence is not a skill, it's an attitude that we must cultivate daily",
    "The difference between ordinary and extraordinary is that little extra effort we put in"
]


@app.route("/api/challenge", methods=["GET"])
def get_challenge():
    ctype = request.args.get("type", "sentence")
    if ctype == "math":
        n1 = random.randint(10, 50)
        n2 = random.randint(2, 20)
        op = random.choice(["+", "-", "*"])
        if op == "+":
            ans = n1 + n2
        elif op == "-":
            ans = n1 - n2
        else:
            ans = n1 * n2
        return jsonify({"type": "math", "question": f"{n1} {op} {n2}", "answer": str(ans)})
    else:
        sentence = random.choice(SENTENCES)
        return jsonify({"type": "sentence", "sentence": sentence})


# ----- Statistics GET/POST (per-user) -----
@app.route("/api/statistics", methods=["GET", "POST"])
def statistics():
    user = get_current_user()
    if request.method == "GET":
        # compute stats from WakeupRecord for user (or all if anonymous)
        q = WakeupRecord.query
        if user:
            q = q.filter_by(user_id=user.id)
            total_alarms = Alarm.query.filter_by(user_id=user.id).count()
        else:
            # If anonymous, return global counts (but frontend expects per-user ideally)
            q = q
            total_alarms = Alarm.query.count()

        success = q.filter_by(event="success").count()
        failed = q.filter_by(event="failed").count()
        snoozes = q.filter_by(event="snooze").count()

        # streak: consecutive successes most recent first
        streak = 0
        recs = q.order_by(WakeupRecord.created_at.desc()).all()
        for r in recs:
            if r.event == "success":
                streak += 1
            elif r.event in ("failed",):
                break

        # optionally compute average_response_time
        times = [r.response_time for r in q.filter_by(event="success").all() if r.response_time is not None]
        avg_rt = int(sum(times) / len(times)) if times else None

        return jsonify({
            "total_alarms": total_alarms,
            "successful_wakeups": success,
            "failed_attempts": failed,
            "total_snoozes": snoozes,
            "streak": streak,
            "average_response_time": avg_rt
        })

    # POST: record event
    data = request.json or {}
    event = data.get("event")
    alarm_id = data.get("alarm_id")
    response_time = data.get("response_time")
    user = get_current_user()
    rec = WakeupRecord(user_id=user.id if user else None, alarm_id=alarm_id, event=event, response_time=response_time)
    db.session.add(rec)
    db.session.commit()
    return jsonify({"success": True})


# ----- Serve uploaded files (helper) -----
@app.route("/uploads/<path:filename>")
def uploaded_file(filename):
    try:
        return send_from_directory(app.config["UPLOAD_FOLDER"], filename)
    except Exception:
        abort(404)


# ---------------- Run ----------------
if __name__ == "__main__":
    # debug True for development only
    app.run(debug=True)
