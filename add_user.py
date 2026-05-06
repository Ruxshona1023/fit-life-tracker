from app import app, db, bcrypt
from models import User

def create_test_user():
    with app.app_context():
        # Yangi foydalanuvchi ma'lumotlari
        username = "alisher_fitness"
        email = "alisher@example.com"
        password = "password123" # Bu yerga istalgan parolni yozing
        
        # Bazada bormi yo'qligini tekshirish
        existing_user = User.query.filter_by(email=email).first()
        
        if not existing_user:
            # Parolni shifrlash
            hashed_password = bcrypt.generate_password_hash(password).decode('utf-8')
            
            # Yangi foydalanuvchi obyektini yaratish
            new_user = User(
                username=username,
                email=email,
                password=hashed_password,
                weight=78.5,
                height=182.0
            )
            
            db.session.add(new_user)
            db.session.commit()
            print(f"Muvaffaqiyatli: '{username}' foydalanuvchisi bazaga qo'shildi!")
        else:
            print(f"Xatolik: '{email}' elektron pochtali foydalanuvchi allaqachon mavjud.")

if __name__ == "__main__":
    create_test_user()
