from flask_sqlalchemy import SQLAlchemy
from flask_login import UserMixin
from datetime import datetime

db = SQLAlchemy()

class User(db.Model, UserMixin):
    id = db.Column(db.Integer, primary_key=True)
    username = db.Column(db.String(50), unique=True, nullable=False)
    email = db.Column(db.String(120), unique=True, nullable=False)
    password = db.Column(db.String(100), nullable=False)
    weight = db.Column(db.Float, default=0.0) # kg
    height = db.Column(db.Float, default=0.0) # cm
    profile_image = db.Column(db.String(100), default='default.png')
    # Bir foydalanuvchining ko'plab ma'lumotlari bo'lishi mumkin
    fitness_logs = db.relationship('FitnessLog', backref='author', lazy=True)

class FitnessLog(db.Model):
    id = db.Column(db.Integer, primary_key=True)
    date = db.Column(db.Date, nullable=False, default=datetime.utcnow().date)
    steps = db.Column(db.Integer, default=0)
    calories_burned = db.Column(db.Integer, default=0)
    calories_consumed = db.Column(db.Integer, default=0)
    user_id = db.Column(db.Integer, db.ForeignKey('user.id'), nullable=False)

    def __repr__(self):
        return f"FitnessLog('{self.date}', Steps: {self.steps})"
