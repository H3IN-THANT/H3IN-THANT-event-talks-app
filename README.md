# BQ Radar: BigQuery Release Notes Explorer

A premium, high-fidelity web application built using Python Flask and plain vanilla HTML, CSS, and JavaScript. The application fetches, cleans, and organizes the Google Cloud BigQuery release notes RSS/Atom feed into a glassmorphism dashboard, allowing you to search, filter, and easily draft tweets to share updates on X (Twitter).

---

## 🌟 Features

* **Granular Feed Parsing**: Splits grouped daily release notes into separate cards (e.g. dividing a day's entry into distinct `Feature`, `Change`, and `Deprecation` elements) for clean viewing and focused sharing.
* **Disk Caching**: Saves parsed notes into a local `releases_cache.json` file. This speeds up page loads, prevents rate limits, and ensures the app works offline.
* **Refresh with Spinner**: Force-syncs the latest feed updates directly from Google Cloud with a single click.
* **Interactive Tweet Composer**: Automatically drafts customized tweets for selected updates, checks the 280-character limit, highlights warnings, and redirects you to X (Twitter) using standard Web Intents.
* **Real-time Search & Filtering**: Filters cards dynamically as you type. Shows dynamic count badges for each category.
* **Responsive Layouts**: Seamlessly switches between **Grid View** and **List View**, and scales down for tablet/mobile devices.

---

## 📂 Project Structure

```text
bq-releases-notes/
├── templates/
│   └── index.html        # Main HTML layout, structure, and widgets
├── static/
│   ├── css/
│   │   └── styles.css    # Premium glassmorphism dark theme & animations
│   └── js/
│       └── main.js       # Search, filter, selection, and share logic
├── app.py                # Flask server, Atom XML parser, and caching logic
├── .gitignore            # Git exclusion rules
├── README.md             # Documentation
└── venv/                 # Python virtual environment (local only)
```

---

## 🛠️ Prerequisites

* Python 3.12 or higher
* Pip (Python Package Installer)

---

## 🚀 Installation & Local Setup

1. **Clone or Navigate** to the project directory:
   ```bash
   cd C:\WINDOWS\system32\agy-cli-projects\bq-releases-notes
   ```

2. **Set up Virtual Environment**:
   ```bash
   python -m venv venv
   ```

3. **Activate the Environment**:
   * **On Windows (PowerShell)**:
     ```powershell
     .\venv\Scripts\Activate.ps1
     ```
   * **On Windows (CMD)**:
     ```cmd
     .\venv\Scripts\activate.bat
     ```

4. **Install Dependencies**:
   ```bash
   pip install flask requests beautifulsoup4
   ```

5. **Run the Application**:
   ```bash
   python app.py
   ```

6. Open your browser and go to:
   👉 **[http://127.0.0.1:5000](http://127.0.0.1:5000)**

---

## 🐦 How to Share Updates on X (Twitter)

1. Click on any release card. The card will highlight with a purple glow.
2. The **Tweet Composer** will appear in the sidebar with a generated draft containing the title, date, link, and hashtags.
3. Edit the text if needed. The counter will update dynamically (`X / 280`).
4. Click **Share on X** to open a pre-filled composition tab on Twitter.
5. Press `ESC` on your keyboard to clear your selection.

---

## ⚙️ How the Cache Works
* The application stores the parsed results in a local file named `releases_cache.json`.
* Every standard page load queries the local cache instead of Google Cloud, keeping load times under **50ms**.
* Clicking the **Refresh Notes** button triggers `GET /api/releases?refresh=true` which forces Flask to perform an external network request to Google Cloud, parsing and updating the cached data.
