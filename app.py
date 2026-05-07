import flask
from flask import session
import sqlite3
import pyodbc
import json
import os
from werkzeug.security import generate_password_hash, check_password_hash

# Loyihaning asosiy papkasini aniqlash
basedir = os.path.abspath(os.path.dirname(__file__))
DB_PATH = os.path.join(basedir, 'database.db')

# --- AZURE SQL SOZLAMALARI ---
AZURE_CONFIG = {
    'server': 'demo-azure-2-testing.database.windows.net',
    'database': 'demoDB4Azure',
    'username': 'azure-admin1',
    'password': 'ruxshona-123',
    'driver': '{ODBC Driver 18 for SQL Server}'
}

def get_db_connection():
    """Baza bilan ulanishni yaratadi (Azure yoki Lokal)"""
    try:
        conn_str = (
            f"DRIVER={AZURE_CONFIG['driver']};"
            f"SERVER={AZURE_CONFIG['server']};"
            f"DATABASE={AZURE_CONFIG['database']};"
            f"UID={AZURE_CONFIG['username']};"
            f"PWD={AZURE_CONFIG['password']};"
            "Connection Timeout=30;"
            "TrustServerCertificate=yes;"
        )
        conn = pyodbc.connect(conn_str)
        conn.autocommit = True
        return conn
    except Exception as e:
        print(f"Azure SQL-ga ulanishda xato: {e}")
        print("Lokal SQLite bazasidan foydalanilmoqda...")
        return sqlite3.connect(DB_PATH)

def init_db():
    conn = get_db_connection()
    c = conn.cursor()

    # Jadvallarni yaratish
    try:
        # SQLite uchun
        c.execute('''CREATE TABLE IF NOT EXISTS users (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            username TEXT UNIQUE,
            password TEXT
        )''')
        c.execute('''CREATE TABLE IF NOT EXISTS fitness_data (
            user_id INTEGER PRIMARY KEY,
            content TEXT
        )''')
    except:
        # Azure SQL uchun
        try:
            c.execute('''
                IF NOT EXISTS (SELECT * FROM sysobjects WHERE name='users' AND xtype='U')
                CREATE TABLE users (id INT IDENTITY(1,1) PRIMARY KEY, username NVARCHAR(255) UNIQUE, password NVARCHAR(255))
            ''')
            c.execute('''
                IF NOT EXISTS (SELECT * FROM sysobjects WHERE name='fitness_data' AND xtype='U')
                CREATE TABLE fitness_data (user_id INT PRIMARY KEY, content NVARCHAR(MAX))
            ''')
        except Exception as err:
            print(f"Jadval yaratishda xato: {err}")

    if hasattr(conn, 'commit'):
        conn.commit()
    conn.close()

app = flask.Flask(__name__,
                  template_folder=os.path.join(basedir, 'templates'),
                  static_folder=os.path.join(basedir, 'static'))
app.secret_key = 'fitlife-pro-super-secret'

@app.route('/')
def index():
    return flask.render_template('index.html')

@app.route('/api/register', methods=['POST'])
def register():
    data = flask.request.json
    username = data.get('username')
    password = data.get('password')
    if not username or not password:
        return flask.jsonify({"error": "Iltimos, ism va parolni kiriting!"}), 400

    hashed_pw = generate_password_hash(password)
    conn = get_db_connection()
    c = conn.cursor()
    
    try:
        c.execute('INSERT INTO users (username, password) VALUES (?, ?)', (username, hashed_pw))
        # Get the newly created user's id
        if hasattr(c, 'lastrowid') and c.lastrowid:
            user_id = c.lastrowid
        else:
            c.execute('SELECT id FROM users WHERE username = ?', (username,))
            user_id = c.fetchone()[0]
            
        # Initialize empty fitness data for this user
        initial_data = {
            "user": {"firstName": username, "lastName": "", "avatar": None},
            "goalSteps": 10000, "streak": 0, "lastActiveDate": None, "dailyLogs": {}, "history": [0]*7
        }
        c.execute('INSERT INTO fitness_data (user_id, content) VALUES (?, ?)', (user_id, json.dumps(initial_data)))
        
        if hasattr(conn, 'commit'):
            conn.commit()
            
        session['user_id'] = user_id
        return flask.jsonify({"status": "success"})
    except Exception as e:
        return flask.jsonify({"error": "Bunday foydalanuvchi nomi band yoki tizimda xatolik yuz berdi."}), 400
    finally:
        conn.close()

@app.route('/api/login', methods=['POST'])
def login():
    data = flask.request.json
    username = data.get('username')
    password = data.get('password')
    
    conn = get_db_connection()
    c = conn.cursor()
    c.execute('SELECT id, password FROM users WHERE username = ?', (username,))
    user = c.fetchone()
    conn.close()
    
    if user and check_password_hash(user[1], password):
        session['user_id'] = user[0]
        return flask.jsonify({"status": "success"})
        
    return flask.jsonify({"error": "Login yoki parol noto'g'ri!"}), 401

@app.route('/api/logout', methods=['POST'])
def logout():
    session.pop('user_id', None)
    return flask.jsonify({"status": "success"})

@app.route('/api/get_data', methods=['GET'])
def get_data():
    if 'user_id' not in session:
        return flask.jsonify({"error": "Unauthorized"}), 401
        
    try:
        conn = get_db_connection()
        c = conn.cursor()
        c.execute('SELECT content FROM fitness_data WHERE user_id=?', (session['user_id'],))
        row = c.fetchone()
        conn.close()
        if row:
            return flask.jsonify(json.loads(row[0]))
        return flask.jsonify({"error": "No data found"}), 404
    except Exception as e:
        return flask.jsonify({"error": str(e)}), 500

@app.route('/api/save_data', methods=['POST'])
def save_data():
    if 'user_id' not in session:
        return flask.jsonify({"error": "Unauthorized"}), 401
        
    try:
        data = flask.request.json
        conn = get_db_connection()
        c = conn.cursor()
        
        c.execute('SELECT user_id FROM fitness_data WHERE user_id = ?', (session['user_id'],))
        if c.fetchone():
            c.execute('UPDATE fitness_data SET content = ? WHERE user_id = ?', (json.dumps(data), session['user_id']))
        else:
            c.execute('INSERT INTO fitness_data (user_id, content) VALUES (?, ?)', (session['user_id'], json.dumps(data)))
            
        if hasattr(conn, 'commit'):
            conn.commit()
        conn.close()
        return flask.jsonify({"status": "success"})
    except Exception as e:
        return flask.jsonify({"status": "error", "message": str(e)}), 500

if __name__ == '__main__':
    init_db()
    print("Server ishga tushmoqda: http://127.0.0.1:5000")
    app.run(debug=True, port=5000)
