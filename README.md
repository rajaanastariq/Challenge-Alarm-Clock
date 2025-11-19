# ⏰ WakeUp - Smart Alarm Clock

A beautiful, modern web-based alarm clock application that ensures you're truly awake by challenging you with math problems or typing tasks before dismissing the alarm.

![Python](https://img.shields.io/badge/Python-3.8+-blue.svg)
![Flask](https://img.shields.io/badge/Flask-2.0+-green.svg)
![License](https://img.shields.io/badge/License-MIT-yellow.svg)

# Screenshots
<img width="1366" height="616" alt="Screenshot (239)" src="https://github.com/user-attachments/assets/76a92b71-6be7-4f6d-978a-6a6e078e7ba3" />
<img width="1366" height="616" alt="Screenshot (240)" src="https://github.com/user-attachments/assets/570d1e5b-b5cc-419e-9071-efc6e9c5f618" />
<img width="1366" height="625" alt="Screenshot (241)" src="https://github.com/user-attachments/assets/ad12a5e5-e663-4f72-a91a-886f3ca18eae" />
<img width="1366" height="617" alt="Screenshot (242)" src="https://github.com/user-attachments/assets/0cfcc141-ea7a-416c-a3a0-e29be15f9c68" />
<img width="1366" height="622" alt="Screenshot (243)" src="https://github.com/user-attachments/assets/2572dd97-ded1-45d1-b2b0-c88624c71543" />
<img width="1366" height="622" alt="Screenshot (244)" src="https://github.com/user-attachments/assets/f7992915-f13a-4f70-bf5c-704637492dcc" />
<img width="1366" height="616" alt="Screenshot (245)" src="https://github.com/user-attachments/assets/9f581831-6b32-40c9-a7d2-d2d8f0fb0fa5" />


## ✨ Features

### 🎯 Core Functionality
- **Smart Wake-up Challenges**: Choose between math problems or sentence typing to prove you're awake
- **Custom Alarm Sounds**: Upload your own audio files (MP3, WAV, OGG, M4A) or use built-in sounds
- **Snooze Function**: 5-minute snooze with automatic re-triggering
- **Multiple Alarms**: Set and manage unlimited alarms
- **12-Hour Format**: User-friendly time display with AM/PM

### 📊 Statistics & Tracking
- Total alarms created
- Successful wake-ups
- Failed attempts
- Current streak counter
- Average response time

### 🎨 Modern UI/UX
- Glassmorphism design with animated backgrounds
- Fully responsive (desktop, tablet, mobile)
- Smooth animations and transitions
- Dark theme optimized for nighttime use
- Mobile-friendly sidebar navigation

### 👤 User Management
- Simple phone-based registration/login
- Personal alarm storage
- Custom sound library per user
- Session management

## 🚀 Getting Started

### Prerequisites

- Python 3.8 or higher
- pip (Python package manager)
- Modern web browser (Chrome, Firefox, Safari, Edge)

### Installation

1. **Clone the repository**
   ```bash
   git clone https://github.com/rajaanastariq/Challenge-Alarm-Clock.git
   cd Challenge-Alarm-Clock
   ```

2. **Create virtual environment**
   ```bash
   python -m venv venv
   
   # Windows
   venv\Scripts\activate
   
   # macOS/Linux
   source venv/bin/activate
   ```

3. **Install dependencies**
   ```bash
   pip install flask flask-sqlalchemy werkzeug
   ```

4. **Create required directories**
   ```bash
   mkdir -p static/uploads static/sounds
   ```

5. **Add default alarm sounds** (optional)
   
   Place your audio files in `static/sounds/`:
   - `default.mp3`
   - `gentle.mp3`
   - `intense.mp3`
   - `birds.mp3`

6. **Run the application**
   ```bash
   python app.py
   ```

7. **Open in browser**
   
   Navigate to `http://localhost:5000`

## 📁 Project Structure

```
Challenge-Alarm-Clock/
├── app.py                 # Flask backend application
├── alarmclock.db         # SQLite database (auto-generated)
├── templates/
│   └── index.html        # Main HTML template
├── static/
│   ├── css/
│   │   └── style.css     # Comprehensive styling
│   ├── js/
│   │   └── main.js       # Frontend logic
│   ├── sounds/           # Built-in alarm sounds
│   └── uploads/          # User-uploaded sounds
└── README.md
```

## 🎮 Usage

### Setting an Alarm

1. **Register/Login** with your phone number
2. Navigate to **"Set Alarm"** page
3. Select time (12-hour format)
4. Choose or upload an alarm sound
5. Select wake-up challenge type:
   - **Math Problem**: Solve arithmetic questions
   - **Type Sentence**: Type long sentences exactly
6. Click **"Create Alarm"**

### When Alarm Rings

1. Alarm sound plays and screen shows options
2. Choose **Snooze** (5 min) or **Stop**
3. If stopped, wait 2 minutes for challenge
4. Complete the challenge correctly to dismiss
5. Wrong answers restart the alarm!

### Managing Alarms

- View all alarms in **"Your Alarms"** page
- Delete alarms by clicking the delete button
- Check your wake-up statistics in **"Statistics"** page

## 🔧 Configuration

### Database

The app uses SQLite by default. To use PostgreSQL or MySQL:

```python
# In app.py, modify:
app.config["SQLALCHEMY_DATABASE_URI"] = "postgresql://user:pass@localhost/dbname"
```

### Security

**⚠️ Important for Production:**

Change the secret key in `app.py`:

```python
app.config["SECRET_KEY"] = "your-super-secret-key-here"
```

### Upload Limits

Modify in `app.py`:

```python
MAX_CONTENT_LENGTH = 10 * 1024 * 1024  # 10 MB (default)
```

## 🛠️ Technology Stack

### Backend
- **Flask**: Web framework
- **Flask-SQLAlchemy**: ORM for database
- **SQLite**: Database (default)
- **Werkzeug**: Security utilities

### Frontend
- **HTML5**: Structure
- **CSS3**: Styling with animations
- **Vanilla JavaScript**: Dynamic functionality
- **Google Fonts (Poppins)**: Typography

### Features
- Responsive design (mobile-first)
- Session-based authentication
- RESTful API endpoints
- Audio playback management
- Local storage for form data

## 📱 Browser Support

- ✅ Chrome 90+
- ✅ Firefox 88+
- ✅ Safari 14+
- ✅ Edge 90+
- ✅ Mobile browsers (iOS Safari, Chrome Mobile)

## 🤝 Contributing

Contributions are welcome! Please follow these steps:

1. Fork the repository
2. Create a feature branch (`git checkout -b feature/AmazingFeature`)
3. Commit changes (`git commit -m 'Add AmazingFeature'`)
4. Push to branch (`git push origin feature/AmazingFeature`)
5. Open a Pull Request

### Development Guidelines

- Follow PEP 8 for Python code
- Use meaningful variable names
- Comment complex logic
- Test on multiple devices/browsers
- Update README for new features

## 🐛 Known Issues

- Audio may require user interaction on first load (browser security)
- Wake Lock API not supported in all browsers
- Notifications require permission prompt

## 📋 Future Enhancements

- [ ] Recurring alarms (daily, weekdays, weekends)
- [ ] Multiple challenge difficulty levels
- [ ] Weather-based wake suggestions
- [ ] Sleep cycle tracking
- [ ] Progressive Web App (PWA) support
- [ ] Dark/light theme toggle
- [ ] Social features (challenge friends)
- [ ] Integration with smart home devices


## 👨‍💻 Author

**Raja Anas Tariq**
- GitHub: [@rajaanastariq](https://github.com/rajaanastariq)
- Project: [Challenge-Alarm-Clock](https://github.com/rajaanastariq/Challenge-Alarm-Clock)

## 🙏 Acknowledgments

- Google Fonts for Poppins typeface
- Flask community for excellent documentation
- All contributors and testers

## 📞 Support

If you encounter issues or have questions:

1. Check existing [Issues](https://github.com/rajaanastariq/Challenge-Alarm-Clock/issues)
2. Open a new issue with detailed description
3. Include browser/OS information
4. Provide screenshots if applicable

---

⭐ **If you find this project helpful, please star the repository!** ⭐

Made with ❤️ and ☕
