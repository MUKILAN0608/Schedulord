FROM grafana/grafana:11.1.0
COPY backend/monitoring/grafana/provisioning /etc/grafana/provisioning
COPY backend/monitoring/grafana/dashboards /etc/grafana/dashboards
