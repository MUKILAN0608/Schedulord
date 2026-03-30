FROM prom/prometheus:v2.54.1
COPY monitoring/prometheus/prometheus.yml /etc/prometheus/prometheus.yml
COPY monitoring/alerts/alert.rules.yml /etc/prometheus/alerts/alert.rules.yml

