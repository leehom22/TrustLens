# setup 
env: put .env under /app
env: dont put "" for the API KEY

# run the server (at Backend path)
python -m app.main

# testing endpoint 
http://127.0.0.1:8000/