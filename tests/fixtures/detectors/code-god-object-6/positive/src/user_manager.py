# code-god-object-6 positive: this class carries 31 methods at four-space indent, one past the limit of 30, so the rule MUST fire.
class UserManager:
    """Owns profiles, roles, sessions, notifications and billing for a user account."""

    def __init__(self, db, mailer):
        self.db = db
        self.mailer = mailer

    def create_user(self, email, password):
        return self.db.insert("users", {"email": email, "password": password})

    def deactivate_user(self, user_id):
        return self.db.update("users", user_id, {"active": False})

    def reactivate_user(self, user_id):
        return self.db.update("users", user_id, {"active": True})

    def delete_user(self, user_id):
        return self.db.delete("users", user_id)

    def find_by_id(self, user_id):
        return self.db.get("users", user_id)

    def find_by_email(self, email):
        return self.db.find_one("users", {"email": email})

    def list_active(self, limit=100):
        return self.db.find("users", {"active": True}, limit=limit)

    def change_email(self, user_id, email):
        return self.db.update("users", user_id, {"email": email})

    def change_password(self, user_id, password):
        return self.db.update("users", user_id, {"password": password})

    def reset_password(self, email):
        token = self.db.insert("password_resets", {"email": email})
        return self.mailer.send_reset(email, token)

    def verify_password(self, email, password):
        user = self.find_by_email(email)
        return user is not None and user["password"] == password

    def assign_role(self, user_id, role):
        return self.db.insert("user_roles", {"user_id": user_id, "role": role})

    def revoke_role(self, user_id, role):
        return self.db.delete_where("user_roles", {"user_id": user_id, "role": role})

    def list_roles(self, user_id):
        return self.db.find("user_roles", {"user_id": user_id})

    def grant_permission(self, role, permission):
        return self.db.insert("role_permissions", {"role": role, "permission": permission})

    def revoke_permission(self, role, permission):
        return self.db.delete_where("role_permissions", {"role": role, "permission": permission})

    def start_session(self, user_id, agent):
        return self.db.insert("sessions", {"user_id": user_id, "agent": agent})

    def end_session(self, session_id):
        return self.db.delete("sessions", session_id)

    def list_sessions(self, user_id):
        return self.db.find("sessions", {"user_id": user_id})

    def revoke_all_sessions(self, user_id):
        return self.db.delete_where("sessions", {"user_id": user_id})

    def enable_two_factor(self, user_id, secret):
        return self.db.update("users", user_id, {"totp_secret": secret})

    def disable_two_factor(self, user_id):
        return self.db.update("users", user_id, {"totp_secret": None})

    def verify_two_factor(self, user_id, code):
        user = self.find_by_id(user_id)
        return user is not None and user.get("totp_secret") == code

    def send_welcome_email(self, user_id):
        user = self.find_by_id(user_id)
        return self.mailer.send_welcome(user["email"])

    def send_password_reset(self, user_id):
        user = self.find_by_id(user_id)
        return self.reset_password(user["email"])

    def record_login(self, user_id, ip):
        return self.db.insert("logins", {"user_id": user_id, "ip": ip})

    def last_login_at(self, user_id):
        row = self.db.find_one("logins", {"user_id": user_id}, order="desc")
        return row["created_at"] if row else None

    def export_profile(self, user_id):
        return {k: v for k, v in self.find_by_id(user_id).items() if k != "password"}

    def merge_accounts(self, source_id, target_id):
        self.db.update("orders", {"user_id": source_id}, {"user_id": target_id})
        return self.delete_user(source_id)

    def anonymize(self, user_id):
        return self.db.update("users", user_id, {"email": None, "password": None})
