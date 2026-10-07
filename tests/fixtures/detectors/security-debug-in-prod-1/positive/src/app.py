from flask import Flask

app = Flask(__name__)

# Debug mode must never be enabled in production.
app.debug = True

if __name__ == "__main__":
    app.run(host="0.0.0.0", port=5000)
