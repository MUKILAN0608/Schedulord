FROM prom/prometheus:v2.53.0
COPY monitoring/prometheus/prometheus.yml /etc/prometheus/prometheus.yml
COPY monitoring/alerts/ /etc/prometheus/alerts/
