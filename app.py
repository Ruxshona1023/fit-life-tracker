import flask
import sqlite3
import pyodbc
import json
import os

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

    # Jadvalni yaratish
    try:
        # SQLite uchun
        c.execute('''CREATE TABLE IF NOT EXISTS fitness_data
                     (
                         id
                         INTEGER
                         PRIMARY
                         KEY,
                         content
                         TEXT
                     )''')
    except:
        # Azure SQL uchun
        try:
            c.execute('''
                IF NOT EXISTS (SELECT * FROM sysobjects WHERE name='fitness_data' AND xtype='U')
                CREATE TABLE fitness_data (id INT PRIMARY KEY, content NVARCHAR(MAX))
            ''')
        except Exception as err:
            print(f"Jadval yaratishda xato: {err}")

    # Boshlang'ich ma'lumot
    try:
        c.execute('SELECT content FROM fitness_data WHERE id=1')
        if not c.fetchone():
            initial_data = {
                "user": {"firstName": "Foydalanuvchi", "lastName": "", "avatar": None},
                "goalSteps": 10000, "streak": 0, "lastActiveDate": None, "dailyLogs": {}
            }
            c.execute('INSERT INTO fitness_data (id, content) VALUES (1, ?)', (json.dumps(initial_data),))

        if hasattr(conn, 'commit'):
            conn.commit()
    except Exception as e:
        print(f"Ma'lumotlarni tekshirishda xato: {e}")

    conn.close()


app = flask.Flask(__name__,
                  template_folder=os.path.join(basedir, 'templates'),
                  static_folder=os.path.join(basedir, 'static'))


@app.route('/')
def index():
    return flask.render_template('index.html')


@app.route('/api/get_data', methods=['GET'])
def get_data():
    try:
        conn = get_db_connection()
        c = conn.cursor()
        c.execute('SELECT content FROM fitness_data WHERE id=1')
        row = c.fetchone()
        conn.close()
        if row:
            return flask.jsonify(json.loads(row[0]))
        return flask.jsonify({"error": "No data found"}), 404
    except Exception as e:
        return flask.jsonify({"error": str(e)}), 500


@app.route('/api/save_data', methods=['POST'])
def save_data():
    try:
        data = flask.request.json
        conn = get_db_connection()
        c = conn.cursor()
        # SQL Server va SQLite uchun har xil bo'lishi mumkin bo'lgan UPDATE so'rovi
        c.execute('UPDATE fitness_data SET content = ? WHERE id = 1', (json.dumps(data),))
        if hasattr(conn, 'commit'):
            conn.commit()
        conn.close()
        return flask.jsonify({"status": "success", "message": "Ma'lumotlar saqlandi"})
    except Exception as e:
        return flask.jsonify({"status": "error", "message": str(e)}), 500


if __name__ == '__main__':
    init_db()
    print("Server ishga tushmoqda: http://127.0.0.1:5000")
    app.run(debug=True, port=5000)
