FROM eclipse-mosquitto:latest

# Salin konfigurasi ke dalam container
COPY mosquitto.conf /mosquitto/config/mosquitto.conf

# Ekspos port agar bisa diakses
EXPOSE 1883
EXPOSE 9001