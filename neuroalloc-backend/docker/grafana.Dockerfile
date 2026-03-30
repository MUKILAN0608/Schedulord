FROM grafana/grafana:11.1.4
COPY monitoring/grafana/provisioning /etc/grafana/provisioning
COPY monitoring/grafana/dashboards /etc/grafana/dashboards

