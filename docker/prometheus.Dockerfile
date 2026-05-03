FROM prom/prometheus:v2.53.0
COPY backend/monitoring/prometheus/prometheus.yml /etc/prometheus/prometheus.yml
COPY backend/monitoring/alerts/ /etc/prometheus/alerts/
