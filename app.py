from flask import Flask, render_template, url_for, flash, redirect, request, send_from_directory
from flask_bcrypt import Bcrypt
from flask_login import LoginManager, login_user, current_user, logout_user, login_required
from models import db, User, FitnessLog
from datetime import datetime
import os
from dotenv import load_dotenv

load_dotenv()

app = Flask(__name__)
app.config['SECRET_KEY'] = os.environ.get('SECRET_KEY', 'default_secret_key_123')
# SQLite ishlatamiz (mahalliy ishlab chiqish uchun), Bulutda PostgreSQL ga o'zgartiriladi
app.config['SQLALCHEMY_DATABASE_URI'] = 'sqlite:///fitness.db'

db.init_app(app)
bcrypt = Bcrypt(app)
login_manager = LoginManager(app)
login_manager.login_view = 'login'

@login_manager.user_loader
def load_user(user_id):
    return User.query.get(int(user_id))

# --- ROUTES ---

@app.route("/")
@app.route("/dashboard")
@login_required
def dashboard():
    # Bugungi ma'lumotlarni olish
    today = datetime.utcnow().date()
    log = FitnessLog.query.filter_by(user_id=current_user.id, date=today).first()
    
    # Oxirgi 7 kunlik ma'lumotlar (Grafik uchun)
    history = FitnessLog.query.filter_by(user_id=current_user.id).order_by(FitnessLog.date.desc()).limit(7).all()
    history.reverse() # Xronologik tartib uchun
    
    # BMI hisoblash
    bmi = 0
    bmi_category = ""
    if current_user.height > 0:
        bmi = round(current_user.weight / ((current_user.height/100)**2), 1)
        if bmi < 18.5: bmi_category = "Vazn yetishmaydi"
        elif 18.5 <= bmi < 25: bmi_category = "Normal"
        elif 25 <= bmi < 30: bmi_category = "Ortiqcha vazn"
        else: bmi_category = "Semizlik"

    return render_template('dashboard.html', log=log, history=history, bmi=bmi, bmi_category=bmi_category)

@app.route("/update_profile", methods=['POST'])
@login_required
def update_profile():
    current_user.weight = float(request.form.get('weight', 0))
    current_user.height = float(request.form.get('height', 0))
    
    if 'profile_image' in request.files:
        file = request.files['profile_image']
        if file.filename != '':
            filename = f"user_{current_user.id}_{file.filename}"
            file.save(os.path.join('static/img', filename))
            current_user.profile_image = filename
            
    db.session.commit()
    flash('Profil ma\'lumotlari yangilandi!', 'success')
    return redirect(url_for('dashboard'))

@app.route("/register", methods=['GET', 'POST'])
def register():
    if current_user.is_authenticated:
        return redirect(url_for('dashboard'))
    if request.method == 'POST':
        hashed_password = bcrypt.generate_password_hash(request.form.get('password')).decode('utf-8')
        user = User(username=request.form.get('username'), email=request.form.get('email'), password=hashed_password)
        db.session.add(user)
        db.session.commit()
        flash('Hisobingiz muvaffaqiyatli yaratildi!', 'success')
        return redirect(url_for('login'))
    return render_template('register.html')

@app.route("/login", methods=['GET', 'POST'])
def login():
    if current_user.is_authenticated:
        return redirect(url_for('dashboard'))
    if request.method == 'POST':
        user = User.query.filter_by(email=request.form.get('email')).first()
        if user and bcrypt.check_password_hash(user.password, request.form.get('password')):
            login_user(user)
            return redirect(url_for('dashboard'))
        else:
            flash('Xatolik! Email yoki parol noto\'g\'ri.', 'danger')
    return render_template('login.html')

@app.route("/add_data", methods=['POST'])
@login_required
def add_data():
    today = datetime.utcnow().date()
    log = FitnessLog.query.filter_by(user_id=current_user.id, date=today).first()
    
    steps = int(request.form.get('steps', 0))
    calories_burned = int(request.form.get('calories_burned', 0))
    calories_consumed = int(request.form.get('calories_consumed', 0))

    if not log:
        log = FitnessLog(date=today, steps=steps, calories_burned=calories_burned, 
                         calories_consumed=calories_consumed, user_id=current_user.id)
        db.session.add(log)
    else:
        log.steps += steps
        log.calories_burned += calories_burned
        log.calories_consumed += calories_consumed
    
    db.session.commit()
    return redirect(url_for('dashboard'))

@app.route("/logout")
def logout():
    logout_user()
    return redirect(url_for('login'))

if __name__ == '__main__':
    with app.app_context():
        db.create_all() # MB jadvallarini yaratish
    app.run(debug=True)
